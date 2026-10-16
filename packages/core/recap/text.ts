/**
 * Recap text, kitchen T4 (S16): markdown to readable blocks, and sentence splitting for English
 * and Hebrew. Plain TypeScript with no package of its own and no globals; import it by relative
 * path, like packages/core/srs.
 */

export type RecapLang = "en" | "he";

/** One readable piece of a page, in page order. */
export type RecapBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "definition"; term: string; meaning: string }
  | { type: "list"; items: string[] };

const HEBREW_LETTER = /[א-ת]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/** "he" when Hebrew letters outnumber Latin ones, else "en". */
export function detectLang(text: string): RecapLang {
  const he = text.match(HEBREW_LETTER)?.length ?? 0;
  const en = text.match(LATIN_LETTER)?.length ?? 0;
  return he > en ? "he" : "en";
}

/** Inline markdown to plain words: links keep their text, URLs, HTML and marks go. */
export function plainInline(text: string): string {
  return (
    text
      // Images keep their alt text; links keep their words, never the URL.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, page: string, label?: string) => label ?? page)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/?[A-Za-z][^>]*>/g, " ")
      .replace(/<(?:https?|mailto):[^>]*>/g, " ")
      .replace(/\b(?:https?:\/\/|www\.)\S+/g, " ")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/(\*\*|__)(.+?)\1/g, "$2")
      .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
      .replace(/~~(.+?)~~/g, "$1")
      .replace(/\[\^[^\]]*\]/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d{1,3}[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const RULE = /^\s{0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
/** "Term: meaning", the outline reader's definition line. The term is short and has no stop. */
const DEFINITION = /^([^:.!?]{1,60}?)\s*[:：]\s+(.+)$/;

function definitionOf(text: string): { term: string; meaning: string } | null {
  const match = DEFINITION.exec(text);
  if (!match) return null;
  const term = (match[1] ?? "").trim();
  const meaning = (match[2] ?? "").trim();
  if (!term || !meaning || term.split(/\s+/).length > 6) return null;
  return { term, meaning };
}

/**
 * The page as readable blocks. Code fences (including ```json tempo blocks) and HTML are left
 * out; a run of plain lines is one paragraph, except "Term: meaning" lines, which are each a
 * definition; consecutive list items make one list.
 */
export function readableBlocks(markdown: string): RecapBlock[] {
  const blocks: RecapBlock[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  let paragraph: string[] = [];
  let list: string[] | null = null;
  let fence: string | null = null;

  const flushParagraph = () => {
    const text = plainInline(paragraph.join(" "));
    paragraph = [];
    if (text) blocks.push({ type: "paragraph", text });
  };
  const flushList = () => {
    if (list && list.length > 0) blocks.push({ type: "list", items: list });
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const fenceMatch = FENCE.exec(raw);
    if (fence) {
      if (fenceMatch && fenceMatch[1]?.[0] === fence[0] && (fenceMatch[1]?.length ?? 0) >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      flush();
      fence = fenceMatch[1] ?? "```";
      continue;
    }
    const line = raw.replace(/^\s{0,3}>\s?/, "");
    if (line.trim() === "" || RULE.test(line) || TABLE_RULE.test(line)) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const text = plainInline(heading[2] ?? "");
      if (text) blocks.push({ type: "heading", level: heading[1]?.length ?? 1, text });
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const text = plainInline(item[1] ?? "");
      if (!text) continue;
      const definition = definitionOf(text);
      if (definition) {
        flushList();
        blocks.push({ type: "definition", ...definition });
      } else {
        list ??= [];
        list.push(text);
      }
      continue;
    }
    const cells = line.includes("|") ? line.split("|").map((cell) => cell.trim()).filter(Boolean) : null;
    const text = plainInline(cells && cells.length > 1 ? cells.join(", ") : line);
    if (!text) continue;
    const definition = definitionOf(text);
    if (definition) {
      flush();
      blocks.push({ type: "definition", ...definition });
      continue;
    }
    if (list && /^\s+/.test(raw) && paragraph.length === 0) {
      // An indented line under a list item continues that item.
      const last = list.length - 1;
      list[last] = `${list[last]} ${text}`;
      continue;
    }
    flushList();
    paragraph.push(text);
  }
  flush();
  return blocks;
}

const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "etc",
  "vs",
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "fig",
  "approx",
  "cf",
]);
/** Abbreviations only before a number ("no. 5", "st. 3"); anywhere else "no." and "st." end a sentence. */
const NUMBER_ABBREVIATIONS = new Set(["no", "st"]);

/** Sentence ends: . ? ! … and the Hebrew sof pasuq, with any closing quotes or brackets. */
const BOUNDARY = /[.?!…׃]+["'”’»)\]]*(?=\s|$)/g;

/**
 * Splits text into sentences after . ? ! … or the Hebrew sof pasuq when a space (or the end)
 * follows, so numbers like 3.5 and versions like v1.2 stay whole. A few English abbreviations
 * (e.g., Dr.) do not end a sentence, nor do "no." and "st." before a number. Works the same for
 * English and Hebrew.
 */
export function splitSentences(text: string, _lang: RecapLang = "en"): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let start = 0;
  for (const match of clean.matchAll(BOUNDARY)) {
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (match[0].startsWith(".") && match[0].length === 1) {
      const word = clean.slice(start, at).split(" ").at(-1)?.toLowerCase() ?? "";
      if (ABBREVIATIONS.has(word) || /^[a-z]$/i.test(word)) continue;
      if (NUMBER_ABBREVIATIONS.has(word) && /^ \d/.test(clean.slice(end))) continue;
    }
    const sentence = clean.slice(start, end).trim();
    if (sentence) out.push(sentence);
    start = end;
  }
  const rest = clean.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** A sentence's spoken length in words (at least 1). */
export function wordCount(text: string): number {
  return Math.max(1, text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length);
}

/** Joins list items into one sentence: "a, b and c" / "א, ב וג". */
export function joinItems(items: readonly string[], lang: RecapLang): string {
  const clean = items.map((item) => item.replace(/[.;,]+$/, "").trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return `${clean[0]}.`;
  const last = clean.at(-1) as string;
  const head = clean.slice(0, -1).join(", ");
  if (lang === "he") {
    const joined = /^[א-ת]/.test(last) ? `ו${last}` : `ו-${last}`;
    return `${head} ${joined}.`;
  }
  return `${head} and ${last}.`;
}
