export const MAX_TOP_TASKS = 3;

/** Local calendar date as `YYYY-MM-DD` (never UTC, so late evenings keep today's key). */
export function toLocalDateKey(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds or removes `id`; refuses to grow past {@link MAX_TOP_TASKS}. Returns a new array. */
export function toggleTopTask<T extends string>(ids: readonly T[], id: T): T[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= MAX_TOP_TASKS) return [...ids];
  return [...ids, id];
}

/**
 * Drops picked ids that are no longer listed (completed, cancelled, deleted), so a
 * hidden task can never hold a slot the user has no way to free.
 */
export function pruneTopTasks<T extends string>(ids: readonly T[], listed: ReadonlySet<string>): T[] {
  return ids.filter((id) => listed.has(id));
}
