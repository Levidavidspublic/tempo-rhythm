export type PeriodType = "none" | "daily" | "weekly" | "monthly";
export type PeriodFilterValue = "all" | Exclude<PeriodType, "none">;

export function filterByPeriod<T extends { periodType: PeriodType }>(
  notes: readonly T[],
  type: PeriodFilterValue
): T[] {
  return notes.filter((note) => type === "all" || note.periodType === type);
}

// Lines that look like raw JSON (objects, arrays, string values, keys, closing brackets) are never
// shown as a preview. Markdown that merely starts with "[" ([[wiki]] links, [ ] checklists, [links](...))
// or a quoted sentence is still prose.
const JSON_LINE =
  /^(?:[{}\]]|\[\]|\[\s*(?:[{"\d-]|\[\s*[{"\d]|true\b|false\b|null\b)|"(?:[^"\\]|\\.)*"\s*(?::|,?$))/;

export function looksLikeJson(text: string): boolean {
  return JSON_LINE.test(text.trim());
}

export function plainPreview(body: string, empty = "No content yet."): string {
  let fenced = false;
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^(?:```|~~~)/.test(trimmed)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || !trimmed || looksLikeJson(trimmed)) continue;
    const plain = trimmed
      .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/, "")
      .replace(/^\[[ xX]\]\s+/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "");
    // Check again after removing list / quote / heading markers: `- {"a":1}` is still JSON.
    if (looksLikeJson(plain)) continue;
    if (plain) return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain;
  }
  return empty;
}
