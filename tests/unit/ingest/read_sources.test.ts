/**
 * IngestSheet browser readers (T8-T10 spec, S2): how a picked file's bytes become text. Bun has
 * File and TextDecoder but no FileReader, so a stand-in that reads the way browsers do (UTF-8
 * with replacement characters unless a BOM says otherwise) is installed for these tests only.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readIngestFile, readPhotoText } from "../../../apps/web/components/ingest/read-sources";

class BrowserLikeFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  readAsText(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const label = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : "utf-8";
      this.result = new TextDecoder(label).decode(bytes);
      this.onload?.();
    });
  }
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
  globals.FileReader = BrowserLikeFileReader;
});
afterAll(() => {
  if (hadReader) globals.FileReader = realReader;
  else delete globals.FileReader;
});

const file = (bytes: number[], name = "notes.txt") =>
  new File([Uint8Array.from(bytes)], name, { type: "text/plain" });

// "שלום עולם" in each encoding.
const WIN_1255 = [0xf9, 0xec, 0xe5, 0xed, 0x20, 0xf2, 0xe5, 0xec, 0xed];
const UTF_8 = [...new TextEncoder().encode("שלום עולם")];

describe("readIngestFile encodings", () => {
  test("a Windows-1255 Hebrew text file reads as Hebrew, not as replacement marks", async () => {
    expect(await readIngestFile(file(WIN_1255))).toEqual({
      ok: true,
      text: "שלום עולם",
      title: "notes",
    });
  });

  test("UTF-8 stays UTF-8, with or without a byte-order mark", async () => {
    const want = { ok: true, text: "שלום עולם", title: "notes" };
    expect(await readIngestFile(file(UTF_8))).toEqual(want);
    expect(await readIngestFile(file([0xef, 0xbb, 0xbf, ...UTF_8]))).toEqual(want);
  });

  test("UTF-16 with a byte-order mark still reads", async () => {
    const units = [..."Hi שלום"].flatMap((ch) => {
      const code = ch.charCodeAt(0);
      return [code & 0xff, code >> 8];
    });
    expect(await readIngestFile(file([0xff, 0xfe, ...units]))).toEqual({
      ok: true,
      text: "Hi שלום",
      title: "notes",
    });
  });

  test("bytes that are neither UTF-8 nor Windows-1255 are unreadable, said in words", async () => {
    // 0xFF is not a character in Windows-1255 and never valid in UTF-8.
    expect(await readIngestFile(file([0x61, 0xff, 0x62]))).toEqual({
      ok: false,
      problem: "unreadable",
    });
  });
});

describe("readPhotoText", () => {
  // The browser's text detector and bitmap decoder, stood in for: what was decoded, and how.
  const decoded: { size: number; options: unknown }[] = [];
  const saved: Record<string, unknown> = {};
  const KEYS = ["window", "TextDetector", "createImageBitmap"] as const;

  beforeAll(() => {
    for (const key of KEYS) saved[key] = globals[key];
    globals.window = globalThis;
    globals.TextDetector = class {
      async detect() {
        return [{ rawValue: "Chapter 4" }, { rawValue: "Cells divide." }];
      }
    };
    globals.createImageBitmap = async (image: Blob, options?: unknown) => {
      decoded.push({ size: image.size, options });
      return { close() {} };
    };
  });
  afterAll(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete globals[key];
      else globals[key] = saved[key];
    }
  });

  test("a photo over 15 MB is refused before it is decoded", async () => {
    decoded.length = 0;
    const big = new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: "image/jpeg" });
    expect(await readPhotoText(big)).toEqual({ ok: false, problem: "too_large" });
    expect(decoded).toEqual([]);
  });

  test("a photo is decoded at most 2,000 pixels wide, then read", async () => {
    decoded.length = 0;
    const photo = new Blob([Uint8Array.of(1, 2, 3)], { type: "image/png" });
    expect(await readPhotoText(photo)).toEqual({ ok: true, text: "Chapter 4\nCells divide." });
    expect(decoded).toEqual([{ size: 3, options: { resizeWidth: 2000, resizeQuality: "high" } }]);
  });
});
