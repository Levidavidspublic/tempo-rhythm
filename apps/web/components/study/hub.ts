import type { StudyBlockType } from "@tempo/utils";

/**
 * Pure pieces of the review hub (S19): what the focal card says, and the sets grouped by kind.
 * The shapes mirror `api.study.hub` (convex/study.ts) structurally, so the gallery and the tests
 * can pass plain objects.
 */

export type HubSet = {
  setId: string;
  noteId: string;
  kind: StudyBlockType;
  title: string;
  itemCount: number;
  dueCount: number;
  newCount: number;
  lastStudiedAt?: number;
  lastAttempt?: { percent: number; passed?: boolean; finishedAt: number };
};

export type HubData = {
  dueCount: number;
  newCount: number;
  reviewedToday: number;
  sets: readonly HubSet[];
};

/**
 * The focal card's state: cards due (Start review), only new cards waiting (Start review on new
 * cards), nothing to review today, or no sets at all (the empty state that teaches how to start).
 */
export type HubFocus =
  | { kind: "due"; due: number; fresh: number }
  | { kind: "new"; fresh: number }
  | { kind: "clear" }
  | { kind: "empty" };

export function hubFocus(hub: HubData): HubFocus {
  if (hub.sets.length === 0) return { kind: "empty" };
  if (hub.dueCount > 0) return { kind: "due", due: hub.dueCount, fresh: hub.newCount };
  if (hub.newCount > 0) return { kind: "new", fresh: hub.newCount };
  return { kind: "clear" };
}

export const KIND_ORDER: readonly StudyBlockType[] = ["flashcards", "quiz", "test"];

/**
 * Sets grouped by kind in a fixed order (flashcards, quizzes, practice tests), empty groups left
 * out. Inside a group: sets with cards due first, then the most recently studied, then by title.
 */
export function groupSets(sets: readonly HubSet[]): { kind: StudyBlockType; sets: HubSet[] }[] {
  const groups: { kind: StudyBlockType; sets: HubSet[] }[] = [];
  for (const kind of KIND_ORDER) {
    const inKind = sets
      .filter((set) => set.kind === kind)
      .sort(
        (a, b) =>
          Number(b.dueCount > 0) - Number(a.dueCount > 0) ||
          (b.lastStudiedAt ?? 0) - (a.lastStudiedAt ?? 0) ||
          a.title.localeCompare(b.title),
      );
    if (inKind.length > 0) groups.push({ kind, sets: inKind });
  }
  return groups;
}

/** Local midnight of the day `now` falls on: "reviewed today" counts from here. */
export function dayStart(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Where the review session goes: everything due, or one set. */
export function reviewHref(setId?: string): string {
  return setId ? `/study/review?set=${encodeURIComponent(setId)}` : "/study/review";
}

export function setHref(setId: string): string {
  return `/study/${encodeURIComponent(setId)}`;
}
