import type { TaskStatus } from "../firestore/task-doc";

export type DoneTaskRow = {
  id: string;
  status: TaskStatus;
  completedAt?: number;
  deletedAt?: number;
};

function byCompletedTimeThenId<T extends DoneTaskRow>(left: T, right: T): number {
  const completedTimeDifference = (right.completedAt ?? 0) - (left.completedAt ?? 0);
  if (completedTimeDifference !== 0) return completedTimeDifference;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Pick completed tasks in the half-open completion window [doneFrom, doneTo). */
export function pickTasksDoneInRange<T extends DoneTaskRow>(
  rows: readonly T[],
  doneFrom: number,
  doneTo: number
): { tasks: T[]; count: number } {
  if (!Number.isFinite(doneFrom) || !Number.isFinite(doneTo) || doneFrom > doneTo) {
    return { tasks: [], count: 0 };
  }

  const tasks = rows
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        row.status === "done" &&
        typeof row.completedAt === "number" &&
        Number.isFinite(row.completedAt) &&
        row.completedAt >= doneFrom &&
        row.completedAt < doneTo
    )
    .sort(byCompletedTimeThenId);

  return { tasks, count: tasks.length };
}
