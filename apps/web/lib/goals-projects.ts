/**
 * Pure helpers for the v3 Goals and Projects screens (docs/design/v3/screens/web/goals*.html,
 * projects.html, project-detail.html, project-kanban.html). Kept out of the components so
 * `bun run test` (which covers apps/web/lib) can test them.
 *
 * Data reality (convex/schema.ts): a goal has a title, a description ("why") and a status
 * (active | completed | archived). There is no projects table: a project is the set of tasks
 * that share a `projectId` (a slug), named by their `projectName`. Goals and projects are not
 * linked in the schema, so nothing here pretends they are.
 */
import { titleFromProjectSlug } from "./task-view-filters";

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */

export type GoalStoredStatus = "active" | "completed" | "archived";
/** The words the design uses: Active, Resting (paused / put away for now), Done. */
export type GoalStatus = "active" | "resting" | "done";
export type GoalFilter = "all" | GoalStatus;

export const GOAL_FILTERS: readonly GoalFilter[] = ["all", "active", "resting", "done"];
export const GOAL_STATUSES: readonly GoalStatus[] = ["active", "resting", "done"];

export function goalStatus(stored: GoalStoredStatus): GoalStatus {
  if (stored === "completed") return "done";
  if (stored === "archived") return "resting";
  return "active";
}

export function storedGoalStatus(status: GoalStatus): GoalStoredStatus {
  if (status === "done") return "completed";
  if (status === "resting") return "archived";
  return "active";
}

export function isGoalFilter(value: unknown): value is GoalFilter {
  return value === "all" || value === "active" || value === "resting" || value === "done";
}

export function filterGoals<T extends { status: GoalStoredStatus }>(
  goals: readonly T[],
  filter: GoalFilter,
): T[] {
  if (filter === "all") return [...goals];
  return goals.filter((goal) => goalStatus(goal.status) === filter);
}

/* ------------------------------------------------------------------ */
/* Projects (tasks grouped by projectId)                               */
/* ------------------------------------------------------------------ */

/** Idea and Paused have no stored source yet; a project is Done when every live task is done. */
export type ProjectStatus = "idea" | "active" | "paused" | "done";
export type ProjectFilter = "all" | "active" | "paused" | "done";

export const PROJECT_FILTERS: readonly ProjectFilter[] = ["all", "active", "paused", "done"];

export function isProjectFilter(value: unknown): value is ProjectFilter {
  return value === "all" || value === "active" || value === "paused" || value === "done";
}

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";

export type ProjectTask = {
  projectId?: string;
  projectName?: string;
  status: TaskStatus;
  updatedAt: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  done: number;
  /** Live tasks: everything except cancelled. */
  total: number;
  status: ProjectStatus;
  updatedAt: number;
};

/** Idea while nothing is planned yet, Done when every live task is done, else Active. */
export function projectStatusFor(done: number, total: number): ProjectStatus {
  if (total === 0) return "idea";
  return done === total ? "done" : "active";
}

/** One summary per projectId, newest activity first. Cancelled tasks don't count. */
export function summarizeProjects(tasks: readonly ProjectTask[]): ProjectSummary[] {
  const byId = new Map<string, { name?: string; nameAt: number; done: number; total: number; updatedAt: number }>();
  for (const task of tasks) {
    const id = task.projectId?.trim();
    if (!id) continue;
    const row = byId.get(id) ?? { nameAt: -1, done: 0, total: 0, updatedAt: 0 };
    const name = task.projectName?.trim();
    if (name && task.updatedAt > row.nameAt) {
      row.name = name;
      row.nameAt = task.updatedAt;
    }
    if (task.status !== "cancelled") {
      row.total += 1;
      if (task.status === "done") row.done += 1;
    }
    row.updatedAt = Math.max(row.updatedAt, task.updatedAt);
    byId.set(id, row);
  }
  return [...byId.entries()]
    .map(([id, row]) => ({
      id,
      name: row.name ?? titleFromProjectSlug(id),
      done: row.done,
      total: row.total,
      status: projectStatusFor(row.done, row.total),
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function filterProjects<T extends { status: ProjectStatus }>(
  projects: readonly T[],
  filter: ProjectFilter,
): T[] {
  if (filter === "all") return [...projects];
  return projects.filter((project) => project.status === filter);
}

/** A project page's task block: open tasks in the order they were added, then done ones. */
export function orderProjectTasks<
  T extends { status: TaskStatus; createdAt: number; completedAt?: number },
>(tasks: readonly T[]): T[] {
  const live = tasks.filter((task) => task.status !== "cancelled");
  const open = live.filter((task) => task.status !== "done").sort((a, b) => a.createdAt - b.createdAt);
  const done = live
    .filter((task) => task.status === "done")
    .sort((a, b) => (a.completedAt ?? a.createdAt) - (b.completedAt ?? b.createdAt));
  return [...open, ...done];
}

/** The newest stored name among a project's tasks, else a title made from its slug. */
export function projectNameFor(tasks: readonly ProjectTask[], projectId: string): string {
  let name: string | undefined;
  let at = -1;
  for (const task of tasks) {
    const value = task.projectName?.trim();
    if (value && task.updatedAt > at) {
      name = value;
      at = task.updatedAt;
    }
  }
  return name ?? titleFromProjectSlug(projectId);
}

/** A fresh projectId for a new project: slug-safe whatever the name's script. */
export function newProjectId(nowMs: number, random: number): string {
  const tail = Math.floor(random * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `project-${nowMs.toString(36)}${tail}`;
}

/** True for ids made by {@link newProjectId}: such a project has no name until its first task. */
export function isNewProjectId(projectId: string): boolean {
  return /^project-[a-z0-9]{5,}$/.test(projectId);
}

/* ------------------------------------------------------------------ */
/* Board (To do / Doing / Done)                                        */
/* ------------------------------------------------------------------ */

export const BOARD_COLUMNS = ["todo", "in_progress", "done"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export function isBoardColumn(status: TaskStatus): status is BoardColumn {
  return status === "todo" || status === "in_progress" || status === "done";
}

/** The column a card lands in when moved one step; null at the edge. */
export function neighbourColumn(column: BoardColumn, dir: "prev" | "next"): BoardColumn | null {
  const index = BOARD_COLUMNS.indexOf(column) + (dir === "prev" ? -1 : 1);
  return index >= 0 && index < BOARD_COLUMNS.length ? BOARD_COLUMNS[index]! : null;
}

/**
 * The status a move's Undo puts back, or null when the move gets no Undo: finishing a repeating
 * task also makes its next one, which moving the card back could not take back.
 */
export function moveUndoStatus(
  task: { status: TaskStatus; repeatCfgId?: unknown },
  to: BoardColumn,
): TaskStatus | null {
  if (task.status === to) return null;
  if (to === "done" && task.repeatCfgId !== undefined) return null;
  return task.status;
}

/** The three board columns. Set-aside (cancelled) tasks are not on the board. */
export function groupBoard<T extends { status: TaskStatus }>(tasks: readonly T[]): Record<BoardColumn, T[]> {
  const groups: Record<BoardColumn, T[]> = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) {
    if (isBoardColumn(task.status)) groups[task.status].push(task);
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Small formatting helpers                                            */
/* ------------------------------------------------------------------ */

/** Whole minutes from a stored estimate in ms; null when there is none. */
export function minutesFromEstimate(ms: number | undefined): number | null {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.round(ms / 60_000));
}

/** "m:ss" left on an Undo window. */
export function formatCountdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type DayLabel = { kind: "today" } | { kind: "day"; weekday: string; day: number };

/** "Today", or a short weekday plus the day of the month ("Wed 14"; Hebrew "ד׳ 14"). */
export function dayLabel(ms: number, todayStartMs: number, todayEndMs: number, lang: "en" | "he"): DayLabel {
  if (ms >= todayStartMs && ms < todayEndMs) return { kind: "today" };
  const date = new Date(ms);
  const weekday = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    weekday: lang === "he" ? "narrow" : "short",
  }).format(date);
  return { kind: "day", weekday, day: date.getDate() };
}

/** Replaces `{name}` placeholders. */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/* ------------------------------------------------------------------ */
/* Goals progress: small steps done per week                           */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 local time of the week containing `ms`. */
export function weekStartMs(ms: number): number {
  const date = new Date(ms);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** ISO 8601 week number of the local calendar date of `ms`. */
export function isoWeekOf(ms: number): number {
  const local = new Date(ms);
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
}

export type WeekPoint = { startMs: number; week: number; count: number };

/** The last `weeks` local weeks (oldest first, this week last) with tasks finished in each. */
export function stepsByWeek(
  tasks: readonly { status: TaskStatus; completedAt?: number }[],
  nowMs: number,
  weeks: number,
): WeekPoint[] {
  const thisWeek = weekStartMs(nowMs);
  const starts: number[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    // Step back by calendar days, not 7 * 24 h, so a DST change never skips a week.
    const date = new Date(thisWeek);
    date.setDate(date.getDate() - 7 * i);
    starts.push(date.getTime());
  }
  const points = starts.map((startMs) => ({ startMs, week: isoWeekOf(startMs), count: 0 }));
  const first = starts[0] ?? thisWeek;
  for (const task of tasks) {
    if (task.status !== "done" || task.completedAt === undefined) continue;
    if (task.completedAt < first) continue;
    const start = weekStartMs(task.completedAt);
    const point = points.find((p) => p.startMs === start);
    if (point) point.count += 1;
  }
  return points;
}

export type WeeklySummary =
  | { key: "gp.line.none"; params: Record<string, number> }
  | { key: "gp.line.same"; params: { n: number } }
  | { key: "gp.line.range"; params: { min: number; max: number } }
  | { key: "gp.line.rangeWeeks"; params: { min: number; max: number; weeks: number } };

/** The chart in words: never a score, never "behind". */
export function weeklySummary(points: readonly WeekPoint[]): WeeklySummary {
  const counts = points.map((p) => p.count);
  const max = counts.length ? Math.max(...counts) : 0;
  const min = counts.length ? Math.min(...counts) : 0;
  if (max === 0) return { key: "gp.line.none", params: {} };
  if (min === max) return { key: "gp.line.same", params: { n: max } };
  if (points.length > 4) return { key: "gp.line.rangeWeeks", params: { min, max, weeks: points.length } };
  return { key: "gp.line.range", params: { min, max } };
}

/** SVG coordinates for the line chart, in the design's 400 x 210 viewBox. */
export function linePoints(points: readonly WeekPoint[]): { x: number; y: number; count: number; week: number }[] {
  const left = 30;
  const width = 360;
  const axisY = 180;
  const topY = 60;
  const max = Math.max(1, ...points.map((p) => p.count));
  const slot = points.length ? width / points.length : width;
  return points.map((p, i) => ({
    x: Math.round(left + slot * (i + 0.5)),
    y: Math.round(axisY - (p.count / max) * (axisY - topY)),
    count: p.count,
    week: p.week,
  }));
}
