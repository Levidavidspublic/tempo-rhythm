/**
 * Small display rules shared by the v3 mobile screens. Pure.
 */
import { addDays, localIsoDate } from "./dates";

/** Coach dial word: quiet 0–3, steady 4–7, push 8–10 (components.md, Dial). */
export function dialWord(value: number): "quiet" | "steady" | "push" {
  if (value <= 3) return "quiet";
  if (value <= 7) return "steady";
  return "push";
}

export function clampDial(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value)));
}

/** Offline means the app did connect once and the socket is down now (Convex connection state). */
export function isOffline(state: { isWebSocketConnected: boolean; hasEverConnected: boolean } | null | undefined): boolean {
  return !!state && state.hasEverConnected && !state.isWebSocketConnected;
}

/** Up to two initials for the avatar; never the word "User". */
export function initials(name: string | undefined | null): string {
  const words = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((w) => w && w !== "User" && w !== "there");
  if (!words.length) return "";
  const first = Array.from(words[0] ?? "")[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1] ?? "")[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

export type NoteKind = "daily" | "weekly" | "project" | "template" | "note";

export function noteKind(note: { pageType?: string; periodType?: string }): NoteKind {
  if (note.pageType === "daily" || note.periodType === "daily") return "daily";
  if (note.pageType === "weekly" || note.periodType === "weekly") return "weekly";
  if (note.pageType === "project") return "project";
  if (note.pageType === "template") return "template";
  return "note";
}

/** How "edited …" reads: a time today, "yesterday", a weekday within the week, else a date. */
export function editedWhen(
  updatedAt: number,
  now: number,
): { kind: "time" } | { kind: "yesterday" } | { kind: "day"; iso: string } | { kind: "date"; iso: string } {
  const today = localIsoDate(new Date(now));
  const iso = localIsoDate(new Date(updatedAt));
  if (iso === today) return { kind: "time" };
  if (iso === addDays(today, -1)) return { kind: "yesterday" };
  if (iso > addDays(today, -7) && iso < today) return { kind: "day", iso };
  return { kind: "date", iso };
}

/** Item counts per local date for a week strip. */
export function countByDate(startsAt: readonly number[], dates: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
  for (const ms of startsAt) {
    const iso = localIsoDate(new Date(ms));
    if (iso in out) out[iso] = (out[iso] ?? 0) + 1;
  }
  return out;
}

/** The most used tags, most frequent first (ties keep first-seen order), at most `limit`. */
export function topTags(tagLists: readonly (readonly string[])[], limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
