/**
 * Recent activity and notifications (docs/design/v3/screens/web/activity.html,
 * notifications.html): group rows by local day, newest first.
 */
import { daysBefore, localDayStart } from "./screenState";

/** Recent activity covers the last seven local days, today included. */
export const ACTIVITY_DAYS = 7;
/** Rows shown before "Show older", and how many more each press reveals. */
export const ACTIVITY_FIRST_PAGE = 20;
export const ACTIVITY_STEP = 10;

export type ActivityKind = "task" | "note" | "habit" | "focus" | "calendar" | "goal";

export type ActivityItemLike = {
  id: string;
  kind: ActivityKind;
  action: string;
  title: string;
  href: string;
  occurredAt: number;
};

export type DayGroup<T> = { dayStartMs: number; daysAgo: number; items: T[] };

/** Rows from the last `days` local days, newest first, one group per day. */
export function groupByDay<T extends { occurredAt: number }>(
  items: readonly T[],
  todayStartMs: number,
  days = ACTIVITY_DAYS
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const sorted = [...items].sort((a, b) => b.occurredAt - a.occurredAt);
  for (const item of sorted) {
    const daysAgo = Math.max(0, daysBefore(todayStartMs, item.occurredAt));
    if (daysAgo > days - 1) continue;
    const dayStartMs = daysAgo === 0 ? todayStartMs : localDayStart(item.occurredAt);
    const last = groups.at(-1);
    if (last && last.dayStartMs === dayStartMs) last.items.push(item);
    else groups.push({ dayStartMs, daysAgo, items: [item] });
  }
  return groups;
}

/** The first `limit` rows across groups, keeping the day headings of the rows that show. */
export function firstRows<T>(
  groups: readonly DayGroup<T>[],
  limit: number
): { groups: DayGroup<T>[]; shown: number; total: number } {
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const out: DayGroup<T>[] = [];
  let left = Math.max(0, limit);
  for (const group of groups) {
    if (left === 0) break;
    const items = group.items.slice(0, left);
    left -= items.length;
    out.push({ ...group, items });
  }
  return { groups: out, shown: Math.min(total, Math.max(0, limit)), total };
}

/** The backend's action words (convex/activity.ts) mapped to translated phrases. */
const ACTION_KEYS = {
  "Completed task": "act.do.taskDone",
  "Updated task": "act.do.task",
  "Created note": "act.do.noteNew",
  "Updated note": "act.do.note",
  "Logged habit": "act.do.habit",
  Focused: "act.do.focus",
  "Updated event": "act.do.event",
  "Completed goal": "act.do.goalDone",
  "Updated goal": "act.do.goal",
} as const;

export type ActivityActionKey = (typeof ACTION_KEYS)[keyof typeof ACTION_KEYS];

const ACTION_KEY_MAP = new Map<string, ActivityActionKey>(Object.entries(ACTION_KEYS));

export function activityActionKey(action: string): ActivityActionKey | null {
  return ACTION_KEY_MAP.get(action) ?? null;
}

/** Notifications split into Today and Earlier, newest first in each. */
export function splitByToday<T extends { createdAt: number }>(
  items: readonly T[],
  todayStartMs: number
): { today: T[]; earlier: T[] } {
  const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
  return {
    today: sorted.filter((item) => item.createdAt >= todayStartMs),
    earlier: sorted.filter((item) => item.createdAt < todayStartMs),
  };
}
