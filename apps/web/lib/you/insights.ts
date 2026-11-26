/**
 * Insights (docs/design/v3/screens/web/insights.html): the numbers behind the gentle patterns
 * and the two charts. Pure functions over rows the screen already reads (tasks.list and
 * focusBlocks.listInRange), in local time. Nothing here scores or compares the person.
 */

export type InsightsRange = "2w" | "4w" | "3m";

export const INSIGHTS_RANGES: readonly InsightsRange[] = ["2w", "4w", "3m"];

/** Whole weeks, ending with this week. 13 weeks stays inside focusBlocks.listInRange's 93 days. */
export const RANGE_WEEKS: Record<InsightsRange, number> = { "2w": 2, "4w": 4, "3m": 13 };

export function isInsightsRange(value: unknown): value is InsightsRange {
  return value === "2w" || value === "4w" || value === "3m";
}

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export type RangeWindow = { startMs: number; endMs: number; weekStarts: number[] };

/** Monday 00:00 of the first week, the end of today, and each week's Monday (local time). */
export function rangeWindow(range: InsightsRange, now: Date): RangeWindow {
  const weeks = RANGE_WEEKS[range];
  const offset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const weekStarts = Array.from({ length: weeks }, (_, i) =>
    new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() - 7 * (weeks - 1 - i)
    ).getTime()
  );
  const endMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return { startMs: weekStarts[0] ?? monday.getTime(), endMs, weekStarts };
}

export type TaskLike = {
  status: "todo" | "in_progress" | "done" | "cancelled";
  completedAt?: number;
  timeEstimate?: number;
  createdAt: number;
};

export type FocusBlockLike = { startedAtMs: number; durationMs: number };

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

function finishedIn(tasks: readonly TaskLike[], startMs: number, endMs: number): number[] {
  const out: number[] = [];
  for (const task of tasks) {
    const at = task.completedAt;
    if (task.status === "done" && at !== undefined && at >= startMs && at < endMs) out.push(at);
  }
  return out;
}

export type WeekdayBar = { day: number; value: number; pct: number; highlight: boolean };

/** Finished tasks per weekday, Monday first; the fullest day(s) are highlighted. */
export function weekdayBars(
  tasks: readonly TaskLike[],
  startMs: number,
  endMs: number
): WeekdayBar[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const at of finishedIn(tasks, startMs, endMs)) {
    const day = weekdayIndex(at);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  const max = Math.max(...counts);
  return counts.map((value, day) => ({
    day,
    value,
    pct: max > 0 ? Math.round((value / max) * 100) : 0,
    highlight: max > 0 && value === max,
  }));
}

export type WeekdaySummary =
  | { kind: "none" }
  | { kind: "top"; days: number[]; weekendLight: boolean }
  | { kind: "even" };

/** What the bar chart says in words. Never a judgment: a light weekend is "fine". */
export function summarizeWeekdays(bars: readonly WeekdayBar[]): WeekdaySummary {
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  if (max === 0) return { kind: "none" };
  const days = bars.filter((bar) => bar.value === max).map((bar) => bar.day);
  if (days.length > 2) return { kind: "even" };
  const weekend = bars.filter((bar) => bar.day >= 5);
  const weekendLight =
    !days.some((day) => day >= 5) && weekend.every((bar) => bar.value <= max / 2);
  return { kind: "top", days, weekendLight };
}

/** Focus minutes per week (week i runs from its Monday to the next one, the last to `endMs`). */
export function focusMinutesByWeek(
  blocks: readonly FocusBlockLike[],
  weekStarts: readonly number[],
  endMs: number
): number[] {
  const totals = weekStarts.map(() => 0);
  for (const block of blocks) {
    for (let i = 0; i < weekStarts.length; i++) {
      const from = weekStarts[i] ?? 0;
      const to = weekStarts[i + 1] ?? endMs;
      if (block.startedAtMs >= from && block.startedAtMs < to) {
        totals[i] = (totals[i] ?? 0) + Math.max(0, block.durationMs);
        break;
      }
    }
  }
  return totals.map((ms) => Math.round(ms / MINUTE_MS));
}

export type LinePoint = { x: number; y: number; value: number };

/** Points in the design's 400 × 210 viewBox: x from 60 to 360, the tallest value at y = 52. */
export function linePoints(values: readonly number[]): LinePoint[] {
  const max = Math.max(0, ...values);
  const n = values.length;
  return values.map((value, i) => ({
    value,
    x: n <= 1 ? 210 : Math.round((60 + (i * 300) / (n - 1)) * 10) / 10,
    y: Math.round((180 - (max > 0 ? (value / max) * 128 : 0)) * 10) / 10,
  }));
}

/** With many weeks, label every few points (always the last) so the numbers stay readable. */
export function isLabelled(index: number, count: number): boolean {
  const step = count <= 7 ? 1 : Math.ceil(count / 7);
  return index % step === (count - 1) % step;
}

/** Index of the busiest week, or -1 when there were no focus minutes. */
export function peakIndex(values: readonly number[]): number {
  const max = Math.max(0, ...values);
  return max > 0 ? values.indexOf(max) : -1;
}

/** ISO-8601 week number of the local date that holds `ms`. */
export function isoWeek(ms: number): number {
  const local = new Date(ms);
  const date = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / DAY_MS + 1) / 7);
}

export type InsightPattern =
  | { kind: "morning"; matched: number; total: number }
  | { kind: "later"; matched: number; total: number }
  | { kind: "short"; total: number }
  | { kind: "sessions"; averageMinutes: number; total: number };

/** Below these counts a pattern would be a guess, so it isn't shown. */
export const PATTERN_MIN_FINISHED = 5;
export const PATTERN_MIN_SIZED = 3;
export const PATTERN_MIN_SESSIONS = 3;
const SHORT_TASK_MS = 25 * MINUTE_MS;

/** Up to three gentle patterns. Each one carries the counts it is based on. */
export function derivePatterns(input: {
  tasks: readonly TaskLike[];
  blocks: readonly FocusBlockLike[];
  startMs: number;
  endMs: number;
}): InsightPattern[] {
  const { tasks, blocks, startMs, endMs } = input;
  const patterns: InsightPattern[] = [];

  const finished = finishedIn(tasks, startMs, endMs);
  if (finished.length >= PATTERN_MIN_FINISHED) {
    const morning = finished.filter((at) => new Date(at).getHours() < 11).length;
    const later = finished.filter((at) => new Date(at).getHours() >= 12).length;
    if (morning / finished.length >= 0.5) {
      patterns.push({ kind: "morning", matched: morning, total: finished.length });
    } else if (later / finished.length >= 0.6) {
      patterns.push({ kind: "later", matched: later, total: finished.length });
    }
  }

  const sized = tasks.filter(
    (task) =>
      task.timeEstimate !== undefined &&
      task.status !== "cancelled" &&
      task.createdAt >= startMs &&
      task.createdAt < endMs
  );
  const short = sized.filter((task) => (task.timeEstimate ?? 0) <= SHORT_TASK_MS);
  const long = sized.filter((task) => (task.timeEstimate ?? 0) > SHORT_TASK_MS);
  if (short.length >= PATTERN_MIN_SIZED && long.length >= PATTERN_MIN_SIZED) {
    const rate = (rows: readonly TaskLike[]) =>
      rows.filter((t) => t.status === "done").length / rows.length;
    if (rate(short) - rate(long) >= 0.15) patterns.push({ kind: "short", total: sized.length });
  }

  const sessions = blocks.filter(
    (block) => block.durationMs > 0 && block.startedAtMs >= startMs && block.startedAtMs < endMs
  );
  if (sessions.length >= PATTERN_MIN_SESSIONS) {
    const total = sessions.reduce((sum, block) => sum + block.durationMs, 0);
    patterns.push({
      kind: "sessions",
      averageMinutes: Math.round(total / sessions.length / MINUTE_MS),
      total: sessions.length,
    });
  }

  return patterns.slice(0, 3);
}

/** Patterns need about a week of use, and something to look at in the chosen range. */
export function needsMoreTime(input: {
  profileCreatedMs: number | undefined;
  nowMs: number;
  finishedCount: number;
  sessionCount: number;
}): boolean {
  if (input.finishedCount === 0 && input.sessionCount === 0) return true;
  return input.profileCreatedMs !== undefined && input.nowMs - input.profileCreatedMs < 7 * DAY_MS;
}

/** How many tasks finished and focus sessions fall in the window (for the empty state). */
export function countInWindow(
  tasks: readonly TaskLike[],
  blocks: readonly FocusBlockLike[],
  startMs: number,
  endMs: number
): { finishedCount: number; sessionCount: number } {
  return {
    finishedCount: finishedIn(tasks, startMs, endMs).length,
    sessionCount: blocks.filter((b) => b.startedAtMs >= startMs && b.startedAtMs < endMs).length,
  };
}
