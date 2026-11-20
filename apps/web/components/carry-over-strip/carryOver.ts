import { endOfLocalDayMs, startOfLocalDayMs } from "@/lib/localDay";

export type CarryOverGroup<T> = { dayStartMs: number; tasks: T[] };

/** Groups tasks by the local day of `dueAt`, newest day first. Tasks without `dueAt` are skipped. */
export function groupByLocalDay<T extends { dueAt?: number }>(tasks: T[]): CarryOverGroup<T>[] {
  const byDay = new Map<number, T[]>();
  for (const task of tasks) {
    if (task.dueAt === undefined) continue;
    const dayStartMs = startOfLocalDayMs(new Date(task.dueAt));
    const list = byDay.get(dayStartMs);
    if (list) list.push(task);
    else byDay.set(dayStartMs, [task]);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([dayStartMs, list]) => ({ dayStartMs, tasks: list }));
}

/** A due instant inside today's local day: 09:00 local, or `now` if that is later. */
export function todayDueAt(now: number): number {
  const nineAm = new Date(now);
  nineAm.setHours(9, 0, 0, 0);
  const due = Math.max(nineAm.getTime(), now);
  return Math.min(due, endOfLocalDayMs(new Date(now)) - 1);
}

/** Quiet weekday label, e.g. "Thursday". */
export function dayLabel(dayStartMs: number): string {
  return new Date(dayStartMs).toLocaleDateString(undefined, { weekday: "long" });
}
