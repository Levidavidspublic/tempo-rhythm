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

/**
 * The body with code (fenced blocks and inline code spans) blanked out, same length, so a
 * `[[...]]` written as code is not a link. Offsets stay those of the original body.
 */
function maskCode(body: string): string {
  const out = body.split("");
  const blank = (from: number, to: number) => {
    for (let i = from; i < to; i += 1) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  // Lines end at LF, CRLF or a lone CR: bodies keep their bytes, whatever the line ending.
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let fence: { marker: string; length: number } | null = null;
  let fenceStart = 0;
  for (let m = lines.exec(body); m !== null && m[0].length > 0; m = lines.exec(body)) {
    const line = m[0].replace(/(?:\r\n|\r|\n)$/, "");
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (open && open[1]![0] === fence.marker && open[1]!.length >= fence.length && line.trim() === open[1]) {
        blank(fenceStart, m.index + m[0].length);
        fence = null;
      }
      continue;
    }
    if (open) {
      fence = { marker: open[1]![0]!, length: open[1]!.length };
      fenceStart = m.index;
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
    const lineStart = page.body.lastIndexOf("\n", link.from - 1) + 1;
    const lineEndRaw = page.body.indexOf("\n", link.to);
    const lineEnd = lineEndRaw === -1 ? page.body.length : lineEndRaw;
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
