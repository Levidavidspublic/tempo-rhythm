import { describe, expect, test } from "bun:test";
import { planHabitComplete } from "./habit-complete";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 20, 12);

describe("planHabitComplete", () => {
  test("plans the first completion with a streak of one", () => {
    const habit = { currentStreak: 0, longestStreak: 0 };

    expect(planHabitComplete(habit, NOW)).toEqual({
      ok: true,
      alreadyDone: false,
      patch: {
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedAt: NOW,
        updatedAt: NOW,
      },
      changedFields: ["currentStreak", "longestStreak", "lastCompletedAt", "updatedAt"],
    });
    expect(habit).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  test("increments the streak on the next UTC day", () => {
    expect(
      planHabitComplete({ currentStreak: 3, longestStreak: 5, lastCompletedAt: NOW - DAY_MS }, NOW)
    ).toMatchObject({
      ok: true,
      alreadyDone: false,
      patch: { currentStreak: 4, longestStreak: 5 },
    });
  });

  test("answers already done on the same UTC day without a patch", () => {
    expect(
      planHabitComplete({ currentStreak: 3, longestStreak: 5, lastCompletedAt: NOW - 1 }, NOW)
    ).toEqual({ ok: true, alreadyDone: true, currentStreak: 3 });
  });

  test("restarts after a gap and preserves the longest streak", () => {
    expect(
      planHabitComplete(
        {
          currentStreak: 3,
          longestStreak: 8,
          lastCompletedAt: NOW - 2 * DAY_MS,
        },
        NOW
      )
    ).toMatchObject({
      ok: true,
      alreadyDone: false,
      patch: { currentStreak: 1, longestStreak: 8 },
    });
  });

  test("refuses a deleted habit", () => {
    expect(
      planHabitComplete({ currentStreak: 2, longestStreak: 4, deletedAt: NOW - 1 }, NOW)
    ).toEqual({ ok: false, reason: "deleted" });
  });

  test("refuses a non-finite time", () => {
    expect(planHabitComplete({ currentStreak: 2, longestStreak: 4 }, Number.NaN)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  });
});
