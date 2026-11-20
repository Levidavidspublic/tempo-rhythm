import type { TaskDoc } from "../firestore/task-doc";

export type SubtaskRow = Pick<TaskDoc, "status" | "createdAt" | "parentTaskId" | "deletedAt"> & {
  id: string;
};

export type PickedSubtasks<T extends SubtaskRow> = {
  subtasks: T[];
  doneCount: number;
  openCount: number;
  cancelledCount: number;
  totalCount: number;
};

const EMPTY_RESULT = {
  subtasks: [],
  doneCount: 0,
  openCount: 0,
  cancelledCount: 0,
  totalCount: 0,
} as const;

function byOldestThenId<T extends SubtaskRow>(left: T, right: T): number {
  const createdAtDifference = left.createdAt - right.createdAt;
  if (createdAtDifference !== 0) return createdAtDifference;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function pickSubtasks<T extends SubtaskRow>(
  tasks: readonly T[],
  parentTaskId: string
): PickedSubtasks<T> {
  if (parentTaskId.length === 0 || parentTaskId.includes("/")) {
    return { ...EMPTY_RESULT, subtasks: [] };
  }

  const subtasks = tasks
    .filter(
      (task) =>
        task.parentTaskId === parentTaskId &&
        task.id !== parentTaskId &&
        task.deletedAt === undefined
    )
    .sort(byOldestThenId);

  let doneCount = 0;
  let openCount = 0;
  let cancelledCount = 0;

  for (const task of subtasks) {
    if (task.status === "done") doneCount += 1;
    else if (task.status === "cancelled") cancelledCount += 1;
    else openCount += 1;
  }

  return {
    subtasks,
    doneCount,
    openCount,
    cancelledCount,
    totalCount: subtasks.length,
  };
}
