/**
 * Pure helpers for the IngestSheet (T8-T10 spec, S2): turn a file, pasted text or a photo's
 * detected text into a safe page body. No React, no network, no storage.
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

/** The `accept` attribute for the File tab. */
export const INGEST_ACCEPT = [
  ...INGEST_EXTENSIONS,
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
].join(",");

export type IngestFileKind = "text" | "html";

export type IngestProblem = "type" | "empty" | "too_large" | "unreadable";

export type IngestResult =
  | { ok: true; text: string; title: string }
  | { ok: false; problem: IngestProblem };

const TITLE_MAX = 80;

/** Which reader a file needs, from its name (the type is a hint only), or null when unsupported. */
export function fileKind(name: string, type = ""): IngestFileKind | null {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot) : "";
  if (ext === ".html" || ext === ".htm") return "html";
  if ((INGEST_EXTENSIONS as readonly string[]).includes(ext)) return "text";
  if (!ext) {
    if (type === "text/html") return "html";
    if (type === "text/plain" || type === "text/markdown" || type === "text/csv") return "text";
  }
  return null;
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
  for (const raw of normaliseNewlines(text.slice(0, TITLE_SCAN_CHARS)).split("\n")) {
    const line = raw
      .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/[*_`]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (/[\p{L}\p{N}]/u.test(line) && !/^(`{3,}|~{3,})/.test(line)) return clip(line);
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

/** Turn a file's raw text into the import, or say what's wrong in one word. */
export function interpretFile(name: string, raw: string, type = ""): IngestResult {
  const kind = fileKind(name, type);
  if (!kind) return { ok: false, problem: "type" };
  const text = kind === "html" ? htmlToText(raw) : normaliseNewlines(raw);
  if (!text.trim()) return { ok: false, problem: "empty" };
  if (isTooLarge(text)) return { ok: false, problem: "too_large" };
  return { ok: true, text, title: deriveTitle(text, name) };
}
