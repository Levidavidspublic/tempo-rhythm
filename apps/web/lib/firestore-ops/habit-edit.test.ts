import { describe, expect, test } from "bun:test";

import { checkHabitDoc, type HabitDoc } from "../firestore-docs/habit-doc";
import { planHabitEdit } from "./habit-edit";

const habit: HabitDoc = {
  name: "Morning walk",
  cadence: "daily",
  currentStreak: 4,
  longestStreak: 9,
  lastCompletedAt: 900,
  createdAt: 100,
  updatedAt: 800,
};

describe("planHabitEdit", () => {
  test("plans a trimmed rename without touching streaks", () => {
    const result = planHabitEdit(habit, { name: `  ${"x".repeat(130)}  ` }, 1_000);

    expect(result).toEqual({
      ok: true,
      unchanged: false,
      patch: { name: "x".repeat(120), updatedAt: 1_000 },
      changedFields: ["name", "updatedAt"],
    });
    if (!result.ok || result.unchanged) throw new Error("expected a planned edit");
    const updated = { ...habit, ...result.patch };
    expect(checkHabitDoc(updated).ok).toBe(true);
    expect(updated.currentStreak).toBe(habit.currentStreak);
    expect(updated.longestStreak).toBe(habit.longestStreak);
    expect(updated.lastCompletedAt).toBe(habit.lastCompletedAt);
  });

  test("plans a cadence change", () => {
    expect(planHabitEdit(habit, { cadence: "weekly" }, 1_000)).toEqual({
      ok: true,
      unchanged: false,
      patch: { cadence: "weekly", updatedAt: 1_000 },
      changedFields: ["cadence", "updatedAt"],
    });
  });

  test("plans a name and cadence change together", () => {
    expect(planHabitEdit(habit, { name: "Evening walk", cadence: "weekly" }, 1_000)).toEqual({
      ok: true,
      unchanged: false,
      patch: { name: "Evening walk", cadence: "weekly", updatedAt: 1_000 },
      changedFields: ["name", "cadence", "updatedAt"],
    });
  });

  test("reports an unchanged edit", () => {
    expect(planHabitEdit(habit, { name: " Morning walk ", cadence: "daily" }, 1_000)).toEqual({
      ok: true,
      unchanged: true,
    });
  });

  test("refuses a deleted habit", () => {
    expect(planHabitEdit({ ...habit, deletedAt: 950 }, { name: "New name" }, 1_000)).toEqual({
      ok: false,
      reason: "deleted",
    });
  });

  test("refuses an empty name", () => {
    expect(planHabitEdit(habit, { name: "   " }, 1_000)).toEqual({
      ok: false,
      reason: "empty-name",
    });
  });

  test("refuses a bad cadence or non-finite time", () => {
    expect(planHabitEdit(habit, { cadence: "monthly" as "daily" }, 1_000)).toEqual({
      ok: false,
      reason: "bad-cadence",
    });
    expect(planHabitEdit(habit, { name: "New name" }, Number.NaN)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  });
});
