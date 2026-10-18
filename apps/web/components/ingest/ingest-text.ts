/**
 * Pure helpers for the IngestSheet (T8-T10 spec, S2): turn a file (text, web page, PDF, Word
 * .docx), pasted text or a photo's recognised text into a safe page body. No React, no network,
 * no storage; the libraries that read PDFs, Word files and photos live in read-sources.ts.
 *
 * RAM-ONLY (HARD_RULES §6.4): everything here works on strings in memory. Nothing in this file
 * writes the source anywhere; the sheet saves only the text the person checked and kept.
 */

/** The most text one import may carry, measured in UTF-8 bytes. */
export const INGEST_MAX_BYTES = 200 * 1024;

/**
 * Files bigger than this are not read at all. HTML shrinks a lot once its tags are gone, so the
 * raw file may be larger than the text limit; this only stops a huge file from filling memory.
 */
export const INGEST_MAX_FILE_BYTES = 2 * 1024 * 1024;

export const INGEST_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".html", ".htm"] as const;

/**
 * PDFs bigger than this aren't opened (EXTRAPOLATED: 20 MB holds a long text PDF, while a scan
 * that size has no text layer anyway). pdf.js keeps the whole file in memory while it reads.
 */
export const INGEST_MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * Only this many pages of a PDF are read (EXTRAPOLATED: 100 pages of text is about 200 KB, the
 * page's own limit, so reading further would only be cut off). The sheet says when it stopped.
 */
export const INGEST_MAX_PDF_PAGES = 100;

/** Word .docx files bigger than this aren't opened (EXTRAPOLATED: text-only .docx files are
 * small; most of a big one is pictures, which aren't read). */
export const INGEST_MAX_DOCX_BYTES = 10 * 1024 * 1024;

const PDF_TYPE = "application/pdf";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_TYPE = "application/msword";

/** The `accept` attribute for the File tab. Old .doc files aren't listed: they can't be read. */
export const INGEST_ACCEPT = [
  ...INGEST_EXTENSIONS,
  ".pdf",
  ".docx",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  PDF_TYPE,
  DOCX_TYPE,
].join(",");

/** The two kinds of text file, decoded as text (see fileKind). */
export type IngestFileKind = "text" | "html";

/** Every kind of file the File tab knows: text files, PDFs, Word .docx and old Word .doc. */
export type IngestSourceKind = IngestFileKind | "pdf" | "docx" | "doc";

export type IngestProblem =
  | "type"
  | "empty"
  | "too_large"
  | "unreadable"
  /** An old binary Word file (.doc): not supported, said plainly. */
  | "doc"
  /** A PDF with no text layer, such as a scan: a photo of the page can be read instead. */
  | "no_text"
  /** A PDF locked with a password. */
  | "locked"
  /** A PDF or Word file over its size cap (the text limit is "too_large"). */
  | "file_too_big"
  /** A Word file whose parts declare more than the reader unpacks (source-checks.ts). */
  | "docx_too_big"
  /** A .docx that isn't a zip with a word/document.xml in it. */
  | "not_docx"
  /** A Word file that took longer than DOCX_READ_TIMEOUT_MS to read. */
  | "timeout"
  /** The person stopped the reading. */
  | "cancelled";

export type IngestResult =
  | {
      ok: true;
      text: string;
      title: string;
      /** Set only when a PDF had more pages than were read (INGEST_MAX_PDF_PAGES). */
      pages?: { read: number; total: number };
    }
  | { ok: false; problem: IngestProblem };

const TITLE_MAX = 80;

function extension(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot) : "";
}

/**
 * Which text decoder a text file needs, from its name (the type is a hint only), or null when
 * it isn't a text file. PDFs and Word files are told apart by ingestKind.
 */
export function fileKind(name: string, type = ""): IngestFileKind | null {
  const ext = extension(name);
  if (ext === ".html" || ext === ".htm") return "html";
  if ((INGEST_EXTENSIONS as readonly string[]).includes(ext)) return "text";
  if (!ext) {
    if (type === "text/html") return "html";
    if (type === "text/plain" || type === "text/markdown" || type === "text/csv") return "text";
  }
  return null;
}

/** Which reader any picked file needs: a text kind, "pdf", "docx", "doc" (refused), or null. */
export function ingestKind(name: string, type = ""): IngestSourceKind | null {
  const text = fileKind(name, type);
  if (text) return text;
  const ext = extension(name);
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  if (ext === ".doc") return "doc";
  if (!ext) {
    if (type === PDF_TYPE) return "pdf";
    if (type === DOCX_TYPE) return "docx";
    if (type === DOC_TYPE) return "doc";
  }
  return null;
}

/** The size cap for a PDF or Word file, or null for text files (they have their own). */
export function maxFileBytes(kind: IngestSourceKind): number {
  if (kind === "pdf") return INGEST_MAX_PDF_BYTES;
  if (kind === "docx") return INGEST_MAX_DOCX_BYTES;
  return INGEST_MAX_FILE_BYTES;
}

/**
 * True for the old binary Office format (an OLE compound file: D0 CF 11 E0 A1 B1 1A E1). A .doc
 * renamed to .docx starts this way, and is refused like a .doc instead of failing to unzip.
 */
export function isOldOfficeFile(bytes: Uint8Array): boolean {
  const magic = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return bytes.length >= magic.length && magic.every((byte, i) => bytes[i] === byte);
}

/** True when the text has at least one letter or digit in any script. */
export function hasWords(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/** LF line endings, no byte-order mark, no NUL characters, at most one blank line in a row. */
export function normaliseNewlines(text: string): string {
  // trimEnd, not `/\s+$/`: V8 backtracks that regex over every run of spaces (seconds at 80k).
  return text
    .replace(/^\uFEFF/, "")
    .split(String.fromCharCode(0))
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]*(?=\n)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .trimEnd();
}

/**
 * Pasted or imported text must never become a Tempo block. A page block is a line that opens
 * with ```json tempo (packages/utils/src/blocks.ts); a backslash before the fence keeps the line
 * as plain text. Any indent, fence length, tilde fences and odd spacing are covered, wider than
 * the parser itself, so a near-miss can't slip through either.
 */
export function escapeTempoFences(text: string): string {
  return text.replace(/^([ \t]*)(`{3,}|~{3,})([ \t]*json[ \t]+tempo\b.*)$/gim, "$1\\$2$3");
}

/**
 * A text file's bytes as text: the encoding its byte-order mark names, else UTF-8, else
 * Windows-1255 (Hebrew saved by older Windows programs). Each decoder is strict, so a wrong
 * guess fails instead of filling the page with replacement marks. Null when none fits.
 */
export function decodeFileBytes(bytes: Uint8Array): string | null {
  const labels =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? ["utf-16le"]
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? ["utf-16be"]
        : ["utf-8", "windows-1255"];
  for (const label of labels) {
    try {
      return new TextDecoder(label, { fatal: true }).decode(bytes);
    } catch {
      // Not this encoding (or this browser doesn't know it): try the next one.
    }
  }
  return null;
}

/** Size of the text in UTF-8 bytes. */
export function textBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function isTooLarge(text: string): boolean {
  // UTF-8 never takes fewer bytes than UTF-16 code units, so past the limit in length there's no
  // need to encode (a pasted 5 MB text would otherwise be encoded on every key press).
  if (text.length > INGEST_MAX_BYTES) return true;
  return textBytes(text) > INGEST_MAX_BYTES;
}

/** The page body that gets saved: tidy newlines, and no tempo fences. */
export function toPageBody(text: string): string {
  return escapeTempoFences(normaliseNewlines(text));
}

function clip(title: string): string {
  if (title.length <= TITLE_MAX) return title;
  const cut = title.slice(0, TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  return (space > TITLE_MAX / 2 ? cut.slice(0, space) : cut).trimEnd();
}

/** How much of the text the title is looked for in: it runs on every key press. */
const TITLE_SCAN_CHARS = 4096;

/** A title from the file name (without its extension), else the first line with words. */
export function deriveTitle(text: string, fileName?: string): string {
  if (fileName) {
    const dot = fileName.lastIndexOf(".");
    const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (base) return clip(base);
  }
  // The fence of the code block we're inside (``` or ~~~, at least as long as the opener).
  let fence: string | null = null;
  for (const raw of normaliseNewlines(text.slice(0, TITLE_SCAN_CHARS)).split("\n")) {
    // Test for a fence before any marks are stripped: "```json tempo" would otherwise lose its
    // backticks and become the title "json tempo". Code is never the title.
    const [, marks = "", rest = ""] = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(raw) ?? [];
    if (fence) {
      // Only the same mark, at least as long and with nothing after it, closes the block.
      if (marks[0] === fence[0] && marks.length >= fence.length && !rest.trim()) fence = null;
      continue;
    }
    if (marks) {
      fence = marks;
      continue;
    }
    const line = raw
      .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/[*_`]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/[\p{L}\p{N}]/u.test(line)) return clip(line);
  }
  return "";
}

// ---------------------------------------------------------------- HTML to text

/** The parts of a DOM node the walker reads, so tests can pass a plain object tree. */
export type TextNodeLike = {
  nodeType: number;
  nodeName: string;
  nodeValue?: string | null;
  childNodes: ArrayLike<TextNodeLike>;
};

const SKIP = new Set([
  "HEAD",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "CANVAS",
  "BUTTON",
  "SELECT",
  "TEXTAREA",
]);

const BLOCK = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL",
]);

/** Walk a parsed document and keep only its readable text, one paragraph per block. */
export function nodeToText(root: TextNodeLike): string {
  let out = "";
  const visit = (node: TextNodeLike, pre: boolean) => {
    if (node.nodeType === 3) {
      const value = node.nodeValue ?? "";
      out += pre ? value : value.replace(/\s+/g, " ");
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    const name = node.nodeName.toUpperCase();
    if (SKIP.has(name)) return;
    if (name === "BR") {
      out += "\n";
      return;
    }
    const block = BLOCK.has(name);
    if (block) out += "\n\n";
    if (name === "LI") out += "- ";
    if (name === "TD" || name === "TH") out += " ";
    const inPre = pre || name === "PRE";
    for (let i = 0; i < node.childNodes.length; i += 1) {
      const child = node.childNodes[i];
      if (child) visit(child, inPre);
    }
    if (block) out += "\n\n";
  };
  visit(root, false);
  return normaliseNewlines(
    out
      .split("\n")
      .map((line) => line.replace(/ {2,}/g, " ").trim())
      .join("\n")
  ).replace(/^(- .*)\n\n(?=- )/gm, "$1\n");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1] === "x" || code[1] === "X"
          ? Number.parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Tag stripping without a DOM (server render, tests). Never evaluates anything. */
export function stripHtmlFallback(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(head|script|style|noscript|template|iframe|object|svg|canvas|button|select|textarea)\b[\s\S]*?<\/\1\s*>/gi,
      ""
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(
      /<\/?(address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tr|ul)\b[^>]*>/gi,
      "\n\n"
    )
    .replace(/<[^>]*>/g, " ");
  return normaliseNewlines(
    decodeEntities(text)
      .split("\n")
      .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
      .join("\n")
  ).replace(/^(- .*)\n\n(?=- )/gm, "$1\n");
}

/**
 * HTML to plain text. DOMParser builds an inert document: scripts never run, images and styles
 * never load. Without a DOMParser (server, tests) a tag stripper does the same job.
 */
export function htmlToText(html: string): string {
  if (typeof DOMParser === "function") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return nodeToText(doc.body ?? doc);
  }
  return stripHtmlFallback(html);
}

// ---------------------------------------------------------------- PDF, Word and photo text

/** One run of text in a PDF page's text layer, as pdf.js gives it (`getTextContent().items`). */
export type PdfTextItem = { str?: string; hasEOL?: boolean };

/** One page's text from its text-layer runs: a line break wherever pdf.js marks a line's end. */
export function pdfPageText(items: readonly PdfTextItem[]): string {
  let out = "";
  for (const item of items) {
    out += item.str ?? "";
    if (item.hasEOL) out += "\n";
  }
  return out
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n");
}

/**
 * A PDF's pages as the import. No letters or digits on any page means no text layer (a scan, or
 * pictures of text): "no_text", so the sheet can suggest a photo of the page instead.
 */
export function interpretPdf(
  name: string,
  read: { pageCount: number; pages: readonly string[] }
): IngestResult {
  const text = normaliseNewlines(read.pages.join("\n\n"));
  if (!hasWords(text)) return { ok: false, problem: "no_text" };
  if (isTooLarge(text)) return { ok: false, problem: "too_large" };
  const title = deriveTitle(text, name);
  return read.pageCount > read.pages.length
    ? { ok: true, text, title, pages: { read: read.pages.length, total: read.pageCount } }
    : { ok: true, text, title };
}

/** A Word file's raw text (mammoth's extractRawText) as the import. */
export function interpretDocx(name: string, raw: string): IngestResult {
  const text = normaliseNewlines(raw);
  if (!text.trim()) return { ok: false, problem: "empty" };
  if (isTooLarge(text)) return { ok: false, problem: "too_large" };
  return { ok: true, text, title: deriveTitle(text, name) };
}

/**
 * The text recognised in a photo, tidied: trimmed lines, no runs of blank lines. Null when it
 * has no letters or digits (OCR on a picture with no text tends to return stray marks).
 */
export function photoText(raw: string): string | null {
  const text = normaliseNewlines(
    raw
      .split("\n")
      .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
      .join("\n")
  );
  return hasWords(text) ? text : null;
}

/** Turn a file's raw text into the import, or say what's wrong in one word. */
export function interpretFile(name: string, raw: string, type = ""): IngestResult {
  const kind = fileKind(name, type);
  if (!kind) return { ok: false, problem: "type" };
  const text = kind === "html" ? htmlToText(raw) : normaliseNewlines(raw);
  if (!text.trim()) return { ok: false, problem: "empty" };
  if (isTooLarge(text)) return { ok: false, problem: "too_large" };
  return { ok: true, text, title: deriveTitle(text, name) };
}
