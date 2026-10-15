/**
 * Pure helpers for the today habit check-in strip.
 * A check-in counts for the local calendar day, not a rolling 24-hour window.
 */

export function localDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type HabitCheckInRef = {
  habitId: string;
  deletedAt?: number;
};

/** Habit ids that have a live check-in. Duplicate rows collapse to one id. */
export function checkedHabitIds(checkIns: readonly HabitCheckInRef[]): Set<string> {
  const ids = new Set<string>();
  for (const row of checkIns) {
    if (row.deletedAt !== undefined) continue;
    ids.add(row.habitId);
  }
  return ids;
}
