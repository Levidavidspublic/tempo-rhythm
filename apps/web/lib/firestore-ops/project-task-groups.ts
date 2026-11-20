import type { TaskDoc } from "../firestore/task-doc";

export type ProjectTaskRow = TaskDoc & { id: string };

export type ProjectTaskGroup<T extends ProjectTaskRow> = {
  projectId: string | null;
  projectName: string;
  tasks: T[];
  count: number;
};

function compareIds(left: ProjectTaskRow, right: ProjectTaskRow): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function byDueDateThenNewestThenId<T extends ProjectTaskRow>(left: T, right: T): number {
  if (left.dueAt !== undefined) {
    if (right.dueAt === undefined) return -1;
    const dueAtDifference = left.dueAt - right.dueAt;
    return dueAtDifference !== 0 ? dueAtDifference : compareIds(left, right);
  }
  if (right.dueAt !== undefined) return 1;

  const createdAtDifference = right.createdAt - left.createdAt;
  return createdAtDifference !== 0 ? createdAtDifference : compareIds(left, right);
}

function projectNameFor<T extends ProjectTaskRow>(tasks: readonly T[]): string {
  let newestNamedTask: T | undefined;
  for (const task of tasks) {
    if (!task.projectName?.trim()) continue;
    if (
      newestNamedTask === undefined ||
      task.updatedAt > newestNamedTask.updatedAt ||
      (task.updatedAt === newestNamedTask.updatedAt && task.id < newestNamedTask.id)
    ) {
      newestNamedTask = task;
    }
  }
  return newestNamedTask?.projectName?.trim() ?? "";
}

export function groupTasksByProject<T extends ProjectTaskRow>(
  tasks: readonly T[]
): {
  groups: ProjectTaskGroup<T>[];
  totalCount: number;
} {
  const groupedTasks = new Map<string | null, T[]>();

  for (const task of tasks) {
    if (task.deletedAt !== undefined || (task.status !== "todo" && task.status !== "in_progress")) {
      continue;
    }

    const projectId = task.projectId ? task.projectId : null;
    const group = groupedTasks.get(projectId);
    if (group) group.push(task);
    else groupedTasks.set(projectId, [task]);
  }

  const groups = Array.from(groupedTasks, ([projectId, groupTasks]) => ({
    projectId,
    projectName: projectNameFor(groupTasks),
    tasks: [...groupTasks].sort(byDueDateThenNewestThenId),
    count: groupTasks.length,
  })).sort((left, right) => {
    if (left.projectId === null) return right.projectId === null ? 0 : 1;
    if (right.projectId === null) return -1;

    const nameDifference = left.projectName.localeCompare(right.projectName, undefined, {
      sensitivity: "base",
    });
    if (nameDifference !== 0) return nameDifference;
    return left.projectId < right.projectId ? -1 : left.projectId > right.projectId ? 1 : 0;
  });

  return { groups, totalCount: groups.reduce((total, group) => total + group.count, 0) };
}
