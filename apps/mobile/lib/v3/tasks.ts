/**
 * Task views for Today and Tasks (docs/design/v3/screens/mobile/today.html, tasks.html).
 * Pure: shapes rows from `tasks.list` / `tasks.listToday` without React Native.
 */

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type TaskLike = {
  _id: string;
  title: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  energy?: "low" | "medium" | "high";
  flexibility?: "fixed" | "elastic";
  /** Planned effort in ms. */
  timeEstimate?: number;
  dueAt?: number;
  completedAt?: number;
  projectName?: string;
  /** Set on a repeating task: completing it also creates the next one. */
  repeatCfgId?: string;
  createdAt: number;
  updatedAt: number;
};

export type TaskFilter = "all" | "today" | "upcoming" | "inbox";

export type TaskGroups<T> = { today: T[]; upcoming: T[]; inbox: T[]; doneToday: T[] };

export function isOpen(task: Pick<TaskLike, "status">): boolean {
  return task.status === "todo" || task.status === "in_progress";
}

/**
 * Groups for the Tasks tab. Open tasks due before tomorrow are Today (an earlier due date is
 * never shown as late); later ones are Coming up; tasks with no due date wait in the Inbox.
 */
export function groupTasks<T extends TaskLike>(tasks: readonly T[], todayStartMs: number, todayEndMs: number): TaskGroups<T> {
  const groups: TaskGroups<T> = { today: [], upcoming: [], inbox: [], doneToday: [] };
  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    if (task.status === "done") {
      const at = task.completedAt;
      if (at !== undefined && at >= todayStartMs && at < todayEndMs) groups.doneToday.push(task);
      continue;
    }
    if (task.dueAt === undefined) groups.inbox.push(task);
    else if (task.dueAt < todayEndMs) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  const byDue = (a: T, b: T) => (a.dueAt ?? 0) - (b.dueAt ?? 0) || a.createdAt - b.createdAt;
  groups.today.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.inbox.sort((a, b) => b.createdAt - a.createdAt);
  groups.doneToday.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return groups;
}

function matches(task: TaskLike, query: string): boolean {
  return task.title.toLocaleLowerCase().includes(query);
}

/** Applies the filter chip and the search box to the groups. Done today shows under All only. */
export function filterGroups<T extends TaskLike>(groups: TaskGroups<T>, filter: TaskFilter, search: string): TaskGroups<T> {
  const q = search.trim().toLocaleLowerCase();
  const keep = (rows: T[], on: boolean) => (on ? (q ? rows.filter((t) => matches(t, q)) : rows) : []);
  return {
    today: keep(groups.today, filter === "all" || filter === "today"),
    upcoming: keep(groups.upcoming, filter === "all" || filter === "upcoming"),
    inbox: keep(groups.inbox, filter === "all" || filter === "inbox"),
    doneToday: keep(groups.doneToday, filter === "all"),
  };
}

export function groupsAreEmpty(groups: TaskGroups<unknown>): boolean {
  return !groups.today.length && !groups.upcoming.length && !groups.inbox.length && !groups.doneToday.length;
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Next up: one open task. Started first, then important, then the earliest due; skipped ones last. */
export function pickNextUp<T extends TaskLike>(tasks: readonly T[], skipped: ReadonlySet<string>): T | null {
  const open = tasks.filter(isOpen);
  if (!open.length) return null;
  const rank = (t: T) => [
    skipped.has(t._id) ? 1 : 0,
    t.status === "in_progress" ? 0 : 1,
    PRIORITY_RANK[t.priority],
    t.dueAt ?? Number.MAX_SAFE_INTEGER,
    t.createdAt,
  ];
  return (
    [...open].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return (ra[i] as number) - (rb[i] as number);
      return 0;
    })[0] ?? null
  );
}

/** Which reason line Next up shows. */
export function nextUpReason(task: TaskLike): "started" | "high" | "due" {
  if (task.status === "in_progress") return "started";
  if (task.priority === "high") return "high";
  return "due";
}

/** Planned minutes (rounded), or null when the task has no estimate. */
export function taskMinutes(task: Pick<TaskLike, "timeEstimate">): number | null {
  const ms = task.timeEstimate;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.round(ms / 60_000));
}

/** Focus timer length: the estimate kept to 5..90 minutes, else 25. */
export function focusMinutes(task: Pick<TaskLike, "timeEstimate">): number {
  const minutes = taskMinutes(task);
  if (minutes === null) return 25;
  return Math.min(Math.max(minutes, 5), 90);
}

/** "m:ss" for a countdown (no leading zero on minutes, as the design writes "4:52"). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Task energy as the design's words. */
export function energyWord(energy: TaskLike["energy"]): "quiet" | "steady" | "push" {
  if (energy === "low") return "quiet";
  if (energy === "high") return "push";
  return "steady";
}

/** Day-plan energy (low / medium / high) <-> the dial words. */
export const ENERGY_TO_PLAN = { quiet: "low", steady: "medium", push: "high" } as const;
export function planEnergyWord(energy: "low" | "medium" | "high" | undefined): "quiet" | "steady" | "push" | null {
  if (energy === undefined) return null;
  return energyWord(energy);
}
