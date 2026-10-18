"use client";

import {
  decodeFileBytes,
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
} from "./ingest-text";

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
  /** Start an OCR worker for English and Hebrew. */
  createOcrWorker: (onProgress: (progress: OcrProgress) => void) => Promise<OcrWorkerLike>;
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
  /** The raw text of a Word .docx file. */
  readDocxText: (bytes: ArrayBuffer) => Promise<string>;
};

/** The widest a photo is decoded: enough for printed text, and a bounded bitmap in memory. */
export const PHOTO_DECODE_WIDTH = 2000;

/** OCR languages: English and Hebrew together, so mixed pages read in one pass. */
export const OCR_LANGUAGES = "eng+heb";

/**
 * RAM-ONLY: decode a photo into a bitmap at most PHOTO_DECODE_WIDTH wide, draw it once, close
 * the bitmap and hand back a PNG of that size, so the OCR never holds a 12-megapixel image.
 * Without createImageBitmap or OffscreenCanvas the photo goes to the OCR as it is.
 */
export async function preparePhoto(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") {
    return image;
  }
  const bitmap = await createImageBitmap(image, {
    resizeWidth: PHOTO_DECODE_WIDTH,
    resizeQuality: "high",
  });
  let canvas: OffscreenCanvas | null = null;
  try {
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) return image;
    context.drawImage(bitmap, 0, 0);
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
function tesseractApi(mod: TesseractModule): TesseractModule {
  return (mod as TesseractModule & { default?: TesseractModule }).default ?? mod;
}

async function createTesseractWorker(
  onProgress: (progress: OcrProgress) => void
): Promise<OcrWorkerLike> {
  const tesseract = tesseractApi(await import("tesseract.js"));
  // OEM 1 is the LSTM engine: the only one the Hebrew "best_int" data is trained for.
  return tesseract.createWorker(OCR_LANGUAGES, tesseract.OEM.LSTM_ONLY, {
    logger: (message) => {
      const reading = message.status === "recognizing text";
      onProgress({ stage: reading ? "reading" : "loading", ratio: message.progress });
    },
  });
}

async function readPdfjsPages(
  bytes: Uint8Array,
  {
    maxPages,
    signal,
    onPage,
  }: { maxPages: number; signal: AbortSignal; onPage: (done: number, total: number) => void }
): Promise<{ pageCount: number; pages: string[] }> {
  // The legacy build runs on the older phone browsers the app supports; the modern one needs
  // very recent JavaScript features.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const port = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), {
    type: "module",
  });
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
    const doc = await task.promise;
    const last = Math.min(doc.numPages, maxPages);
    const pages: string[] = [];
    for (let n = 1; n <= last && !signal.aborted; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      pages.push(pdfPageText(content.items as PdfTextItem[]));
      page.cleanup();
      onPage(n, last);
    }
    return { pageCount: doc.numPages, pages };
  } finally {
    signal.removeEventListener("abort", stop);
    await task.destroy().catch(() => {});
    worker.destroy();
    port.terminate();
  }
}

async function readMammothText(bytes: ArrayBuffer): Promise<string> {
  const mod = await import("mammoth");
  // mammoth is CommonJS: the bundler may put its exports on `default`.
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  return result.value;
}

/** The real readers. Tests and the gallery pass their own. */
export const defaultReaders: IngestReaders = {
  createOcrWorker: createTesseractWorker,
  preparePhoto,
  readPdfPages: readPdfjsPages,
  readDocxText: readMammothText,
};

// ---------------------------------------------------------------- files

/** How far reading a file has got, for the sheet's progress state. */
export type FileProgress = { kind: IngestSourceKind; done?: number; total?: number };

export type ReadOptions = {
  readers?: Partial<IngestReaders>;
  /** Abort to stop reading: the OCR worker is terminated and pdf.js stops. */
  signal?: AbortSignal;
};

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
  options: ReadOptions & { onProgress?: (progress: FileProgress) => void } = {}
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
      const raw = await readers.readDocxText(buffer);
      if (signal?.aborted) return { ok: false, problem: "cancelled" };
      return interpretDocx(file.name, raw);
    }
    const raw = decodeFileBytes(new Uint8Array(buffer));
    return raw === null
      ? { ok: false, problem: "unreadable" }
      : interpretFile(file.name, raw, file.type);
  } catch (error) {
    if ((error as { name?: string } | null)?.name === "PasswordException") {
      return { ok: false, problem: "locked" };
    }
    return { ok: false, problem: problemOr(signal, "unreadable") };
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
  | { ok: false; problem: "none" | "error" | "too_large" | "load" | "cancelled" };

/** Photos bigger than this aren't decoded at all (the sheet says "up to 15 MB"). */
export const INGEST_MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/**
 * RAM-ONLY: read the text in a photo on this device with tesseract.js (English and Hebrew).
 * The photo is decoded at a bounded size, read by a worker started for this photo alone, and
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
    const starting = readers.createOcrWorker((progress) => onProgress?.(progress));
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
  } catch {
    return { ok: false, problem: problemOr(signal, "error") };
  } finally {
    signal?.removeEventListener("abort", end);
    end();
  }
}
