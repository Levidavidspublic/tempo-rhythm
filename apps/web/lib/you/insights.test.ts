import { describe, expect, test } from "bun:test";
import {
  countInWindow,
  derivePatterns,
  focusMinutesByWeek,
  isInsightsRange,
  isLabelled,
  isoWeek,
  linePoints,
  needsMoreTime,
  peakIndex,
  rangeWindow,
  summarizeWeekdays,
  type TaskLike,
  weekdayBars,
} from "./insights";

/** Local times, so the tests hold in any timezone. Mon 12 Oct 2026 is a Monday. */
const at = (day: number, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const MIN = 60_000;

function done(day: number, hour = 9, extra: Partial<TaskLike> = {}): TaskLike {
  return { status: "done", completedAt: at(day, hour), createdAt: at(day, 8), ...extra };
}

describe("rangeWindow", () => {
  test("starts on a Monday, whole weeks back, and ends after today", () => {
    const now = new Date(2026, 9, 14, 15, 30); // Wed 14 Oct
    const w = rangeWindow("4w", now);
    expect(w.weekStarts).toHaveLength(4);
    expect(new Date(w.startMs).getDay()).toBe(1);
    expect(w.startMs).toBe(new Date(2026, 8, 21).getTime());
    expect(w.weekStarts.at(-1)).toBe(new Date(2026, 9, 12).getTime());
    expect(w.endMs).toBe(new Date(2026, 9, 15).getTime());
  });

  test("three months stays inside the 93-day focus query limit", () => {
    const w = rangeWindow("3m", new Date(2026, 9, 18, 23));
    expect(w.weekStarts).toHaveLength(13);
    expect(w.endMs - w.startMs).toBeLessThanOrEqual(93 * 86_400_000);
  });

  test("only the three ranges are accepted", () => {
    expect(isInsightsRange("2w")).toBe(true);
    expect(isInsightsRange("1y")).toBe(false);
    expect(isInsightsRange(undefined)).toBe(false);
  });
});

describe("weekday chart", () => {
  const tasks = [
    done(12),
    done(12),
    done(5),
    done(15),
    done(15),
    done(17),
    { ...done(13), status: "todo" as const },
  ];
  const bars = weekdayBars(tasks, at(1, 0), at(19, 0));

  test("counts finished tasks per weekday, Monday first, and marks the fullest", () => {
    expect(bars.map((b) => b.value)).toEqual([3, 0, 0, 2, 0, 1, 0]);
    expect(bars.map((b) => b.pct)).toEqual([100, 0, 0, 67, 0, 33, 0]);
    expect(bars.filter((b) => b.highlight).map((b) => b.day)).toEqual([0]);
  });

  test("ignores tasks finished outside the window", () => {
    expect(weekdayBars([done(20)], at(1, 0), at(19, 0)).every((b) => b.value === 0)).toBe(true);
  });

  test("says which days were fullest, and that a light weekend is fine", () => {
    expect(summarizeWeekdays(bars)).toEqual({ kind: "top", days: [0], weekendLight: true });
    const two = weekdayBars([done(12), done(15)], at(1, 0), at(19, 0));
    expect(summarizeWeekdays(two)).toEqual({ kind: "top", days: [0, 3], weekendLight: true });
    expect(summarizeWeekdays(weekdayBars([], 0, 1))).toEqual({ kind: "none" });
    const even = weekdayBars([done(12), done(13), done(14)], at(1, 0), at(19, 0));
    expect(summarizeWeekdays(even)).toEqual({ kind: "even" });
  });
});

describe("focus chart", () => {
  const weekStarts = [at(5, 0), at(12, 0)];
  const blocks = [
    { startedAtMs: at(5, 10), durationMs: 25 * MIN },
    { startedAtMs: at(9, 10), durationMs: 50 * MIN },
    { startedAtMs: at(13, 10), durationMs: 30 * MIN },
    { startedAtMs: at(20, 10), durationMs: 30 * MIN },
  ];

  test("adds up minutes per week and leaves out later sessions", () => {
    expect(focusMinutesByWeek(blocks, weekStarts, at(19, 0))).toEqual([75, 30]);
  });

  test("draws points in the design's viewBox, tallest at y 52", () => {
    expect(linePoints([180, 240, 150, 95])).toEqual([
      { value: 180, x: 60, y: 84 },
      { value: 240, x: 160, y: 52 },
      { value: 150, x: 260, y: 100 },
      { value: 95, x: 360, y: 129.3 },
    ]);
    expect(linePoints([0, 0])).toEqual([
      { value: 0, x: 60, y: 180 },
      { value: 0, x: 360, y: 180 },
    ]);
    expect(linePoints([5])[0]?.x).toBe(210);
  });

  test("labels every point on short charts, and the last one always", () => {
    expect([0, 1, 2, 3].every((i) => isLabelled(i, 4))).toBe(true);
    const labelled = Array.from({ length: 13 }, (_, i) => i).filter((i) => isLabelled(i, 13));
    expect(labelled).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  test("finds the busiest week", () => {
    expect(peakIndex([180, 240, 150])).toBe(1);
    expect(peakIndex([0, 0])).toBe(-1);
  });

  test("uses ISO week numbers", () => {
    expect(isoWeek(at(12))).toBe(42);
    expect(isoWeek(new Date(2026, 0, 1).getTime())).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1).getTime())).toBe(53);
  });
});

describe("gentle patterns", () => {
  const window = { startMs: at(1, 0), endMs: at(19, 0) };

  test("mornings, when at least half of five or more finished tasks were done before 11:00", () => {
    const tasks = [done(12, 8), done(13, 9), done(14, 10), done(15, 14), done(16, 16)];
    expect(derivePatterns({ tasks, blocks: [], ...window })).toEqual([
      { kind: "morning", matched: 3, total: 5 },
    ]);
  });

  test("later in the day, when most were finished after noon", () => {
    const tasks = [done(12, 13), done(13, 15), done(14, 18), done(15, 20), done(16, 9)];
    expect(derivePatterns({ tasks, blocks: [], ...window })).toEqual([
      { kind: "later", matched: 4, total: 5 },
    ]);
  });

  test("nothing from too few tasks", () => {
    expect(derivePatterns({ tasks: [done(12, 8), done(13, 8)], blocks: [], ...window })).toEqual(
      []
    );
  });

  test("short tasks, when they get finished clearly more often than long ones", () => {
    const short = (status: TaskLike["status"]) => ({
      status,
      timeEstimate: 20 * MIN,
      createdAt: at(12),
    });
    const long = (status: TaskLike["status"]) => ({
      status,
      timeEstimate: 60 * MIN,
      createdAt: at(12),
    });
    const tasks: TaskLike[] = [
      short("done"),
      short("done"),
      short("todo"),
      long("done"),
      long("todo"),
      long("todo"),
    ];
    expect(derivePatterns({ tasks, blocks: [], ...window })).toEqual([{ kind: "short", total: 6 }]);
  });

  test("average focus session length from three or more sessions", () => {
    const blocks = [20, 30, 40].map((m, i) => ({
      startedAtMs: at(12 + i, 10),
      durationMs: m * MIN,
    }));
    expect(derivePatterns({ tasks: [], blocks, ...window })).toEqual([
      { kind: "sessions", averageMinutes: 30, total: 3 },
    ]);
  });
});

describe("empty state rule", () => {
  test("needs about a week of use and something in the range", () => {
    const now = at(18);
    expect(
      needsMoreTime({ profileCreatedMs: at(1), nowMs: now, finishedCount: 0, sessionCount: 0 })
    ).toBe(true);
    expect(
      needsMoreTime({ profileCreatedMs: at(15), nowMs: now, finishedCount: 4, sessionCount: 0 })
    ).toBe(true);
    expect(
      needsMoreTime({ profileCreatedMs: at(1), nowMs: now, finishedCount: 1, sessionCount: 0 })
    ).toBe(false);
    expect(
      needsMoreTime({ profileCreatedMs: undefined, nowMs: now, finishedCount: 0, sessionCount: 2 })
    ).toBe(false);
  });

  test("counts what falls inside the window", () => {
    const blocks = [
      { startedAtMs: at(12), durationMs: MIN },
      { startedAtMs: at(25), durationMs: MIN },
    ];
    expect(countInWindow([done(12), done(30)], blocks, at(1, 0), at(19, 0))).toEqual({
      finishedCount: 1,
      sessionCount: 1,
    });
  });
});
