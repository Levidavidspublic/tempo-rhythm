export type CalibratedTask = {
  dueAt?: number;
  flexibility?: "fixed" | "elastic";
  priority: "low" | "medium" | "high";
};

const priorityRank: Record<CalibratedTask["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const dueTime = (task: CalibratedTask) => task.dueAt ?? Number.POSITIVE_INFINITY;

/** Split tasks for calibration. Older tasks without flexibility are flexible. */
export function splitByFlexibility<T extends CalibratedTask>(tasks: readonly T[]) {
  return {
    fixed: tasks.filter((task) => task.flexibility === "fixed"),
    elastic: tasks.filter((task) => task.flexibility !== "fixed"),
  };
}

/** Keep fixed commitments first, then flow flexible work by priority and due date. */
export function reflowElastic<T extends CalibratedTask>(fixed: readonly T[], elastic: readonly T[]) {
  const fixedByDueDate = [...fixed].sort((left, right) => dueTime(left) - dueTime(right));
  const elasticByPriority = [...elastic].sort(
    (left, right) =>
      priorityRank[left.priority] - priorityRank[right.priority] || dueTime(left) - dueTime(right)
  );

  return [...fixedByDueDate, ...elasticByPriority];
}
