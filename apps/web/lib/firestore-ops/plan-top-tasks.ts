import type { TaskStatus } from "../firestore/task-doc";

type PlanTaskRow = {
  id: string;
  status: TaskStatus;
  deletedAt?: number;
};

export function pickPlanTopTasks<T extends PlanTaskRow>(
  taskIds: readonly string[],
  rows: readonly T[]
): { tasks: T[]; doneCount: number; droppedCount: number } {
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const seenIds = new Set<string>();
  const tasks: T[] = [];
  let doneCount = 0;
  let droppedCount = 0;

  for (const id of taskIds) {
    if (tasks.length === 3) break;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const task = rowsById.get(id);
    if (!task || task.deletedAt !== undefined || task.status === "cancelled") {
      droppedCount += 1;
      continue;
    }

    tasks.push(task);
    if (task.status === "done") doneCount += 1;
  }

  return { tasks, doneCount, droppedCount };
}
