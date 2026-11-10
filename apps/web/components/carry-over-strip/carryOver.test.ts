import { describe, expect, test } from "bun:test";
import { endOfLocalDayMs, startOfLocalDayMs } from "@/lib/localDay";
import { groupByLocalDay, todayDueAt } from "./carryOver";

describe("groupByLocalDay", () => {
  test("groups by local day, newest first", () => {
    const tue = new Date(2026, 2, 10, 8).getTime();
    const tueLate = new Date(2026, 2, 10, 23, 59, 59).getTime();
    const wed = new Date(2026, 2, 11, 0, 0, 0).getTime();
    const groups = groupByLocalDay([
      { id: "a", dueAt: tue },
      { id: "b", dueAt: wed },
      { id: "c", dueAt: tueLate },
    ]);
    expect(groups.map((g) => g.tasks.map((t) => t.id))).toEqual([["b"], ["a", "c"]]);
    expect(groups[0].dayStartMs).toBe(startOfLocalDayMs(new Date(wed)));
  });

  test("splits at local midnight around common DST transition dates", () => {
    for (const [m, d] of [
      [2, 8],
      [2, 29],
      [9, 25],
      [10, 1],
    ]) {
      const before = new Date(2026, m, d, 23, 30).getTime();
      const after = new Date(2026, m, d + 1, 0, 30).getTime();
      expect(groupByLocalDay([{ dueAt: before }, { dueAt: after }])).toHaveLength(2);
    }
  });

  test("skips tasks without dueAt and handles empty input", () => {
    expect(groupByLocalDay([{}])).toEqual([]);
    expect(groupByLocalDay([])).toEqual([]);
  });
});

describe("todayDueAt", () => {
  test("early morning returns 09:00 local today", () => {
    const now = new Date(2026, 5, 18, 6, 0).getTime();
    expect(new Date(todayDueAt(now)).getHours()).toBe(9);
    expect(startOfLocalDayMs(new Date(todayDueAt(now)))).toBe(startOfLocalDayMs(new Date(now)));
  });

  test("after 09:00 returns now", () => {
    const now = new Date(2026, 5, 18, 15, 20).getTime();
    expect(todayDueAt(now)).toBe(now);
  });

  test("always stays inside today's local day", () => {
    for (const h of [0, 8, 9, 12, 23]) {
      const now = new Date(2026, 2, 8, h, 59).getTime();
      const due = todayDueAt(now);
      expect(due).toBeGreaterThanOrEqual(startOfLocalDayMs(new Date(now)));
      expect(due).toBeLessThan(endOfLocalDayMs(new Date(now)));
    }
  });
});
