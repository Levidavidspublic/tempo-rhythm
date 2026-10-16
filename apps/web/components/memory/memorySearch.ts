/** Search and long-text helpers for "What Tempo remembers" (S31). */

/** Facts longer than this show the first lines and a "Show all" button. */
export const LONG_FACT_CHARS = 280;

/** Lower-cased, Hebrew points (niqqud) removed, runs of space folded, so "Tea" finds "tea". */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFC").replace(/[֑-ׇ]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** True when every word of the query appears somewhere in the memory. An empty query matches. */
export function matchesSearch(content: string, query: string): boolean {
  const needle = normalizeForSearch(query);
  if (!needle) return true;
  const haystack = normalizeForSearch(content);
  return needle.split(" ").every((word) => haystack.includes(word));
}

export function isLongFact(content: string): boolean {
  return content.length > LONG_FACT_CHARS;
}

/** Same limit as memory.update and memory.remember on the server (convex/memory.ts). */
export const EDIT_TEXT_MAX = 2000;

/** Checks edited words: trimmed, not empty, within the server's limit. */
export function checkEdit(
  text: string
): { ok: true; text: string } | { ok: false; problem: "empty" | "long" } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "empty" };
  if (trimmed.length > EDIT_TEXT_MAX) return { ok: false, problem: "long" };
  return { ok: true, text: trimmed };
}
