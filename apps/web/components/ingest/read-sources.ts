"use client";

import {
  decodeFileBytes,
  fileKind,
  INGEST_MAX_FILE_BYTES,
  type IngestResult,
  interpretFile,
  normaliseNewlines,
} from "./ingest-text";

/**
 * Browser readers for the IngestSheet. RAM-ONLY (HARD_RULES §6.4): a file or photo is read into
 * memory, turned into text and let go. Nothing is uploaded, cached or written to storage; only
 * the text the person keeps and saves becomes a page.
 */

/**
 * Read a picked file's bytes with FileReader, decode them (UTF-8, or Windows-1255 for older
 * Hebrew files; see decodeFileBytes) and turn the text into the import.
 */
export function readIngestFile(file: File): Promise<IngestResult> {
  if (!fileKind(file.name, file.type)) return Promise.resolve({ ok: false, problem: "type" });
  if (file.size === 0) return Promise.resolve({ ok: false, problem: "empty" });
  if (file.size > INGEST_MAX_FILE_BYTES)
    return Promise.resolve({ ok: false, problem: "too_large" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : null;
      const raw = bytes ? decodeFileBytes(bytes) : null;
      resolve(
        raw === null
          ? { ok: false, problem: "unreadable" }
          : interpretFile(file.name, raw, file.type)
      );
    };
    reader.onerror = () => resolve({ ok: false, problem: "unreadable" });
    reader.onabort = () => resolve({ ok: false, problem: "unreadable" });
    try {
      reader.readAsArrayBuffer(file);
    } catch {
      resolve({ ok: false, problem: "unreadable" });
    }
  });
}

type DetectedText = { rawValue?: string };
type TextDetectorLike = { detect(image: ImageBitmapSource): Promise<DetectedText[]> };
type TextDetectorCtor = new () => TextDetectorLike;

function textDetector(): TextDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { TextDetector?: unknown }).TextDetector;
  return typeof ctor === "function" ? (ctor as TextDetectorCtor) : null;
}

/** True when this browser has the built-in text detector (Shape Detection API). */
export function canReadPhotos(): boolean {
  return textDetector() !== null;
}

export type PhotoResult = { ok: true; text: string } | { ok: false; problem: "none" | "error" };

/**
 * RAM-ONLY: detect text in a photo on this device. The image is decoded into an in-memory
 * bitmap, read, and closed straight away; it never leaves the browser.
 */
export async function readPhotoText(image: Blob): Promise<PhotoResult> {
  const Detector = textDetector();
  if (!Detector) return { ok: false, problem: "error" };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(image);
    const found = await new Detector().detect(bitmap);
    const text = normaliseNewlines(
      found
        .map((item) => item.rawValue ?? "")
        .filter((line) => line.trim())
        .join("\n")
    );
    return text ? { ok: true, text } : { ok: false, problem: "none" };
  } catch {
    return { ok: false, problem: "error" };
  } finally {
    bitmap?.close();
  }
}
