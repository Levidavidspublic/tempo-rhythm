import type { TaskDoc } from "../firestore/task-doc";

export function pickOverdueTasks<T extends TaskDoc & { id: string }>(
  tasks: readonly T[],
  dayStartMs: number
): T[] {
  if (!Number.isFinite(dayStartMs)) return [];

  return tasks
    .filter(
      (task) =>
        typeof task.dueAt === "number" &&
        task.dueAt < dayStartMs &&
        (task.status === "todo" || task.status === "in_progress") &&
        task.deletedAt === undefined
    )
    .slice()
    .sort(
      (left, right) =>
        (left.dueAt as number) - (right.dueAt as number) || left.id.localeCompare(right.id)
    );
}

type OverdueSummary = {
  copyKey: "today.carriedOver.none" | "today.carriedOver.one" | "today.carriedOver.many";
  count: number;
};

export function overdueSummary(count: number): OverdueSummary {
  const normalizedCount = Math.max(0, Math.floor(count));
  const copyKey =
    normalizedCount === 0
      ? "today.carriedOver.none"
      : normalizedCount === 1
        ? "today.carriedOver.one"
        : "today.carriedOver.many";

  return { copyKey, count: normalizedCount };
}
