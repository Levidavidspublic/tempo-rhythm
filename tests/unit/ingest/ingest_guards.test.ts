/**
 * IngestSheet guards (review fixes): a Word file is checked from its zip's own list of parts and
 * read in a worker that Stop, closing and a time limit terminate; a photo's size comes from its
 * header (over 40 megapixels is refused, and nothing is scaled up); PDF reading stops at the
 * text limit; Stop during a library download stops at once. No library is loaded here: zips and
 * image headers are built by hand (big sizes are declared, never stored), and pdf.js, tesseract.js
 * and the Word worker are stand-ins.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { INGEST_MAX_BYTES } from "../../../apps/web/components/ingest/ingest-text";
import {
  createTesseractWorker,
  type DocxWorkerLike,
  defaultReaders,
  type IngestReaders,
  type PdfDocumentLike,
  type PdfjsDeps,
  preparePhoto,
  readDocxInWorker,
  readIngestFile,
  readPdfjsPages,
  readPdfText,
  readPhotoText,
} from "../../../apps/web/components/ingest/read-sources";
import {
  checkDocxZip,
  DOCX_MAX_DOCUMENT_XML_BYTES,
  DOCX_MAX_UNPACKED_BYTES,
  imageSize,
  PHOTO_MAX_PIXELS,
  photoDecodeSize,
} from "../../../apps/web/components/ingest/source-checks";
import { en, he } from "../../../apps/web/lib/i18n-groups/ingest";

// ---------------------------------------------------------------- hand-built files

/** A zip's central directory and end record only: the parts' data is never stored. */
function zip(entries: { name: string; size: number }[], options: { comment?: number } = {}) {
  const names = entries.map((entry) => new TextEncoder().encode(entry.name));
  const directorySize = names.reduce((sum, name) => sum + 46 + name.length, 0);
  const comment = options.comment ?? 0;
  const bytes = new Uint8Array(directorySize + 22 + comment);
  const view = new DataView(bytes.buffer);
  let at = 0;
  entries.forEach((entry, i) => {
    const name = names[i] as Uint8Array;
    view.setUint32(at, 0x02014b50, true);
    view.setUint32(at + 20, 100, true); // compressed size: small
    view.setUint32(at + 24, entry.size, true); // declared unpacked size
    view.setUint16(at + 28, name.length, true);
    bytes.set(name, at + 46);
    at += 46 + name.length;
  });
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, directorySize, true);
  view.setUint32(at + 16, 0, true);
  view.setUint16(at + 20, comment, true);
  return bytes;
}

const WORD_PARTS = [
  { name: "[Content_Types].xml", size: 1_200 },
  { name: "_rels/.rels", size: 590 },
  { name: "word/styles.xml", size: 30_000 },
];
const docxFile = (bytes: Uint8Array, name = "MOCKED report.docx") =>
  new File([bytes], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

const png = (width: number, height: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], 0);
  b.set([..."IHDR"].map((c) => c.charCodeAt(0)), 12);
  const view = new DataView(b.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
};

/** A JPEG: SOI, an optional EXIF APP1 with an orientation, an APP0 to skip, then SOF0. */
const jpeg = (width: number, height: number, orientation?: number) => {
  const parts: number[] = [0xff, 0xd8];
  if (orientation) {
    // "Exif\0\0", TIFF big-endian, IFD0 at 8 with one entry: 0x0112 SHORT 1 = orientation.
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1];
    exif.push(0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0);
    parts.push(0xff, 0xe1, 0, exif.length + 2, ...exif);
  }
  parts.push(0xff, 0xe0, 0, 4, 0, 0);
  parts.push(0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 0, 0, 0);
  return Uint8Array.from(parts);
};

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const webp = (chunk: "VP8 " | "VP8L" | "VP8X", width: number, height: number) => {
  const b = new Uint8Array(40);
  b.set(ascii("RIFF"), 0);
  b.set(ascii("WEBPVP8"), 8);
  b.set(ascii(chunk), 12);
  const view = new DataView(b.buffer);
  if (chunk === "VP8 ") {
    b.set([0x9d, 0x01, 0x2a], 23);
    view.setUint16(26, width, true);
    view.setUint16(28, height, true);
  } else if (chunk === "VP8L") {
    b[20] = 0x2f;
    view.setUint32(21, (width - 1) | ((height - 1) << 14), true);
  } else {
    view.setUint16(24, (width - 1) & 0xffff, true);
    b[26] = (width - 1) >> 16;
    view.setUint16(27, (height - 1) & 0xffff, true);
    b[29] = (height - 1) >> 16;
  }
  return b;
};

// FileReader stand-in (Bun has none) that hands back the bytes, for readIngestFile.
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
const saved: Record<string, unknown> = {};
const SAVED = ["FileReader", "createImageBitmap", "OffscreenCanvas"] as const;
beforeAll(() => {
  for (const key of SAVED) saved[key] = globals[key];
  globals.FileReader = BytesFileReader;
});
afterAll(() => {
  for (const key of SAVED) {
    if (saved[key] === undefined) delete globals[key];
    else globals[key] = saved[key];
  }
});

// ---------------------------------------------------------------- Word files

describe("a Word file's zip is checked before mammoth runs", () => {
  test("an ordinary Word file passes", () => {
    expect(checkDocxZip(zip([...WORD_PARTS, { name: "word/document.xml", size: 80_000 }]))).toBe(
      "ok"
    );
    // A zip comment after the end record is allowed.
    expect(
      checkDocxZip(zip([{ name: "word/document.xml", size: 10 }], { comment: 300 }))
    ).toBe("ok");
  });

  test("word/document.xml declaring more than 4 MB unpacked is too big", () => {
    expect(DOCX_MAX_DOCUMENT_XML_BYTES).toBe(4 * 1024 * 1024);
    const bomb = zip([...WORD_PARTS, { name: "word/document.xml", size: 4 * 1024 * 1024 + 1 }]);
    // The reviewer's case: a few hundred bytes on disk that would unpack to gigabytes.
    expect(bomb.byteLength).toBeLessThan(400);
    expect(checkDocxZip(bomb)).toBe("too_big");
    expect(checkDocxZip(zip([{ name: "word/document.xml", size: 0xffffffff }]))).toBe("too_big");
  });

  test("all parts together declaring more than 40 MB is too big", () => {
    expect(DOCX_MAX_UNPACKED_BYTES).toBe(40 * 1024 * 1024);
    const parts = [
      { name: "word/document.xml", size: 1_000_000 },
      ...Array.from({ length: 5 }, (_, i) => ({ name: `word/media/image${i}.png`, size: 10_000_000 })),
    ];
    expect(checkDocxZip(zip(parts))).toBe("too_big");
    expect(checkDocxZip(zip(parts.slice(0, 4)))).toBe("ok");
  });

  test("not a zip, a cut-off zip, or a zip with no word/document.xml is not a Word file", () => {
    expect(checkDocxZip(Uint8Array.of(0x50, 0x4b, 3, 4))).toBe("not_docx");
    expect(checkDocxZip(new TextEncoder().encode("Just some text, saved as .docx".repeat(3)))).toBe(
      "not_docx"
    );
    expect(checkDocxZip(zip(WORD_PARTS))).toBe("not_docx");
    const cut = zip([{ name: "word/document.xml", size: 10 }]);
    new DataView(cut.buffer).setUint32(0, 0x12345678, true); // broken entry signature
    expect(checkDocxZip(cut)).toBe("not_docx");
  });

  test("the real reader refuses before any worker or mammoth starts, in plain problems", async () => {
    const bomb = zip([...WORD_PARTS, { name: "word/document.xml", size: 50_000_000 }]);
    expect(await readIngestFile(docxFile(bomb))).toEqual({ ok: false, problem: "docx_too_big" });
    expect(await readIngestFile(docxFile(zip(WORD_PARTS)))).toEqual({
      ok: false,
      problem: "not_docx",
    });
    await expect(defaultReaders.readDocxText(bomb.slice().buffer)).rejects.toThrow("docx_too_big");
  });
});

describe("a Word file is read in its own worker", () => {
  function fakeWorker() {
    const worker = {
      onmessage: null,
      onerror: null,
      posted: [] as ArrayBuffer[],
      postMessage: mock((bytes: ArrayBuffer) => {
        worker.posted.push(bytes);
      }),
      terminate: mock(() => {}),
      reply(data: { ok: true; text: string } | { ok: false }) {
        (worker.onmessage as unknown as ((event: { data: unknown }) => void) | null)?.({ data });
      },
    } as DocxWorkerLike & {
      posted: ArrayBuffer[];
      terminate: ReturnType<typeof mock>;
      reply: (data: { ok: true; text: string } | { ok: false }) => void;
    };
    return worker;
  }

  test("the bytes go to the worker, its text comes back, and the worker is ended", async () => {
    const worker = fakeWorker();
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const reading = readDocxInWorker(bytes, undefined, () => worker);
    expect(worker.posted).toEqual([bytes]);
    worker.reply({ ok: true, text: "Lab report" });
    expect(await reading).toBe("Lab report");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  test("a failure inside the worker is a rejection, and the worker is ended", async () => {
    const worker = fakeWorker();
    const reading = readDocxInWorker(new ArrayBuffer(2), undefined, () => worker);
    worker.reply({ ok: false });
    await expect(reading).rejects.toThrow("unreadable");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  test("Stop terminates the worker at once; stopped before it starts, none is made", async () => {
    const worker = fakeWorker();
    const job = new AbortController();
    const reading = readDocxInWorker(new ArrayBuffer(2), job.signal, () => worker);
    job.abort();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await expect(reading).rejects.toThrow("cancelled");

    const start = mock(() => fakeWorker());
    await expect(readDocxInWorker(new ArrayBuffer(2), job.signal, start)).rejects.toThrow(
      "cancelled"
    );
    expect(start).not.toHaveBeenCalled();
  });

  test("a Word file still reading after the time limit stops, with its own problem", async () => {
    let readerSignal: AbortSignal | undefined;
    const readDocxText: IngestReaders["readDocxText"] = (_bytes, options) => {
      readerSignal = options?.signal;
      return new Promise(() => {});
    };
    const file = docxFile(zip([{ name: "word/document.xml", size: 10 }]));
    expect(await readIngestFile(file, { readers: { readDocxText }, docxTimeoutMs: 5 })).toEqual({
      ok: false,
      problem: "timeout",
    });
    expect(readerSignal?.aborted).toBe(true);
  });

  test("Stop on a Word file aborts the reader's own signal, so its worker is terminated", async () => {
    let readerSignal: AbortSignal | undefined;
    const readDocxText: IngestReaders["readDocxText"] = (_bytes, options) => {
      readerSignal = options?.signal;
      return new Promise(() => {});
    };
    const job = new AbortController();
    const file = docxFile(zip([{ name: "word/document.xml", size: 10 }]));
    const reading = readIngestFile(file, { readers: { readDocxText }, signal: job.signal });
    await Bun.sleep(1);
    expect(readerSignal?.aborted).toBe(false);
    job.abort();
    expect(readerSignal?.aborted).toBe(true);
    expect(await reading).toEqual({ ok: false, problem: "cancelled" });
  });

  test("the worker is built from this app's own docx.worker.ts, which loads mammoth", async () => {
    const dir = `${process.cwd()}/apps/web/components/ingest`;
    const source = await Bun.file(`${dir}/read-sources.ts`).text();
    expect(source).toContain('new Worker(new URL("./docx.worker.ts", import.meta.url)');
    const worker = await Bun.file(`${dir}/docx.worker.ts`).text();
    expect(worker).toContain('await import("mammoth")');
  });
});

// ---------------------------------------------------------------- photos

describe("a photo's size comes from its header", () => {
  test("PNG, JPEG, GIF and WebP headers are read; anything else is unknown", () => {
    expect(imageSize(png(1170, 20000))).toEqual({ width: 1170, height: 20000 });
    expect(imageSize(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 });
    expect(imageSize(Uint8Array.from([...ascii("GIF89a"), 0x20, 0x03, 0x58, 0x02]))).toEqual({
      width: 800,
      height: 600,
    });
    expect(imageSize(webp("VP8 ", 1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(imageSize(webp("VP8L", 300, 9000))).toEqual({ width: 300, height: 9000 });
    expect(imageSize(webp("VP8X", 70000, 2))).toEqual({ width: 70000, height: 2 });
    expect(imageSize(Uint8Array.of(1, 2, 3))).toBeNull();
    expect(imageSize(Uint8Array.of(0xff, 0xd8, 0xff))).toBeNull();
  });

  test("a phone photo turned a quarter by EXIF is measured the way it is shown", () => {
    expect(imageSize(jpeg(4032, 3024, 6))).toEqual({ width: 3024, height: 4032 });
    expect(imageSize(jpeg(4032, 3024, 3))).toEqual({ width: 4032, height: 3024 });
  });

  test("the decode size fits 2,000 wide by 4,000 tall, keeps the shape, never scales up", () => {
    expect(photoDecodeSize({ width: 1170, height: 20000 })).toEqual({ width: 234, height: 4000 });
    expect(photoDecodeSize({ width: 4032, height: 3024 })).toEqual({ width: 2000, height: 1500 });
    expect(photoDecodeSize({ width: 640, height: 480 })).toEqual({ width: 640, height: 480 });
    expect(photoDecodeSize({ width: 30000, height: 10 })).toEqual({ width: 2000, height: 1 });
  });
});

describe("preparePhoto", () => {
  const decoded: { options: unknown }[] = [];
  let drawn: { width: number; height: number } | null = null;
  let noContext = false;
  /** The browser's decoder stood in for: it honours the resize options, or the header size. */
  const install = (fullSize: { width: number; height: number }) => {
    decoded.length = 0;
    drawn = null;
    globals.createImageBitmap = async (
      _image: Blob,
      options?: { resizeWidth?: number; resizeHeight?: number }
    ) => {
      decoded.push({ options });
      return {
        width: options?.resizeWidth ?? fullSize.width,
        height: options?.resizeHeight ?? fullSize.height,
        close() {},
      };
    };
    globals.OffscreenCanvas = class {
      constructor(
        public width: number,
        public height: number
      ) {}
      getContext() {
        if (noContext) return null;
        return {
          drawImage: (_b: unknown, _x: number, _y: number, width: number, height: number) => {
            drawn = { width, height };
          },
        };
      }
      async convertToBlob() {
        return new Blob([Uint8Array.of(9)], { type: "image/png" });
      }
    };
  };
  const blob = (bytes: Uint8Array, type = "image/png") => new Blob([bytes], { type });

  test("a tall screenshot is decoded to fit 4,000 tall, not 2,000 wide", async () => {
    install({ width: 1170, height: 20000 });
    await preparePhoto(blob(png(1170, 20000)));
    expect(decoded).toEqual([
      { options: { resizeWidth: 234, resizeHeight: 4000, resizeQuality: "high" } },
    ]);
    expect(drawn).toEqual({ width: 234, height: 4000 });
  });

  test("a small photo is never scaled up", async () => {
    install({ width: 640, height: 480 });
    await preparePhoto(blob(jpeg(640, 480), "image/jpeg"));
    expect(drawn).toEqual({ width: 640, height: 480 });
  });

  test("over 40 megapixels is refused before anything is decoded", async () => {
    install({ width: 8000, height: 6000 });
    expect(PHOTO_MAX_PIXELS).toBe(40_000_000);
    await expect(preparePhoto(blob(png(8000, 6000)))).rejects.toThrow("pixels");
    expect(decoded).toEqual([]);
    const result = await readPhotoText(blob(png(8000, 6000)), {
      readers: { createOcrWorker: async () => ({ recognize: async () => ({ data: { text: "x" } }), terminate: async () => {} }) },
    });
    expect(result).toEqual({ ok: false, problem: "pixels" });
  });

  test("an unknown format is decoded by the browser, then bounded the same way", async () => {
    install({ width: 3000, height: 9000 });
    await preparePhoto(blob(Uint8Array.of(1, 2, 3), "image/heic"));
    expect(decoded).toEqual([{ options: undefined }]);
    expect(drawn).toEqual({ width: 1333, height: 4000 });
    install({ width: 10000, height: 10000 });
    await expect(preparePhoto(blob(Uint8Array.of(1, 2, 3), "image/heic"))).rejects.toThrow(
      "pixels"
    );
  });

  test("no 2D canvas is an error, never the full-size photo handed to the OCR", async () => {
    install({ width: 4032, height: 3024 });
    noContext = true;
    try {
      const recognize = mock(async () => ({ data: { text: "Cells" } }));
      const result = await readPhotoText(blob(jpeg(4032, 3024), "image/jpeg"), {
        readers: { createOcrWorker: async () => ({ recognize, terminate: async () => {} }) },
      });
      expect(result).toEqual({ ok: false, problem: "error" });
      expect(recognize).not.toHaveBeenCalled();
    } finally {
      noContext = false;
    }
  });
});

// ---------------------------------------------------------------- PDFs

/** A fictional PDF document, as pdf.js would hand it over. */
function fakeDoc(pages: string[]): PdfDocumentLike & { opened: number[] } {
  const opened: number[] = [];
  return {
    numPages: pages.length,
    opened,
    async getPage(n: number) {
      opened.push(n);
      return {
        getTextContent: async () => ({ items: [{ str: pages[n - 1] ?? "", hasEOL: false }] }),
        cleanup() {},
      };
    },
  };
}

describe("PDF reading stops at the text limit", () => {
  const options = () => ({
    maxPages: 100,
    signal: new AbortController().signal,
    onPage: () => {},
  });

  test("pages stop before the text passes 200 KB, so the sheet can say how many were read", async () => {
    const page = "a".repeat(90 * 1024);
    const doc = fakeDoc(Array.from({ length: 50 }, () => page));
    const read = await readPdfText(doc, options());
    expect(read.pageCount).toBe(50);
    expect(read.pages.length).toBe(2);
    expect(read.pages.join("\n\n").length).toBeLessThanOrEqual(INGEST_MAX_BYTES);
    // The third page was opened to measure it, and nothing after it.
    expect(doc.opened).toEqual([1, 2, 3]);
  });

  test("a short PDF reads every page", async () => {
    const read = await readPdfText(fakeDoc(["Cells", "Tissues"]), options());
    expect(read).toEqual({ pageCount: 2, pages: ["Cells", "Tissues"] });
  });

  test("a first page over the limit alone is kept, and nothing more is read", async () => {
    const doc = fakeDoc(["b".repeat(INGEST_MAX_BYTES + 1), "Two"]);
    const read = await readPdfText(doc, options());
    expect(read.pages.length).toBe(1);
    expect(doc.opened).toEqual([1]);
  });
});

// ---------------------------------------------------------------- Stop during a download

describe("Stop while a library is still downloading stops at once", () => {
  test("pdf.js: no worker and no parsing when stopped during its import()", async () => {
    const job = new AbortController();
    let loaded: () => void = () => {};
    const getDocument = mock(() => ({
      promise: new Promise<PdfDocumentLike>(() => {}),
      destroy: async () => {},
    }));
    const startWorker = mock(() => ({ terminate() {} }) as unknown as Worker);
    const deps: PdfjsDeps = {
      load: () =>
        new Promise((resolve) => {
          loaded = () => resolve({ PDFWorker: { create: () => ({ destroy() {} }) }, getDocument });
        }),
      startWorker,
    };
    const reading = readPdfjsPages(
      Uint8Array.of(1),
      { maxPages: 100, signal: job.signal, onPage: () => {} },
      deps
    );
    job.abort();
    loaded();
    await expect(reading).rejects.toThrow("cancelled");
    expect(startWorker).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
  });

  test("tesseract.js: no worker is created when stopped during its import()", async () => {
    const job = new AbortController();
    let loaded: () => void = () => {};
    const createWorker = mock(async () => ({}));
    const load = () =>
      new Promise<never>((resolve) => {
        loaded = () => resolve({ createWorker, OEM: { LSTM_ONLY: 1 } } as never);
      });
    const starting = createTesseractWorker(() => {}, job.signal, load);
    job.abort();
    loaded();
    await expect(starting).rejects.toThrow("cancelled");
    expect(createWorker).not.toHaveBeenCalled();
  });
});

describe("copy", () => {
  test("the file type message names .pdf and .docx, in English and Hebrew", () => {
    for (const copy of [en["ig.file.type"], he["ig.file.type"]]) {
      expect(copy).toContain(".pdf");
      expect(copy).toContain(".docx");
    }
  });

  test("the new messages have no em dashes", () => {
    const keys = ["ig.file.docxUnpacked", "ig.file.notDocx", "ig.file.timeout", "ig.photo.pixels"] as const;
    for (const key of keys) {
      expect(en[key]).not.toContain("—");
      expect(he[key]).not.toContain("—");
    }
  });
});
