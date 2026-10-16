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

/** The most rows memory.list and memory.recall send back (MAX_LIMIT in convex/memory.ts). */
export const SERVER_ROW_LIMIT = 200;

/**
 * The word memory.recall searches for. It matches one lower-cased substring, so it gets the
 * longest word of the query (the rarest, usually) and the other words are checked here.
 */
export function recallNeedle(query: string): string {
  return normalizeForSearch(query)
    .split(" ")
    .reduce((longest, word) => (word.length > longest.length ? word : longest), "");
}

/**
 * Which memories a search finds. `recalled` is null when the loaded list is the whole set (the
 * server isn't asked), undefined while memory.recall is still on its way, else its rows. The
 * loaded matches come first, then the server's matches the list didn't have, each once. `more`
 * is true when the server stopped at its limit, so there may be further matches.
 */
export function searchMemories<T extends { _id: string; content: string }>(
  loaded: readonly T[],
  recalled: readonly T[] | null | undefined,
  query: string
): { rows: T[]; scope: "loaded" | "searching" | "all"; more: boolean } {
  const rows = loaded.filter((memory) => matchesSearch(memory.content, query));
  if (recalled === null) return { rows, scope: "loaded", more: false };
  if (recalled === undefined) return { rows, scope: "searching", more: false };
  const seen = new Set(rows.map((memory) => memory._id));
  for (const memory of recalled) {
    if (!seen.has(memory._id) && matchesSearch(memory.content, query)) {
      seen.add(memory._id);
      rows.push(memory);
    }
  }
  return { rows, scope: "all", more: recalled.length >= SERVER_ROW_LIMIT };
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
