/**
 * "This week at a glance" on a weekly page (components/notes/WeekGlance.tsx): what got finished
 * and how much focus time there was, day by day, from the person's own tasks and focus sessions.
 * Read only. No streaks, scores or comparisons with another week (HARD_RULES §1); a quiet week is
 * described, not judged.
 */

export type GlanceTask = { status: string; completedAt?: number };
export type GlanceBlock = { startedAtMs: number; durationMs: number };

export type GlanceDay = {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  startMs: number;
  endMs: number;
  done: number;
  focusMinutes: number;
  /** 0 nothing … 4 the most, for the day grid's dot size. */
  level: 0 | 1 | 2 | 3 | 4;
};

export type WeekGlance = {
  days: GlanceDay[];
  done: number;
  focusMinutes: number;
  /** Days with something finished or some focus time. */
  activeDays: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Local midnight of each day of the week that starts on `monday` (YYYY-MM-DD), and the next Monday. */
export function weekBounds(monday: string): number[] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(monday);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const first = new Date(y, mo, d);
  if (first.getFullYear() !== y || first.getMonth() !== mo || first.getDate() !== d) return null;
  // Day by day in local time, so a daylight-saving change gives a 23 or 25 hour day, not a shift.
  return Array.from({ length: 8 }, (_, i) => new Date(y, mo, d + i).getTime());
}

/** Something on a day: each finished task, and each 25 minutes of focus, is one. */
function levelOf(done: number, focusMinutes: number): GlanceDay["level"] {
  const amount = done + Math.floor(focusMinutes / 25);
  if (amount <= 0) return 0;
  if (amount === 1) return 1;
  if (amount === 2) return 2;
  if (amount <= 4) return 3;
  return 4;
}

export function weekGlance(monday: string, tasks: readonly GlanceTask[], blocks: readonly GlanceBlock[]): WeekGlance | null {
  const bounds = weekBounds(monday);
  if (!bounds) return null;
  const days: GlanceDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const startMs = bounds[i] as number;
    const endMs = bounds[i + 1] as number;
    const inDay = (ms: number | undefined) => ms !== undefined && ms >= startMs && ms < endMs;
    const done = tasks.filter((task) => task.status === "done" && inDay(task.completedAt)).length;
    const focusMs = blocks.filter((block) => inDay(block.startedAtMs)).reduce((sum, block) => sum + Math.max(0, block.durationMs), 0);
    const focusMinutes = Math.round(focusMs / 60_000);
    const date = new Date(startMs);
    days.push({
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      startMs,
      endMs,
      done,
      focusMinutes,
      level: levelOf(done, focusMinutes),
    });
  }
  return {
    days,
    done: days.reduce((sum, day) => sum + day.done, 0),
    focusMinutes: days.reduce((sum, day) => sum + day.focusMinutes, 0),
    activeDays: days.filter((day) => day.level > 0).length,
  };
}

/** "40 min" or "1 h 15 min", from the page language's two patterns. */
export function formatMinutes(minutes: number, patterns: { min: string; hmin: string }): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return patterns.min.replace("{m}", String(m));
  return patterns.hmin.replace("{h}", String(Math.floor(m / 60))).replace("{m}", String(m % 60));
}
