import type { TaskStatus } from "../firestore/task-doc";

export type TodayTaskRow = {
  id: string;
  status: TaskStatus;
  dueAt?: number;
  deletedAt?: number;
};

function byDueTimeThenId<T extends TodayTaskRow>(left: T, right: T): number {
  const dueTimeDifference = (left.dueAt ?? 0) - (right.dueAt ?? 0);
  if (dueTimeDifference !== 0) return dueTimeDifference;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Pick tasks in the half-open due window [dueFrom, dueTo). */
export function pickTasksDueInRange<T extends TodayTaskRow>(
  rows: readonly T[],
  dueFrom: number,
  dueTo: number
): T[] {
  if (!Number.isFinite(dueFrom) || !Number.isFinite(dueTo) || dueFrom > dueTo) return [];

  return rows
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        row.status !== "cancelled" &&
        row.dueAt !== undefined &&
        row.dueAt >= dueFrom &&
        row.dueAt < dueTo
    )
    .sort(byDueTimeThenId);
}

/** Pick unfinished tasks due before the current day, oldest first. */
export function pickCarryOver<T extends TodayTaskRow>(
  rows: readonly T[],
  beforeMs: number,
  max = 50
): T[] {
  if (!Number.isFinite(beforeMs) || !Number.isFinite(max) || max <= 0) return [];

  return rows
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        row.dueAt !== undefined &&
        row.dueAt >= 0 &&
        row.dueAt < beforeMs &&
        (row.status === "todo" || row.status === "in_progress")
    )
    .sort(byDueTimeThenId)
    .slice(0, Math.floor(max));
}
