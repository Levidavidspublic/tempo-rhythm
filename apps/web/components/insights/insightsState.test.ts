import { describe, expect, test } from "bun:test";
import {
  countInWindow,
  type FocusBlockLike,
  focusMinutesByWeek,
  rangeWindow,
  type TaskLike,
  weekdayBars,
} from "@/lib/you/insights";
import {
  dayLevel,
  dayStarts,
  deriveInsightsState,
  type InsightsStateInput,
  insightsGlance,
} from "./insightsState";

const filled = {
  tasksOpen: 3,
  tasksCompletedThisWeek: 1,
  habitsTotal: 2,
  goalsActive: 1,
};
const emptySummary = { tasksOpen: 0, tasksCompletedThisWeek: 0, habitsTotal: 0, goalsActive: 0 };

const base: InsightsStateInput = {
  isAuthLoading: false,
  isAuthenticated: true,
  profile: { _id: "u1" },
  summary: filled,
  failed: false,
};

describe("deriveInsightsState", () => {
  test("auth still loading", () => {
    expect(deriveInsightsState({ ...base, isAuthLoading: true })).toBe("loading");
  });
  test("signed out", () => {
    expect(
      deriveInsightsState({ ...base, isAuthenticated: false, profile: undefined, summary: undefined }),
    ).toBe("signed-out");
  });
  test("profile loading", () => {
    expect(deriveInsightsState({ ...base, profile: undefined, summary: undefined })).toBe("loading");
  });
  test("auth done and profile null is never the skeleton", () => {
    expect(deriveInsightsState({ ...base, profile: null, summary: undefined })).not.toBe("loading");
    expect(deriveInsightsState({ ...base, profile: null, summary: undefined })).toBe("signed-out");
  });
  test("summary loading", () => {
    expect(deriveInsightsState({ ...base, summary: undefined })).toBe("loading");
  });
  test("empty", () => {
    expect(deriveInsightsState({ ...base, summary: emptySummary })).toBe("empty");
  });
  test("ready", () => {
    expect(deriveInsightsState(base)).toBe("ready");
  });
  test("error wins over every loading state", () => {
    expect(deriveInsightsState({ ...base, failed: true })).toBe("error");
    expect(
      deriveInsightsState({ ...base, isAuthLoading: true, profile: undefined, summary: undefined, failed: true }),
    ).toBe("error");
  });
  test("auth dropped mid-load leaves the skeleton", () => {
    expect(
      deriveInsightsState({ ...base, isAuthenticated: false, profile: undefined, summary: undefined }),
    ).not.toBe("loading");
  });
  test("summary undefined past the timeout is an error", () => {
    expect(deriveInsightsState({ ...base, summary: undefined, failed: true })).toBe("error");
  });
  test("summary null is an error, never the skeleton", () => {
    expect(deriveInsightsState({ ...base, summary: null })).toBe("error");
  });
});

/** Local times, so the tests hold in any timezone. Mon 12 Oct 2026 is a Monday. */
const at = (day: number, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const MIN = 60_000;
const done = (day: number, hour = 9): TaskLike => ({
  status: "done",
  completedAt: at(day, hour),
  createdAt: at(day, 8),
});
const focus = (day: number, hour: number, minutes: number): FocusBlockLike => ({
  startedAtMs: at(day, hour),
  durationMs: minutes * MIN,
});

describe("dayLevel", () => {
  test("each finished task, and each 25 minutes of focus, is one step", () => {
    expect(dayLevel(0, 0)).toBe(0);
    expect(dayLevel(0, 24)).toBe(0);
    expect(dayLevel(1, 0)).toBe(1);
    expect(dayLevel(0, 25)).toBe(1);
    expect(dayLevel(2, 0)).toBe(2);
    expect(dayLevel(1, 25)).toBe(2);
    expect(dayLevel(3, 0)).toBe(3);
    expect(dayLevel(2, 50)).toBe(3);
    expect(dayLevel(5, 0)).toBe(4);
    expect(dayLevel(1, 120)).toBe(4);
  });
});

describe("dayStarts", () => {
  test("one local midnight per day, up to the end of today", () => {
    const starts = dayStarts(at(12, 0), at(15, 0));
    expect(starts).toEqual([at(12, 0), at(13, 0), at(14, 0)]);
    for (const ms of starts) expect(new Date(ms).getHours()).toBe(0);
  });

  test("an empty or broken window has no days", () => {
    expect(dayStarts(at(12, 0), at(12, 0))).toEqual([]);
    expect(dayStarts(at(12, 0), Number.NaN)).toEqual([]);
  });
});

describe("insightsGlance", () => {
  // Wed 14 Oct: two weeks are Mon 5 Oct to the end of today, ten days.
  const win = rangeWindow("2w", new Date(2026, 9, 14, 15, 30));
  const tasks: TaskLike[] = [
    done(5),
    done(12),
    done(12, 17),
    done(14),
    { ...done(13), status: "todo" },
    { ...done(13), status: "cancelled" },
    done(15), // tomorrow
    done(4), // the Sunday before the range
  ];
  const blocks: FocusBlockLike[] = [
    focus(12, 10, 30),
    focus(13, 9, 50),
    focus(13, 15, 10),
    { startedAtMs: at(14, 9), durationMs: -5 * MIN },
    focus(16, 9, 40), // after today
  ];
  const glance = insightsGlance(tasks, blocks, win);

  test("buckets finished tasks and focus minutes by local day, first Monday through today", () => {
    expect(glance.days).toHaveLength(10);
    expect(glance.days[0]?.startMs).toBe(at(5, 0));
    expect(glance.days.at(-1)?.startMs).toBe(at(14, 0));
    expect(glance.days.map((day) => day.done)).toEqual([1, 0, 0, 0, 0, 0, 0, 2, 0, 1]);
    expect(glance.days.map((day) => day.focusMinutes)).toEqual([0, 0, 0, 0, 0, 0, 0, 30, 60, 0]);
  });

  test("levels use the weekly glance's rule", () => {
    expect(glance.days.map((day) => day.level)).toEqual([1, 0, 0, 0, 0, 0, 0, 3, 2, 1]);
    expect(glance.activeDays).toBe(4);
  });

  test("totals match the charts they replace", () => {
    const bars = weekdayBars(tasks, win.startMs, win.endMs);
    expect(glance.finished).toBe(4);
    expect(glance.finished).toBe(bars.reduce((sum, bar) => sum + bar.value, 0));
    expect(glance.finished).toBe(
      countInWindow(tasks, blocks, win.startMs, win.endMs).finishedCount
    );
    expect(glance.finishedByWeek).toEqual([1, 3]);
    expect(glance.focusByWeek).toEqual(focusMinutesByWeek(blocks, win.weekStarts, win.endMs));
    expect(glance.focusByWeek).toEqual([0, 90]);
    expect(glance.focusMinutes).toBe(90);
  });

  test("three months: a day for each day so far, and each week's days add up to its total", () => {
    const wide = rangeWindow("3m", new Date(2026, 9, 14, 15, 30));
    const g = insightsGlance(tasks, blocks, wide);
    expect(g.days).toHaveLength(12 * 7 + 3);
    expect(g.days[0]?.startMs).toBe(wide.weekStarts[0]);
    expect(g.finishedByWeek).toHaveLength(13);
    expect(g.finishedByWeek.slice(-2)).toEqual([1, 3]);
    expect(g.finishedByWeek.reduce((sum, n) => sum + n, 0)).toBe(g.finished);
  });

  test("an empty account: every day quiet, every total zero", () => {
    const wide = rangeWindow("3m", new Date(2026, 9, 14, 15, 30));
    const empty = insightsGlance([], [], wide);
    expect(empty.days).toHaveLength(12 * 7 + 3);
    expect(
      empty.days.every((day) => day.level === 0 && day.done === 0 && day.focusMinutes === 0)
    ).toBe(true);
    expect(empty.finished).toBe(0);
    expect(empty.focusMinutes).toBe(0);
    expect(empty.activeDays).toBe(0);
    expect(empty.finishedByWeek).toEqual(Array.from({ length: 13 }, () => 0));
    expect(empty.focusByWeek).toEqual(Array.from({ length: 13 }, () => 0));
  });
});
