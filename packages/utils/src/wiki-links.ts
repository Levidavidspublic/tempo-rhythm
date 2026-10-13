/**
 * [[links]] between Markdown pages (v3 OVERNIGHT-RUN.md decision 3). Shared by the web editor
 * and the Convex backlinks query, so both read links the same way. Links inside Tempo fences
 * are never links: blocks are found only through the shared codec.
 */
import { parseTempoBlocks } from "./blocks";

export type WikiLink = { title: string; from: number; to: number };
export type PageRef = { id: string; title: string; body: string };
export type Backlink = { id: string; title: string; context: string };

const WIKI = /\[\[([^[\]\n|]{1,200})(?:\|([^[\]\n]{1,200}))?\]\]/g;

/** Columns of leading whitespace, tabs to the next multiple of 4 (CommonMark). */
function indentOf(line: string, from = 0): number {
  let col = from;
  for (const ch of line) {
    if (ch === " ") col += 1;
    else if (ch === "\t") col += 4 - (col % 4);
    else break;
  }
  return col - from;
}

const LIST_MARKER = /^[ \t]*([-*+]|\d{1,9}[.)])([ \t]+|$)/;

/**
 * The column where a list item's content starts, or null when the line opens no item. A new
 * list that would interrupt a paragraph must start with a non-empty `-`, `*`, `+` or `1.` item.
 */
function listContentColumn(line: string, col: number, interrupts: boolean): number | null {
  const m = LIST_MARKER.exec(line);
  if (!m) return null;
  const empty = m[0].length === line.length;
  if (interrupts && (empty || (/^\d/.test(m[1]!) && !/^0*1[.)]$/.test(m[1]!)))) return null;
  const head = col + m[1]!.length;
  const gap = indentOf(m[2]!, head);
  // An empty item, or 5+ columns after the marker (indented code inside it): content starts one
  // column after the marker.
  return empty || gap >= 5 ? head + 1 : head + gap;
}

/**
 * The body with code (fenced blocks, indented code and inline code spans) blanked out, same
 * length, so a `[[...]]` written as code is not a link. Offsets stay those of the original body.
 */
function maskCode(body: string): string {
  const out = body.split("");
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i += 1) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  // Lines end at LF, CRLF or a lone CR: bodies keep their bytes, whatever the line ending.
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let fence: { marker: string; length: number; base: number } | null = null;
  let fenceStart = 0;
  // Content columns of the open list items, outermost first. Indented code is 4+ columns past
  // the innermost item's content, where no paragraph is open (it never continues one): after a
  // blank line, a heading or a fence.
  const items: number[] = [];
  let noPara = true;
  let codeBase: number | null = null;
  for (let m = lines.exec(body); m !== null && m[0].length > 0; m = lines.exec(body)) {
    const line = m[0].replace(/(?:\r\n|\r|\n)$/, "");
    const col = indentOf(line);
    if (fence && fence.base > 0 && line.trim() !== "" && col < fence.base) {
      // The list item holding the fence ended here, and the fence with it.
      blank(fenceStart, m.index);
      fence = null;
      noPara = true;
    }
    if (fence) {
      const close = /^(`{3,}|~{3,})$/.exec(line.trim());
      if (close && close[1]![0] === fence.marker && close[1]!.length >= fence.length && col < fence.base + 4) {
        blank(fenceStart, m.index + m[0].length);
        fence = null;
        noPara = true;
      }
      continue;
    }
    if (line.trim() === "") {
      if (codeBase !== null) blank(m.index, m.index + m[0].length);
      noPara = true;
      continue;
    }
    if (codeBase !== null) {
      if (col >= codeBase + 4) {
        blank(m.index, m.index + m[0].length);
        continue;
      }
      codeBase = null;
    }
    // With no paragraph to continue, a line indented less than an item's content is outside it.
    if (noPara) while (items.length > 0 && col < items[items.length - 1]!) items.pop();
    const base = items[items.length - 1] ?? 0;
    if (noPara && col >= base + 4) {
      codeBase = base;
      blank(m.index, m.index + m[0].length);
      continue;
    }
    const wasNoPara = noPara;
    noPara = false;
    if (col >= base + 4) continue; // continues a paragraph
    const open = /^(`{3,}|~{3,})/.exec(line.trimStart());
    const heading = /^#{1,6}(?:[ \t]|$)/.test(line.trimStart());
    if (open || heading || line.trimStart().startsWith(">")) {
      // A fence, a heading or a quote is never a lazy continuation: it leaves the items it is
      // not inside.
      while (items.length > 0 && col < items[items.length - 1]!) items.pop();
    }
    if (heading) {
      noPara = true;
      continue;
    }
    if (open) {
      fence = { marker: open[1]![0]!, length: open[1]!.length, base: items[items.length - 1] ?? 0 };
      fenceStart = m.index;
      continue;
    }
    // A marker at or past the innermost item's content starts a new list; one before it, a sibling.
    const newList = items.length === 0 || col >= items[items.length - 1]!;
    const content = listContentColumn(line, col, newList && !wasNoPara);
    if (content !== null) {
      while (items.length > 0 && col < items[items.length - 1]!) items.pop();
      items.push(content);
    }
  }
  if (fence) blank(fenceStart, body.length);
  const masked = out.join("");
  // A code span may run over line breaks inside its paragraph, but never across a blank line.
  // CRLF and lone CR count as line breaks too (bodies keep their bytes).
  return masked.replace(/(`+)(?:(?!\1)(?!(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n))[\s\S])+?\1/g, (span) =>
    span.replace(/[^\r\n]/g, " "),
  );
}

/** `[[Title]]` and `[[Title|shown text]]` outside Tempo fences and outside code. */
export function findWikiLinks(body: string): WikiLink[] {
  const blocks = parseTempoBlocks(body).filter((s) => s.kind !== "markdown");
  const text = maskCode(body);
  const out: WikiLink[] = [];
  WIKI.lastIndex = 0;
  for (let m = WIKI.exec(text); m !== null; m = WIKI.exec(text)) {
    const from = m.index;
    const to = from + m[0].length;
    if (blocks.some((b) => from < b.end && to > b.start)) continue;
    out.push({ title: (m[1] ?? "").trim(), from, to });
  }
  return out;
}

/**
 * Title identity for links: trimmed, case-folded without a locale, so a browser, a phone and
 * the Convex runtime always agree (a Turkish-locale browser folds "I" like everyone else).
 */
export function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

export function sameTitle(a: string, b: string): boolean {
  return titleKey(a) === titleKey(b);
}

/**
 * Whether `[[title]]` would point back at this title. Brackets, "|" (the alias separator) and
 * line breaks cannot appear inside a link, and a link target is at most 200 characters.
 */
export function isLinkableTitle(title: string): boolean {
  const t = title.trim();
  return t.length > 0 && t.length <= 200 && !/[[\]|\r\n]/.test(t);
}

/** Pages whose body links to `title`, with the line that holds the link as plain context. */
export function backlinksFor(title: string, selfId: string, pages: readonly PageRef[]): Backlink[] {
  if (!title.trim()) return [];
  const out: Backlink[] = [];
  for (const page of pages) {
    if (page.id === selfId) continue;
    // Cheap prefilter before the codec runs on the body.
    if (!page.body.includes("[[")) continue;
    const link = findWikiLinks(page.body).find((l) => sameTitle(l.title, title));
    if (!link) continue;
    // Line boundaries on LF, CRLF and lone CR alike.
    const lineStart = Math.max(page.body.lastIndexOf("\n", link.from - 1), page.body.lastIndexOf("\r", link.from - 1)) + 1;
    const ends = [page.body.indexOf("\n", link.to), page.body.indexOf("\r", link.to)].filter((i) => i !== -1);
    const lineEnd = ends.length > 0 ? Math.min(...ends) : page.body.length;
    const context = page.body
      .slice(lineStart, lineEnd)
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_whole, t: string, shown?: string) => shown ?? t)
      .replace(/^\s*(?:[-*+]|\d+\.|#{1,6}|>)\s+/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .trim();
    out.push({ id: page.id, title: page.title, context: context.slice(0, 160) });
  }
  return out;
}
