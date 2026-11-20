import type { TaskPriority, TaskStatus } from "../firestore/task-doc";

export type UndatedTaskRow = {
  id: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: number;
  dueAt?: number;
  deletedAt?: number;
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function byPriorityThenNewestThenId<T extends UndatedTaskRow>(left: T, right: T): number {
  const priorityDifference = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
  if (priorityDifference !== 0) return priorityDifference;

  const createdAtDifference = right.createdAt - left.createdAt;
  if (createdAtDifference !== 0) return createdAtDifference;

  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function pickUndatedTasks<T extends UndatedTaskRow>(
  rows: readonly T[],
  max = 50
): { tasks: T[]; count: number } {
  if (!Number.isFinite(max) || max <= 0) return { tasks: [], count: 0 };

  const matchingRows = rows
    .filter(
      (row) =>
        row.deletedAt === undefined &&
        row.dueAt === undefined &&
        (row.status === "todo" || row.status === "in_progress")
    )
    .sort(byPriorityThenNewestThenId);

  return {
    tasks: matchingRows.slice(0, Math.floor(max)),
    count: matchingRows.length,
  };
}
