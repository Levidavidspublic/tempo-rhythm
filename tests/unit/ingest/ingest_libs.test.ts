/**
 * IngestSheet readers for photos (tesseract.js), PDFs (pdf.js) and Word .docx (mammoth), owner-
 * approved 2026-10-18. The libraries are never loaded here: each sits behind an injected reader
 * function, and these tests pass fakes, so nothing touches the network. Bun has File but no
 * FileReader, so a stand-in that hands back the bytes is installed for this file only.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import {
  fileKind,
  hasWords,
  INGEST_ACCEPT,
  INGEST_MAX_DOCX_BYTES,
  INGEST_MAX_PDF_BYTES,
  INGEST_MAX_PDF_PAGES,
  ingestKind,
  interpretDocx,
  interpretPdf,
  isOldOfficeFile,
  maxFileBytes,
  pdfPageText,
  photoText,
} from "../../../apps/web/components/ingest/ingest-text";
import {
  type IngestReaders,
  OCR_LANGUAGES,
  type OcrProgress,
  type OcrWorkerLike,
  readIngestFile,
  readPhotoText,
} from "../../../apps/web/components/ingest/read-sources";

class BytesFileReader {
  result: ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onload?.();
    });
  }
}

const globals = globalThis as Record<string, unknown>;
const hadReader = "FileReader" in globals;
const realReader = globals.FileReader;
beforeAll(() => {
  globals.FileReader = BytesFileReader;
});
afterAll(() => {
  if (hadReader) globals.FileReader = realReader;
  else delete globals.FileReader;
});

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 fictional");
const pdf = (name = "Biology notes.pdf", bytes: Uint8Array = PDF_BYTES) =>
  new File([bytes], name, { type: "application/pdf" });
const docx = (name = "Lab report.docx", bytes: Uint8Array = Uint8Array.of(0x50, 0x4b, 3, 4)) =>
  new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
const OLE = Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0);

/** Readers that fail the test if they are reached. */
const untouched = (): Partial<IngestReaders> => ({
  readPdfPages: mock(async () => {
    throw new Error("pdf reader should not run");
  }),
  readDocxText: mock(async () => {
    throw new Error("docx reader should not run");
  }),
});

describe("kinds and limits", () => {
  test("PDF, Word .docx and old .doc are told apart by name, or by type when there is no name", () => {
    expect(ingestKind("Notes.PDF")).toBe("pdf");
    expect(ingestKind("report.docx")).toBe("docx");
    expect(ingestKind("old.DOC")).toBe("doc");
    expect(ingestKind("scan", "application/pdf")).toBe("pdf");
    expect(ingestKind("x", "application/msword")).toBe("doc");
    expect(ingestKind("a.md")).toBe("text");
    expect(ingestKind("a.htm")).toBe("html");
    expect(ingestKind("a.pages")).toBeNull();
    expect(ingestKind("a.rtf")).toBeNull();
    // The name wins over a misleading type.
    expect(ingestKind("a.pdf", "text/plain")).toBe("pdf");
    // fileKind stays the text decoder's question: PDFs and Word files aren't text files.
    expect(fileKind("a.pdf", "application/pdf")).toBeNull();
  });

  test("the picker offers .pdf and .docx, never the old .doc", () => {
    const accepted = INGEST_ACCEPT.split(",");
    expect(accepted).toContain(".pdf");
    expect(accepted).toContain(".docx");
    expect(accepted).toContain("application/pdf");
    expect(accepted).not.toContain(".doc");
    expect(accepted).not.toContain("application/msword");
  });

  test("the caps are 20 MB and 100 pages for a PDF, and 10 MB for a Word file", () => {
    expect(INGEST_MAX_PDF_BYTES).toBe(20 * 1024 * 1024);
    expect(INGEST_MAX_PDF_PAGES).toBe(100);
    expect(INGEST_MAX_DOCX_BYTES).toBe(10 * 1024 * 1024);
    expect(maxFileBytes("pdf")).toBe(INGEST_MAX_PDF_BYTES);
    expect(maxFileBytes("docx")).toBe(INGEST_MAX_DOCX_BYTES);
    expect(maxFileBytes("text")).toBe(2 * 1024 * 1024);
  });

  test("an old Office file is known by its first eight bytes", () => {
    expect(isOldOfficeFile(OLE)).toBe(true);
    expect(isOldOfficeFile(Uint8Array.of(0x50, 0x4b, 3, 4))).toBe(false);
    expect(isOldOfficeFile(Uint8Array.of(0xd0, 0xcf))).toBe(false);
  });
});

describe("PDF text", () => {
  test("a page's runs join into lines where pdf.js marks a line's end", () => {
    expect(
      pdfPageText([
        { str: "Chapter 2:", hasEOL: false },
        { str: " ", hasEOL: false },
        { str: "Osmosis  ", hasEOL: true },
        { str: "Water moves across a membrane.", hasEOL: true },
        { str: "פרק שני", hasEOL: false },
      ])
    ).toBe("Chapter 2: Osmosis\nWater moves across a membrane.\nפרק שני");
  });

  test("pages are kept apart by a blank line, and the title comes from the file name", () => {
    expect(
      interpretPdf("Biology_notes.pdf", {
        pageCount: 2,
        pages: ["Cells", "Tissues"],
      })
    ).toEqual({ ok: true, text: "Cells\n\nTissues", title: "Biology notes" });
  });

  test("no letters or digits on any page means no text layer (a scan)", () => {
    expect(interpretPdf("scan.pdf", { pageCount: 3, pages: ["", "  \n ", "· ·"] })).toEqual({
      ok: false,
      problem: "no_text",
    });
    expect(interpretPdf("scan.pdf", { pageCount: 0, pages: [] })).toEqual({
      ok: false,
      problem: "no_text",
    });
  });

  test("a PDF longer than the pages read says how many were read", () => {
    expect(interpretPdf("long.pdf", { pageCount: 240, pages: ["One", "Two"] })).toEqual({
      ok: true,
      text: "One\n\nTwo",
      title: "long",
      pages: { read: 2, total: 240 },
    });
  });

  test("more than 200 KB of text is too large, as for any import", () => {
    expect(interpretPdf("big.pdf", { pageCount: 1, pages: ["a".repeat(205_000)] })).toEqual({
      ok: false,
      problem: "too_large",
    });
  });
});

describe("Word and photo text", () => {
  test("a Word file's text is tidied: LF endings, one blank line at most", () => {
    expect(interpretDocx("Lab report.docx", "Lab report\r\n\r\n\r\n\r\nResults: 4 ml\r\n")).toEqual(
      {
        ok: true,
        text: "Lab report\n\nResults: 4 ml",
        title: "Lab report",
      }
    );
    expect(interpretDocx("blank.docx", " \n\n ")).toEqual({
      ok: false,
      problem: "empty",
    });
  });

  test("OCR text: lines trimmed, runs of spaces and blank lines folded, Hebrew kept", () => {
    expect(photoText("  Chapter   4 \n\n\n\n  שלום  עולם \n")).toBe("Chapter 4\n\nשלום עולם");
  });

  test("OCR text with no letters or digits counts as nothing found", () => {
    expect(photoText(" | ~ \n — . ")).toBeNull();
    expect(photoText("")).toBeNull();
    expect(hasWords("٣")).toBe(true);
  });
});

describe("readIngestFile with the PDF and Word readers", () => {
  test("an old .doc is refused plainly, before anything is read", async () => {
    const readers = untouched();
    const file = new File([OLE], "Old essay.doc", {
      type: "application/msword",
    });
    expect(await readIngestFile(file, { readers })).toEqual({
      ok: false,
      problem: "doc",
    });
    expect(readers.readDocxText).not.toHaveBeenCalled();
  });

  test("a .doc saved under a .docx name is refused the same way, not as unreadable", async () => {
    const readers = untouched();
    expect(await readIngestFile(docx("renamed.docx", OLE), { readers })).toEqual({
      ok: false,
      problem: "doc",
    });
    expect(readers.readDocxText).not.toHaveBeenCalled();
  });

  test("a PDF over 20 MB and a Word file over 10 MB are refused before they are opened", async () => {
    const readers = untouched();
    const bigPdf = pdf("big.pdf", new Uint8Array(INGEST_MAX_PDF_BYTES + 1));
    const bigDocx = docx("big.docx", new Uint8Array(INGEST_MAX_DOCX_BYTES + 1));
    expect(await readIngestFile(bigPdf, { readers })).toEqual({
      ok: false,
      problem: "file_too_big",
    });
    expect(await readIngestFile(bigDocx, { readers })).toEqual({
      ok: false,
      problem: "file_too_big",
    });
    expect(readers.readPdfPages).not.toHaveBeenCalled();
    expect(readers.readDocxText).not.toHaveBeenCalled();
  });

  test("a PDF is read through the page cap, with progress per page", async () => {
    const seen: unknown[] = [];
    const readPdfPages: IngestReaders["readPdfPages"] = async (bytes, { maxPages, onPage }) => {
      seen.push({ bytes: new TextDecoder().decode(bytes), maxPages });
      onPage(1, 2);
      onPage(2, 2);
      return { pageCount: 2, pages: ["Photosynthesis", "Light and water"] };
    };
    const progress: unknown[] = [];
    const result = await readIngestFile(pdf(), {
      readers: { readPdfPages },
      onProgress: (p) => progress.push(p),
    });
    expect(result).toEqual({
      ok: true,
      text: "Photosynthesis\n\nLight and water",
      title: "Biology notes",
    });
    expect(seen).toEqual([{ bytes: "%PDF-1.7 fictional", maxPages: 100 }]);
    expect(progress).toEqual([
      { kind: "pdf" },
      { kind: "pdf", done: 1, total: 2 },
      { kind: "pdf", done: 2, total: 2 },
    ]);
  });

  test("a PDF without a text layer says so, so the sheet can offer a photo", async () => {
    const readPdfPages = async () => ({
      pageCount: 4,
      pages: ["", "", "", ""],
    });
    expect(await readIngestFile(pdf("scan.pdf"), { readers: { readPdfPages } })).toEqual({
      ok: false,
      problem: "no_text",
    });
  });

  test("a password-locked PDF is told apart from a broken one", async () => {
    const locked = async () => {
      throw Object.assign(new Error("No password given"), {
        name: "PasswordException",
      });
    };
    const broken = async () => {
      throw Object.assign(new Error("Invalid PDF structure."), {
        name: "InvalidPDFException",
      });
    };
    expect(await readIngestFile(pdf(), { readers: { readPdfPages: locked } })).toEqual({
      ok: false,
      problem: "locked",
    });
    expect(await readIngestFile(pdf(), { readers: { readPdfPages: broken } })).toEqual({
      ok: false,
      problem: "unreadable",
    });
  });

  test("stopping a PDF mid-read aborts the reader and ends as cancelled", async () => {
    const job = new AbortController();
    let readerSignal: AbortSignal | null = null;
    const readPdfPages: IngestReaders["readPdfPages"] = (_bytes, { signal }) => {
      readerSignal = signal;
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Worker was destroyed")));
      });
    };
    const reading = readIngestFile(pdf(), {
      readers: { readPdfPages },
      signal: job.signal,
    });
    await Bun.sleep(0);
    job.abort();
    expect(await reading).toEqual({ ok: false, problem: "cancelled" });
    expect((readerSignal as AbortSignal | null)?.aborted).toBe(true);
  });

  test("a Word file's text comes from the docx reader, given the file's bytes", async () => {
    const readDocxText = mock(async (bytes: ArrayBuffer) => {
      expect(new Uint8Array(bytes).slice(0, 2)).toEqual(Uint8Array.of(0x50, 0x4b));
      return "Lab report\n\nWe measured osmosis in potato cubes.";
    });
    expect(await readIngestFile(docx(), { readers: { readDocxText } })).toEqual({
      ok: true,
      text: "Lab report\n\nWe measured osmosis in potato cubes.",
      title: "Lab report",
    });
    expect(readDocxText).toHaveBeenCalledTimes(1);
  });

  test("a Word file that won't unzip is unreadable; an empty one is empty", async () => {
    const throws = async () => {
      throw new Error("Can't find end of central directory");
    };
    expect(await readIngestFile(docx(), { readers: { readDocxText: throws } })).toEqual({
      ok: false,
      problem: "unreadable",
    });
    expect(await readIngestFile(docx("empty.docx", new Uint8Array(0)), untouched())).toEqual({
      ok: false,
      problem: "empty",
    });
  });
});

describe("readPhotoText with the OCR reader", () => {
  const photo = () => new Blob([Uint8Array.of(1, 2, 3)], { type: "image/jpeg" });
  const asIs = async (image: Blob) => image;

  function fakeWorker(recognize: OcrWorkerLike["recognize"]) {
    const worker = {
      recognize: mock(recognize),
      terminate: mock(async () => {}),
    };
    return worker;
  }

  test("the OCR reads the prepared photo, and its worker is terminated after the read", async () => {
    const prepared = new Blob([Uint8Array.of(7)], { type: "image/png" });
    const worker = fakeWorker(async () => ({
      data: { text: "  Mitosis   has four   phases\n" },
    }));
    const progress: OcrProgress[] = [];
    const result = await readPhotoText(photo(), {
      readers: {
        preparePhoto: async () => prepared,
        createOcrWorker: async (onProgress) => {
          onProgress({ stage: "loading", ratio: 0.5 });
          onProgress({ stage: "reading", ratio: 0.25 });
          return worker;
        },
      },
      onProgress: (p) => progress.push(p),
    });
    expect(result).toEqual({ ok: true, text: "Mitosis has four phases" });
    expect(worker.recognize).toHaveBeenCalledWith(prepared);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([
      { stage: "loading", ratio: 0 },
      { stage: "loading", ratio: 0.5 },
      { stage: "reading", ratio: 0.25 },
    ]);
  });

  test("English and Hebrew are read together", () => {
    expect(OCR_LANGUAGES).toBe("eng+heb");
  });

  test("no words found is 'none', and the worker still goes", async () => {
    const worker = fakeWorker(async () => ({ data: { text: " ~ | \n" } }));
    const result = await readPhotoText(photo(), {
      readers: { preparePhoto: asIs, createOcrWorker: async () => worker },
    });
    expect(result).toEqual({ ok: false, problem: "none" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  test("a failing read is 'error'; a reader that can't start is 'load'", async () => {
    const worker = fakeWorker(async () => {
      throw new Error("Error attempting to read image.");
    });
    expect(
      await readPhotoText(photo(), {
        readers: { preparePhoto: asIs, createOcrWorker: async () => worker },
      })
    ).toEqual({ ok: false, problem: "error" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(
      await readPhotoText(photo(), {
        readers: {
          preparePhoto: asIs,
          createOcrWorker: async () => {
            throw new Error("Failed to fetch");
          },
        },
      })
    ).toEqual({ ok: false, problem: "load" });
  });

  test("Stop terminates the worker straight away and ends as cancelled", async () => {
    const job = new AbortController();
    let started: () => void = () => {};
    const recognizing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const worker = fakeWorker(() => {
      started();
      return new Promise(() => {});
    });
    const reading = readPhotoText(photo(), {
      readers: { preparePhoto: asIs, createOcrWorker: async () => worker },
      signal: job.signal,
    });
    await recognizing;
    expect(worker.terminate).not.toHaveBeenCalled();
    job.abort();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    // A terminated worker never answers: the read ends anyway, as cancelled.
    expect(await reading).toEqual({ ok: false, problem: "cancelled" });
  });

  test("Stop before the reader is ready: the worker is terminated as soon as it exists", async () => {
    const job = new AbortController();
    const worker = fakeWorker(async () => ({ data: { text: "Too late" } }));
    let ready: (w: OcrWorkerLike) => void = () => {};
    const reading = readPhotoText(photo(), {
      readers: {
        preparePhoto: asIs,
        createOcrWorker: () =>
          new Promise((resolve) => {
            ready = resolve;
          }),
      },
      signal: job.signal,
    });
    await Bun.sleep(0);
    job.abort();
    ready(worker);
    expect(await reading).toEqual({ ok: false, problem: "cancelled" });
    await Bun.sleep(0);
    expect(worker.recognize).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe("the libraries stay out of the main bundle", () => {
  const source = (file: string) =>
    Bun.file(`${process.cwd()}/apps/web/components/ingest/${file}`).text();

  test("read-sources.ts loads each library only with import() inside a function", async () => {
    const text = await source("read-sources.ts");
    for (const lib of ["tesseract.js", "pdfjs-dist", "mammoth"]) {
      expect(text).not.toMatch(new RegExp(`^import[^;]*from "${lib}`, "m"));
      expect(text).toMatch(new RegExp(`await import\\("${lib}`));
    }
  });

  test("no other IngestSheet file imports a library", async () => {
    for (const file of ["IngestSheet.tsx", "ingest-text.ts", "copy.ts", "index.ts"]) {
      const text = await source(file);
      expect(text).not.toMatch(/(?:from\s*|import\(\s*)"(?:tesseract\.js|pdfjs-dist|mammoth)/);
    }
  });
});
