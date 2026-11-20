export type GoalListRow = {
  id: string;
  status: "active" | "completed" | "archived";
  targetDate?: number;
  updatedAt: number;
  deletedAt?: number;
};

function compareIds(left: GoalListRow, right: GoalListRow): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function byTargetDateThenId<T extends GoalListRow>(left: T, right: T): number {
  const leftTargetDate = Number.isFinite(left.targetDate) ? left.targetDate : undefined;
  const rightTargetDate = Number.isFinite(right.targetDate) ? right.targetDate : undefined;

  if (leftTargetDate === undefined) {
    return rightTargetDate === undefined ? compareIds(left, right) : 1;
  }
  if (rightTargetDate === undefined) return -1;

  const targetDateDifference = leftTargetDate - rightTargetDate;
  return targetDateDifference !== 0 ? targetDateDifference : compareIds(left, right);
}

function byUpdatedAtDescendingThenId<T extends GoalListRow>(left: T, right: T): number {
  const updatedAtDifference = right.updatedAt - left.updatedAt;
  return updatedAtDifference !== 0 ? updatedAtDifference : compareIds(left, right);
}

export function pickGoalsForList<T extends GoalListRow>(rows: readonly T[]): {
  active: T[];
  completed: T[];
  activeCount: number;
  completedCount: number;
} {
  const liveRows = rows.filter(
    (row) => row.deletedAt === undefined && row.status !== "archived"
  );
  const active = liveRows.filter((row) => row.status === "active").sort(byTargetDateThenId);
  const completed = liveRows
    .filter((row) => row.status === "completed")
    .sort(byUpdatedAtDescendingThenId);

  return {
    active,
    completed,
    activeCount: active.length,
    completedCount: completed.length,
  };
}
