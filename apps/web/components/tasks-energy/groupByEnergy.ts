export type Energy = "low" | "medium" | "high";

export type EnergyTask = {
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  energy?: Energy;
  dueAt?: number;
};

export type EnergyGroups<T extends EnergyTask> = Record<Energy, T[]>;

const priorityRank: Record<Energy, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Groups open tasks by energy, with the most important and soonest-due tasks first. */
export function groupByEnergy<T extends EnergyTask>(
  tasks: readonly T[],
): EnergyGroups<T> {
  const groups: EnergyGroups<T> = { low: [], medium: [], high: [] };

  for (const task of tasks) {
    if (task.status === "todo" || task.status === "in_progress") {
      groups[task.energy ?? "medium"].push(task);
    }
  }

  for (const tasksAtEnergy of Object.values(groups)) {
    tasksAtEnergy.sort((left, right) => {
      const priorityDifference =
        priorityRank[left.priority] - priorityRank[right.priority];
      if (priorityDifference !== 0) return priorityDifference;

      return (
        (left.dueAt ?? Number.POSITIVE_INFINITY) -
        (right.dueAt ?? Number.POSITIVE_INFINITY)
      );
    });
  }

  return groups;
}
