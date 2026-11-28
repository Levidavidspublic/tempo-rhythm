type HabitTodayRow = {
  id: string;
  name: string;
  lastCompletedAt?: number;
  deletedAt?: number;
};

export type HabitsForDay<T> = {
  todo: T[];
  done: T[];
  doneCount: number;
  total: number;
};

export function splitHabitsForDay<T extends HabitTodayRow>(
  rows: readonly T[],
  dayStartMs: number,
  dayEndMs: number
): HabitsForDay<T> {
  if (!Number.isFinite(dayStartMs) || !Number.isFinite(dayEndMs) || dayStartMs >= dayEndMs) {
    return { todo: [], done: [], doneCount: 0, total: 0 };
  }

  const byNameThenId = (left: T, right: T) =>
    left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  const todo: T[] = [];
  const done: T[] = [];

  for (const row of rows) {
    if (row.deletedAt !== undefined) continue;

    if (
      row.lastCompletedAt !== undefined &&
      row.lastCompletedAt >= dayStartMs &&
      row.lastCompletedAt < dayEndMs
    ) {
      done.push(row);
    } else {
      todo.push(row);
    }
  }

  todo.sort(byNameThenId);
  done.sort(byNameThenId);

  return { todo, done, doneCount: done.length, total: todo.length + done.length };
}
