import {
  type FocusBlockLike,
  focusMinutesByWeek,
  type RangeWindow,
  type TaskLike,
} from "@/lib/you/insights";

export type InsightsState = "loading" | "signed-out" | "empty" | "ready" | "error";

export type InsightsStateInput = {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /** `undefined` = loading or skipped, `null` = no Convex user row. */
  profile: unknown;
  summary:
    | {
        tasksOpen: number;
        tasksCompletedThisWeek: number;
        habitsTotal: number;
        goalsActive: number;
      }
    | null
    | undefined;
  /** The summary query threw, or loading ran past the allowed wait. */
  failed: boolean;
};

/**
 * Maps auth/profile/summary to one screen state. "loading" is only returned
 * while something is genuinely still in flight and nothing has failed, so the
 * skeleton can never be the answer once auth is done and the profile is null.
 */
export function deriveInsightsState(input: InsightsStateInput): InsightsState {
  const { isAuthLoading, isAuthenticated, profile, summary, failed } = input;
  if (failed) return "error";
  if (isAuthLoading) return "loading";
  if (!isAuthenticated) return "signed-out";
  if (profile === undefined) return "loading";
  if (profile === null) return "signed-out";
  if (summary === undefined) return "loading";
  if (summary === null) return "error";
  const nothingTrackedYet =
    summary.tasksOpen === 0 &&
    summary.tasksCompletedThisWeek === 0 &&
    summary.habitsTotal === 0 &&
    summary.goalsActive === 0;
  return nothingTrackedYet ? "empty" : "ready";
}

/**
 * The glance on /insights (PanelUI KPI cards and a Day Grid): the range's days, and the totals
 * the cards show. Same rows and windows as the charts it replaced, so the numbers match them:
 * the finished total is the weekday bars added up, the focus total the weekly line added up.
 * Nothing here scores or compares the person.
 */

export type InsightsLevel = 0 | 1 | 2 | 3 | 4;

export type InsightsDay = {
  /** Local midnight. */
  startMs: number;
  done: number;
  focusMinutes: number;
  /** 0 nothing … 4 the most, for the Day Grid's dot size. */
  level: InsightsLevel;
};

export type InsightsGlance = {
  /** The range's first Monday through today, one per day. */
  days: InsightsDay[];
  finished: number;
  finishedByWeek: number[];
  focusMinutes: number;
  /** focusMinutesByWeek, unchanged: the same numbers as the weekly line chart. */
  focusByWeek: number[];
  /** Days with something finished or some focus time (level above 0). */
  activeDays: number;
};

/** 13 weeks is 91 days; a bad window can never loop for ever. */
const MAX_DAYS = 7 * 14;

/** The weekly glance's rule (lib/week-glance.ts), so a day looks the same on both pages. */
export function dayLevel(done: number, focusMinutes: number): InsightsLevel {
  const amount = done + Math.floor(focusMinutes / 25);
  if (amount <= 0) return 0;
  if (amount === 1) return 1;
  if (amount === 2) return 2;
  if (amount <= 4) return 3;
  return 4;
}

/** Local midnight of each day from `startMs` up to `endMs`, day by day (DST-safe). */
export function dayStarts(startMs: number, endMs: number): number[] {
  const first = new Date(startMs);
  const out: number[] = [];
  for (let i = 0; i < MAX_DAYS; i += 1) {
    const ms = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime();
    if (!(ms < endMs)) break;
    out.push(ms);
  }
  return out;
}

/** Index of the day that holds `ms`, or -1 outside the days. */
function dayOf(starts: readonly number[], endMs: number, ms: number | undefined): number {
  if (ms === undefined || starts.length === 0 || ms < (starts[0] ?? 0) || ms >= endMs) return -1;
  let i = starts.length - 1;
  while (i > 0 && (starts[i] ?? 0) > ms) i -= 1;
  return i;
}

export function insightsGlance(
  tasks: readonly TaskLike[],
  blocks: readonly FocusBlockLike[],
  win: RangeWindow
): InsightsGlance {
  const starts = dayStarts(win.startMs, win.endMs);
  const done = starts.map(() => 0);
  const focusMs = starts.map(() => 0);
  for (const task of tasks) {
    if (task.status !== "done") continue;
    const i = dayOf(starts, win.endMs, task.completedAt);
    if (i >= 0) done[i] = (done[i] ?? 0) + 1;
  }
  for (const block of blocks) {
    const i = dayOf(starts, win.endMs, block.startedAtMs);
    if (i >= 0) focusMs[i] = (focusMs[i] ?? 0) + Math.max(0, block.durationMs);
  }
  const days = starts.map((startMs, i): InsightsDay => {
    const focusMinutes = Math.round((focusMs[i] ?? 0) / 60_000);
    return {
      startMs,
      done: done[i] ?? 0,
      focusMinutes,
      level: dayLevel(done[i] ?? 0, focusMinutes),
    };
  });
  const finishedByWeek = win.weekStarts.map((from, w) => {
    const to = win.weekStarts[w + 1] ?? win.endMs;
    return days
      .filter((day) => day.startMs >= from && day.startMs < to)
      .reduce((sum, day) => sum + day.done, 0);
  });
  const focusByWeek = focusMinutesByWeek(blocks, win.weekStarts, win.endMs);
  return {
    days,
    finished: days.reduce((sum, day) => sum + day.done, 0),
    finishedByWeek,
    focusMinutes: focusByWeek.reduce((sum, minutes) => sum + minutes, 0),
    focusByWeek,
    activeDays: days.filter((day) => day.level > 0).length,
  };
}
