"use client";

import {
  decodeFileBytes,
  INGEST_MAX_BYTES,
  INGEST_MAX_PDF_PAGES,
  type IngestResult,
  type IngestSourceKind,
  ingestKind,
  interpretDocx,
  interpretFile,
  interpretPdf,
  isOldOfficeFile,
  maxFileBytes,
  type PdfTextItem,
  pdfPageText,
  photoText,
  textBytes,
} from "./ingest-text";
import { checkDocxZip, hasTooManyPixels, imageSize, photoDecodeSize } from "./source-checks";

/**
 * Browser readers for the IngestSheet. RAM-ONLY (HARD_RULES §6.4): a file or photo is read into
 * memory, turned into text and let go. Nothing is uploaded, cached or written to storage; only
 * the text the person keeps and saves becomes a page.
 *
 * The three libraries (tesseract.js for photos, pdf.js for PDFs, mammoth for Word .docx) are
 * each loaded with `import()` inside the function that needs it, so none of them is in the
 * app's main bundle; they download the first time someone reads that kind of file. Each sits
 * behind a small reader function (IngestReaders) so the logic around it is tested with fakes.
 *
 * Where code and models come from at runtime (never user data):
 * - pdf.js: its worker is a file of this app's own build (`new Worker(new URL(...))`).
 * - mammoth: runs in this app's own docx.worker.ts, built the same way.
 * - tesseract.js: its worker script, WASM core and the English and Hebrew language data come
 *   from cdn.jsdelivr.net (the library's defaults). The language data is kept in the browser's
 *   IndexedDB after the first read (the library's default), so later photos don't download it
 *   again; that cache holds the reader's models only, never a photo or its text.
 */

// ---------------------------------------------------------------- the readers (injectable)

/** Where photo reading is: getting the reader ready (first time: downloading it), or reading. */
export type OcrProgress = { stage: "loading" | "reading"; ratio: number };

/** The part of a tesseract.js worker the sheet uses. */
export type OcrWorkerLike = {
  recognize(image: Blob): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
};

export type IngestReaders = {
  /** Start an OCR worker for English and Hebrew. Abort `signal` to stop before it starts. */
  createOcrWorker: (
    onProgress: (progress: OcrProgress) => void,
    signal?: AbortSignal
  ) => Promise<OcrWorkerLike>;
  /** Decode a photo at a bounded size and hand back an image the OCR reads (see preparePhoto). */
  preparePhoto: (image: Blob) => Promise<Blob>;
  /** The text of a PDF's first `maxPages` pages, one string per page, and its page count. */
  readPdfPages: (
    bytes: Uint8Array,
    options: {
      maxPages: number;
      signal: AbortSignal;
      onPage: (done: number, total: number) => void;
    }
  ) => Promise<{ pageCount: number; pages: string[] }>;
  /** The raw text of a Word .docx file. Abort `signal` to stop it (its worker is terminated). */
  readDocxText: (bytes: ArrayBuffer, options?: { signal?: AbortSignal }) => Promise<string>;
};

/** OCR languages: English and Hebrew together, so mixed pages read in one pass. */
export const OCR_LANGUAGES = "eng+heb";

/** A file a reader refused from its own header, before decoding it (see source-checks.ts). */
export class IngestRefusal extends Error {
  constructor(readonly problem: "docx_too_big" | "not_docx" | "pixels") {
    super(problem);
    this.name = "IngestRefusal";
  }
}

/** The refusal's problem, if `error` is an IngestRefusal (by name: tests load modules twice). */
function refusalOf(error: unknown): IngestRefusal["problem"] | null {
  const refusal = error as { name?: string; problem?: IngestRefusal["problem"] } | null;
  return refusal?.name === "IngestRefusal" && refusal.problem ? refusal.problem : null;
}

const cancelled = () => new Error("cancelled");

/**
 * RAM-ONLY: decode a photo into a bitmap that fits PHOTO_DECODE_WIDTH by PHOTO_DECODE_HEIGHT,
 * never scaled up, draw it once, close the bitmap and hand back a PNG of that size, so the OCR
 * never holds a 12-megapixel image. The size comes from the photo's header first (source-checks
 * .ts): over PHOTO_MAX_PIXELS it is refused before anything is decoded. A format whose header
 * isn't known is decoded by the browser as it is, then refused or scaled down the same way.
 * Without createImageBitmap or OffscreenCanvas the photo goes to the OCR as it is; a canvas that
 * gives no 2D context is an error, never the full-size photo.
 */
export async function preparePhoto(image: Blob): Promise<Blob> {
  const declared = imageSize(new Uint8Array(await image.arrayBuffer()));
  if (declared && hasTooManyPixels(declared)) throw new IngestRefusal("pixels");
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    return image;
  }
  const target = declared ? photoDecodeSize(declared) : null;
  const bitmap = target
    ? await createImageBitmap(image, {
        resizeWidth: target.width,
        resizeHeight: target.height,
        resizeQuality: "high",
      })
    : await createImageBitmap(image);
  let canvas: OffscreenCanvas | null = null;
  try {
    const decoded = { width: bitmap.width, height: bitmap.height };
    if (hasTooManyPixels(decoded)) throw new IngestRefusal("pixels");
    const size = photoDecodeSize(decoded);
    canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D canvas to draw the photo on");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return await canvas.convertToBlob({ type: "image/png" });
  } finally {
    bitmap.close();
    // Let the canvas's pixels go now, not when it is collected.
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

type TesseractModule = typeof import("tesseract.js");

/** tesseract.js is CommonJS: the bundler may put its exports on `default`. */
async function loadTesseract(): Promise<TesseractModule> {
  const mod = await import("tesseract.js");
  return (mod as TesseractModule & { default?: TesseractModule }).default ?? mod;
}

/** tesseract.js's worker. `load` is the library (tests pass a stand-in). */
export async function createTesseractWorker(
  onProgress: (progress: OcrProgress) => void,
  signal?: AbortSignal,
  load: () => Promise<Pick<TesseractModule, "createWorker" | "OEM">> = loadTesseract
): Promise<OcrWorkerLike> {
  const tesseract = await load();
  // Stopped while the library was downloading: don't start a worker (and its downloads) at all.
  if (signal?.aborted) throw cancelled();
  // OEM 1 is the LSTM engine: the only one the Hebrew "best_int" data is trained for.
  return tesseract.createWorker(OCR_LANGUAGES, tesseract.OEM.LSTM_ONLY, {
    logger: (message) => {
      const reading = message.status === "recognizing text";
      onProgress({ stage: reading ? "reading" : "loading", ratio: message.progress });
    },
  });
}

/** The parts of a pdf.js document the reader uses. */
export type PdfDocumentLike = {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: unknown[] }>;
    cleanup(): unknown;
  }>;
};

/** The parts of pdf.js the reader uses, and its worker (tests pass stand-ins). */
export type PdfjsDeps = {
  load: () => Promise<{
    PDFWorker: { create(options: { port: Worker }): { destroy(): unknown } };
    getDocument(options: Record<string, unknown>): {
      promise: Promise<PdfDocumentLike>;
      destroy(): Promise<unknown>;
    };
  }>;
  startWorker: () => Worker;
};

const pdfjsDeps: PdfjsDeps = {
  // The legacy build runs on the older phone browsers the app supports; the modern one needs
  // very recent JavaScript features.
  load: async () =>
    (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as Awaited<
      ReturnType<PdfjsDeps["load"]>
    >,
  startWorker: () =>
    new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    }),
};

/**
 * A PDF's pages, read in order until `maxPages`, an abort, or the text passing the import's
 * limit (INGEST_MAX_BYTES): the page that would pass it is left out, so what was read can still
 * be saved and the sheet says how many pages that was. A first page over the limit alone is kept,
 * and the import then says the text is too large.
 */
export async function readPdfText(
  doc: PdfDocumentLike,
  {
    maxPages,
    signal,
    onPage,
  }: { maxPages: number; signal: AbortSignal; onPage: (done: number, total: number) => void }
): Promise<{ pageCount: number; pages: string[] }> {
  const last = Math.min(doc.numPages, maxPages);
  const pages: string[] = [];
  let bytes = 0;
  for (let n = 1; n <= last && !signal.aborted; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const text = pdfPageText(content.items as PdfTextItem[]);
    page.cleanup();
    // Pages are joined with a blank line ("\n\n", two bytes).
    bytes += textBytes(text) + (pages.length > 0 ? 2 : 0);
    if (bytes > INGEST_MAX_BYTES && pages.length > 0) break;
    pages.push(text);
    onPage(n, last);
    if (bytes > INGEST_MAX_BYTES) break;
  }
  return { pageCount: doc.numPages, pages };
}

export async function readPdfjsPages(
  bytes: Uint8Array,
  options: { maxPages: number; signal: AbortSignal; onPage: (done: number, total: number) => void },
  deps: PdfjsDeps = pdfjsDeps
): Promise<{ pageCount: number; pages: string[] }> {
  const { signal } = options;
  const pdfjs = await deps.load();
  // Stopped while pdf.js was downloading: stop at once, before pdf.js parses the file.
  if (signal.aborted) throw cancelled();
  const port = deps.startWorker();
  const worker = pdfjs.PDFWorker.create({ port });
  const task = pdfjs.getDocument({
    data: bytes,
    worker,
    // Only the text layer is read: no fonts, forms or image decoders are loaded, and nothing is
    // fetched (no CMap, font, colour-profile or WASM URLs are given).
    enableXfa: false,
    disableFontFace: true,
    useWorkerFetch: false,
    useWasm: false,
  });
  const stop = () => void task.destroy();
  signal.addEventListener("abort", stop, { once: true });
  try {
    return await readPdfText(await task.promise, options);
  } finally {
    signal.removeEventListener("abort", stop);
    await task.destroy().catch(() => {});
    worker.destroy();
    port.terminate();
  }
}

/** What docx.worker.ts sends back. */
type DocxReply = { ok: true; text: string } | { ok: false };

/** The part of a Web Worker the Word reader uses. */
export type DocxWorkerLike = {
  onmessage: ((event: MessageEvent<DocxReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ArrayBuffer, transfer: Transferable[]): void;
  terminate(): void;
};

function startDocxWorker(): DocxWorkerLike {
  return new Worker(new URL("./docx.worker.ts", import.meta.url), { type: "module" });
}

/**
 * mammoth in its own worker (docx.worker.ts), so even a file that unpacks to far more than it
 * declared can't freeze the page: the worker is terminated on abort (Stop, closing the sheet,
 * switching source, or readIngestFile's time limit). The bytes are moved to the worker, not
 * copied. `start` makes the worker (tests pass a stand-in).
 */
export function readDocxInWorker(
  bytes: ArrayBuffer,
  signal?: AbortSignal,
  start: () => DocxWorkerLike = startDocxWorker
): Promise<string> {
  if (signal?.aborted) return Promise.reject(cancelled());
  return new Promise<string>((resolve, reject) => {
    const worker = start();
    let ended = false;
    const end = (outcome: () => void) => {
      if (ended) return;
      ended = true;
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      outcome();
    };
    const onAbort = () => end(() => reject(cancelled()));
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = ({ data }) =>
      end(() => (data.ok ? resolve(data.text) : reject(new Error("unreadable"))));
    worker.onerror = () => end(() => reject(new Error("unreadable")));
    worker.postMessage(bytes, [bytes]);
  });
}

/** mammoth on this thread: only where the browser has no Web Workers at all. */
async function readMammothHere(bytes: ArrayBuffer): Promise<string> {
  const mod = await import("mammoth");
  // mammoth is CommonJS: the bundler may put its exports on `default`.
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  return result.value;
}

/**
 * A Word file's text: the zip's own list of parts is checked first (checkDocxZip), and a file
 * that would unpack too big, or isn't a Word file, is refused before mammoth sees it.
 */
async function readDocx(bytes: ArrayBuffer, options: { signal?: AbortSignal } = {}) {
  const check = checkDocxZip(new Uint8Array(bytes));
  if (check !== "ok") throw new IngestRefusal(check === "too_big" ? "docx_too_big" : "not_docx");
  if (typeof Worker !== "function") return readMammothHere(bytes);
  return readDocxInWorker(bytes, options.signal);
}

/** The real readers. Tests and the gallery pass their own. */
export const defaultReaders: IngestReaders = {
  createOcrWorker: (onProgress, signal) => createTesseractWorker(onProgress, signal),
  preparePhoto,
  readPdfPages: (bytes, options) => readPdfjsPages(bytes, options),
  readDocxText: readDocx,
};

// ---------------------------------------------------------------- files

/** How far reading a file has got, for the sheet's progress state. */
export type FileProgress = { kind: IngestSourceKind; done?: number; total?: number };

export type ReadOptions = {
  readers?: Partial<IngestReaders>;
  /** Abort to stop reading: the OCR and Word workers are terminated and pdf.js stops. */
  signal?: AbortSignal;
};

/**
 * A Word file still being read after this long is stopped and its worker terminated
 * (EXTRAPOLATED: a text-only .docx under the size caps reads in a second or two on a phone).
 */
export const DOCX_READ_TIMEOUT_MS = 20_000;

/** A file's bytes, read with FileReader (null when the browser couldn't read it). */
function readBytes(file: Blob): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result instanceof ArrayBuffer ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.onabort = () => resolve(null);
    try {
      reader.readAsArrayBuffer(file);
    } catch {
      resolve(null);
    }
  });
}

/**
 * `work`, or a rejection as soon as `signal` aborts: a terminated worker never answers, so the
 * read must not wait for it.
 */
function unlessAborted<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(new Error("cancelled"));
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(new Error("cancelled"));
    signal.addEventListener("abort", stop, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}

/** An error after the person stopped the reading is the stop, not a problem with the file. */
function problemOr<P extends string>(signal: AbortSignal | undefined, problem: P): P | "cancelled" {
  return signal?.aborted ? "cancelled" : problem;
}

/**
 * RAM-ONLY: read a picked file into the import. Text and web pages are decoded here (UTF-8, or
 * Windows-1255 for older Hebrew files; see decodeFileBytes); PDFs go to pdf.js (text layer only,
 * at most INGEST_MAX_PDF_PAGES pages) and Word .docx files to mammoth. Old .doc files are
 * refused before anything is read. The bytes are dropped once the text is out.
 */
export async function readIngestFile(
  file: File,
  options: ReadOptions & {
    onProgress?: (progress: FileProgress) => void;
    /** How long a Word file may take (default DOCX_READ_TIMEOUT_MS). */
    docxTimeoutMs?: number;
  } = {}
): Promise<IngestResult> {
  const { signal, onProgress } = options;
  const readers = { ...defaultReaders, ...options.readers };
  const kind = ingestKind(file.name, file.type);
  if (!kind) return { ok: false, problem: "type" };
  if (kind === "doc") return { ok: false, problem: "doc" };
  if (file.size === 0) return { ok: false, problem: "empty" };
  if (file.size > maxFileBytes(kind)) {
    return { ok: false, problem: kind === "pdf" || kind === "docx" ? "file_too_big" : "too_large" };
  }
  onProgress?.({ kind });
  const buffer = await readBytes(file);
  if (signal?.aborted) return { ok: false, problem: "cancelled" };
  if (!buffer) return { ok: false, problem: "unreadable" };
  try {
    if (kind === "pdf") {
      const read = await readers.readPdfPages(new Uint8Array(buffer), {
        maxPages: INGEST_MAX_PDF_PAGES,
        signal: signal ?? new AbortController().signal,
        onPage: (done, total) => onProgress?.({ kind, done, total }),
      });
      if (signal?.aborted) return { ok: false, problem: "cancelled" };
      return interpretPdf(file.name, read);
    }
    if (kind === "docx") {
      // A .doc saved under a .docx name: say so, instead of "couldn't be opened".
      if (isOldOfficeFile(new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength)))) {
        return { ok: false, problem: "doc" };
      }
      // The reader gets its own signal: Stop aborts it, and so does the time limit.
      const job = new AbortController();
      const stop = () => job.abort();
      signal?.addEventListener("abort", stop, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        job.abort();
      }, options.docxTimeoutMs ?? DOCX_READ_TIMEOUT_MS);
      try {
        const raw = await unlessAborted(
          readers.readDocxText(buffer, { signal: job.signal }),
          job.signal
        );
        if (signal?.aborted) return { ok: false, problem: "cancelled" };
        return interpretDocx(file.name, raw);
      } catch (error) {
        if (timedOut && !signal?.aborted) return { ok: false, problem: "timeout" };
        throw error;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", stop);
      }
    }
    const raw = decodeFileBytes(new Uint8Array(buffer));
    return raw === null
      ? { ok: false, problem: "unreadable" }
      : interpretFile(file.name, raw, file.type);
  } catch (error) {
    if (signal?.aborted) return { ok: false, problem: "cancelled" };
    const refused = refusalOf(error);
    if (refused === "docx_too_big" || refused === "not_docx") return { ok: false, problem: refused };
    if ((error as { name?: string } | null)?.name === "PasswordException") {
      return { ok: false, problem: "locked" };
    }
    return { ok: false, problem: "unreadable" };
  }
  // RAM-ONLY: nothing keeps the bytes after this returns (pdf.js moved its copy to its worker,
  // which is terminated), so they go with this call.
}

// ---------------------------------------------------------------- photos

/** True when this browser can run the photo reader (a web worker and WebAssembly). */
export function canReadPhotos(): boolean {
  return (
    typeof window !== "undefined" && typeof Worker === "function" && typeof WebAssembly === "object"
  );
}

export type PhotoResult =
  | { ok: true; text: string }
  | { ok: false; problem: "none" | "error" | "too_large" | "pixels" | "load" | "cancelled" };

/** Photos bigger than this aren't decoded at all (the sheet says "up to 15 MB"). */
export const INGEST_MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * RAM-ONLY: read the text in a photo on this device with tesseract.js (English and Hebrew).
 * The photo is decoded at a bounded size (one with more than PHOTO_MAX_PIXELS is refused as
 * "pixels"), read by a worker started for this photo alone, and
 * the worker is terminated afterwards (or straight away on abort); the photo never leaves the
 * browser. "load" means the reader itself couldn't start (for example offline the first time,
 * before its language data is on this device).
 */
export async function readPhotoText(
  image: Blob,
  options: ReadOptions & { onProgress?: (progress: OcrProgress) => void } = {}
): Promise<PhotoResult> {
  const { signal, onProgress } = options;
  const readers = { ...defaultReaders, ...options.readers };
  if (image.size > INGEST_MAX_PHOTO_BYTES) return { ok: false, problem: "too_large" };
  if (signal?.aborted) return { ok: false, problem: "cancelled" };
  let worker: OcrWorkerLike | null = null;
  let ended = false;
  const end = () => {
    if (ended || !worker) return;
    ended = true;
    void worker.terminate().catch(() => {});
  };
  signal?.addEventListener("abort", end);
  try {
    const prepared = await readers.preparePhoto(image);
    if (signal?.aborted) return { ok: false, problem: "cancelled" };
    onProgress?.({ stage: "loading", ratio: 0 });
    const starting = readers.createOcrWorker((progress) => onProgress?.(progress), signal);
    try {
      worker = await unlessAborted(starting, signal);
    } catch {
      // Stopped while the reader was starting: terminate it as soon as it exists.
      if (signal?.aborted) void starting.then((late) => late.terminate()).catch(() => {});
      return { ok: false, problem: problemOr(signal, "load") };
    }
    const { data } = await unlessAborted(worker.recognize(prepared), signal);
    if (signal?.aborted) return { ok: false, problem: "cancelled" };
    const text = photoText(data.text);
    return text ? { ok: true, text } : { ok: false, problem: "none" };
  } catch (error) {
    if (!signal?.aborted && refusalOf(error) === "pixels") return { ok: false, problem: "pixels" };
    return { ok: false, problem: problemOr(signal, "error") };
  } finally {
    signal?.removeEventListener("abort", end);
    end();
  }
}
