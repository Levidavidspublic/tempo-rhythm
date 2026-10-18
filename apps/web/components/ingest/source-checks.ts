/**
 * Cheap checks on a file's own bytes before a library decodes it (IngestSheet, T8-T10 spec, S2).
 * A small Word file can unpack to gigabytes, and a small photo can decode to a huge bitmap, so
 * the sizes the file itself declares are read first and anything too big is refused before
 * mammoth or the browser's image decoder sees it. Pure: no DOM, no network, no storage.
 */

// ---------------------------------------------------------------- Word .docx (a zip)

/**
 * The most a Word file's main text part (word/document.xml) may declare when unpacked
 * (EXTRAPOLATED: 4 MB of XML is a few hundred pages of plain text, more than the page's 200 KB
 * text limit; a review measured a 20 KB file repeating one paragraph at 3 s and 0.97 GB in
 * mammoth).
 */
export const DOCX_MAX_DOCUMENT_XML_BYTES = 4 * 1024 * 1024;

/** The most all of a Word file's parts may declare together when unpacked (EXTRAPOLATED). */
export const DOCX_MAX_UNPACKED_BYTES = 40 * 1024 * 1024;

/** What the zip's own table of contents says: fine to read, too big, or not a Word file. */
export type DocxCheck = "ok" | "too_big" | "not_docx";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIZE = 22;
/** The end record may be followed by a comment of up to 65,535 bytes. */
const EOCD_SEARCH = EOCD_SIZE + 0xffff;

/**
 * Read a .docx's zip central directory (the list of parts at the end of the file) and refuse it
 * when word/document.xml declares more than DOCX_MAX_DOCUMENT_XML_BYTES unpacked, when all parts
 * together declare more than DOCX_MAX_UNPACKED_BYTES, or when it isn't a zip with a
 * word/document.xml. Nothing is unpacked. ZIP64 markers (0xFFFF / 0xFFFFFFFF) are taken at face
 * value, so a file claiming 4 GB parts is "too_big"; no real Word file under 10 MB needs ZIP64.
 *
 * This trusts the sizes the file declares. A file that lies about them passes here; the reader
 * then runs in its own worker with a time limit (read-sources.ts), so it still can't hang the tab.
 */
export function checkDocxZip(bytes: Uint8Array): DocxCheck {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = bytes.byteLength;
  if (length < EOCD_SIZE) return "not_docx";
  let eocd = -1;
  const stop = Math.max(0, length - EOCD_SEARCH);
  for (let at = length - EOCD_SIZE; at >= stop; at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) return "not_docx";
  const entries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryStart = view.getUint32(eocd + 16, true);
  if (entries === 0xffff || directoryStart === 0xffffffff || directorySize === 0xffffffff) {
    return "too_big";
  }
  if (directoryStart + directorySize > eocd) return "not_docx";
  let at = directoryStart;
  let total = 0;
  let hasDocument = false;
  const names = new TextDecoder("utf-8");
  for (let n = 0; n < entries; n += 1) {
    if (at + 46 > eocd || view.getUint32(at, true) !== CENTRAL_SIGNATURE) return "not_docx";
    const unpacked = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    if (at + 46 + nameLength > eocd) return "not_docx";
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (name === "word/document.xml") {
      hasDocument = true;
      if (unpacked > DOCX_MAX_DOCUMENT_XML_BYTES) return "too_big";
    }
    total += unpacked;
    if (total > DOCX_MAX_UNPACKED_BYTES) return "too_big";
    at += 46 + nameLength + extraLength + commentLength;
  }
  return hasDocument ? "ok" : "not_docx";
}

// ---------------------------------------------------------------- photos

/** The widest a photo is decoded: enough for printed text, and a bounded bitmap in memory. */
export const PHOTO_DECODE_WIDTH = 2000;

/** The tallest a photo is decoded (EXTRAPOLATED: two phone screens of a long screenshot). */
export const PHOTO_DECODE_HEIGHT = 4000;

/**
 * Photos with more pixels than this aren't decoded at all (EXTRAPOLATED: 40 megapixels is above
 * any phone camera's normal mode; decoded, it is 160 MB of bitmap).
 */
export const PHOTO_MAX_PIXELS = 40_000_000;

export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | ((b[at + 2] ?? 0) << 16);
const u32be = (b: Uint8Array, at: number) => u16be(b, at) * 0x10000 + u16be(b, at + 2);
const u32le = (b: Uint8Array, at: number) => u16le(b, at) + u16le(b, at + 2) * 0x10000;
const ascii = (b: Uint8Array, at: number, text: string) =>
  [...text].every((ch, i) => b[at + i] === ch.charCodeAt(0));

/**
 * The EXIF orientation in a JPEG APP1 segment (1 to 8), or 1. Orientations 5 to 8 turn the
 * picture a quarter, so the browser shows it with width and height swapped.
 */
function exifOrientation(b: Uint8Array, start: number, end: number): number {
  if (!ascii(b, start, "Exif\0\0")) return 1;
  const tiff = start + 6;
  const little = ascii(b, tiff, "II");
  if (!little && !ascii(b, tiff, "MM")) return 1;
  const u16 = little ? u16le : u16be;
  const u32 = little ? u32le : u32be;
  const ifd = tiff + u32(b, tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(b, ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (u16(b, entry) === 0x0112) {
      const value = u16(b, entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

function jpegSize(b: Uint8Array): ImageSize | null {
  let at = 2;
  let orientation = 1;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      at += 2; // markers with no length
      continue;
    }
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    if (marker === 0xe1) orientation = exifOrientation(b, at + 4, at + 2 + length);
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC), carry the frame's size.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (at + 9 > b.length) return null;
      const height = u16be(b, at + 5);
      const width = u16be(b, at + 7);
      return orientation >= 5 ? { width: height, height: width } : { width, height };
    }
    at += 2 + length;
  }
  return null;
}

/**
 * A photo's width and height from its header bytes, as the browser will show it (a JPEG's EXIF
 * quarter turn applied): PNG (IHDR), JPEG (SOFn), WebP (VP8, VP8L, VP8X) and GIF. Null for any
 * other format, or a header too short or broken to read.
 */
export function imageSize(b: Uint8Array): ImageSize | null {
  const size = (width: number, height: number) =>
    width > 0 && height > 0 ? { width, height } : null;
  if (b.length >= 24 && b[0] === 0x89 && ascii(b, 1, "PNG\r\n\x1a\n") && ascii(b, 12, "IHDR")) {
    return size(u32be(b, 16), u32be(b, 20));
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
  if (b.length >= 10 && (ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a"))) {
    return size(u16le(b, 6), u16le(b, 8));
  }
  if (b.length >= 30 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) {
    if (ascii(b, 12, "VP8 ")) return size(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    if (ascii(b, 12, "VP8L") && b[20] === 0x2f) {
      const bits = u32le(b, 21);
      return size((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (ascii(b, 12, "VP8X")) return size(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

/** True when a photo this size has more pixels than PHOTO_MAX_PIXELS. */
export function hasTooManyPixels({ width, height }: ImageSize): boolean {
  return width * height > PHOTO_MAX_PIXELS;
}

/**
 * The size a photo is decoded at: scaled so it fits PHOTO_DECODE_WIDTH by PHOTO_DECODE_HEIGHT,
 * never scaled up, with the same shape.
 */
export function photoDecodeSize({ width, height }: ImageSize): ImageSize {
  const scale = Math.min(1, PHOTO_DECODE_WIDTH / width, PHOTO_DECODE_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
