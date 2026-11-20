import { describe, expect, test } from "bun:test";
import type { TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";
import { nextRepeatDate } from "./repeat-next-date";

const baseRule: TaskRepeatDoc = {
  repeatCycle: "DAILY",
  repeatEvery: 1,
  weekdays: [],
  deletedInstanceDates: [],
  skipOverdue: false,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
  createdAt: 0,
  updatedAt: 0,
};

describe("nextRepeatDate", () => {
  test("advances daily rules by their interval", () => {
    expect(nextRepeatDate(baseRule, "2026-11-20")).toEqual({ kind: "date", date: "2026-11-21" });
    expect(nextRepeatDate({ ...baseRule, repeatEvery: 3 }, "2026-11-20")).toEqual({
      kind: "date",
      date: "2026-11-23",
    });
  });

  test("handles month ends and leap days in UTC", () => {
    expect(nextRepeatDate(baseRule, "2026-01-31")).toEqual({ kind: "date", date: "2026-02-01" });
    expect(nextRepeatDate(baseRule, "2028-02-28")).toEqual({ kind: "date", date: "2028-02-29" });
  });

  test("selects the first configured weekday later in an eligible week", () => {
    const weekly = { ...baseRule, repeatCycle: "WEEKLY" as const, weekdays: [1, 4] };
    expect(nextRepeatDate(weekly, "2026-11-22")).toEqual({ kind: "date", date: "2026-11-23" });
    expect(nextRepeatDate(weekly, "2026-11-23")).toEqual({ kind: "date", date: "2026-11-26" });
  });

  test("only uses weekdays in weeks allowed by repeatEvery", () => {
    const weekly = {
      ...baseRule,
      repeatCycle: "WEEKLY" as const,
      repeatEvery: 2,
      weekdays: [1],
    };
    expect(nextRepeatDate(weekly, "2026-11-23")).toEqual({ kind: "date", date: "2026-12-07" });
  });

  test("uses whole weekly intervals when weekdays is empty", () => {
    const weekly = { ...baseRule, repeatCycle: "WEEKLY" as const, repeatEvery: 2 };
    expect(nextRepeatDate(weekly, "2026-11-20")).toEqual({ kind: "date", date: "2026-12-04" });
  });

  test("passes over deleted instance dates", () => {
    const rule = { ...baseRule, deletedInstanceDates: ["2026-11-21"] };
    expect(nextRepeatDate(rule, "2026-11-20")).toEqual({ kind: "date", date: "2026-11-22" });
  });

  test("returns none for paused, deleted, and malformed input dates", () => {
    expect(nextRepeatDate({ ...baseRule, isPaused: true }, "2026-11-20")).toEqual({
      kind: "none",
      reason: "paused",
    });
    expect(nextRepeatDate({ ...baseRule, deletedAt: 1 }, "2026-11-20")).toEqual({
      kind: "none",
      reason: "deleted",
    });
    expect(nextRepeatDate(baseRule, "2026-13-40")).toEqual({ kind: "none", reason: "bad_date" });
  });

  test("reports monthly and yearly cycles as unsupported", () => {
    expect(nextRepeatDate({ ...baseRule, repeatCycle: "MONTHLY" }, "2026-11-20")).toEqual({
      kind: "unsupported",
      cycle: "MONTHLY",
    });
    expect(nextRepeatDate({ ...baseRule, repeatCycle: "YEARLY" }, "2026-11-20")).toEqual({
      kind: "unsupported",
      cycle: "YEARLY",
    });
  });
});
