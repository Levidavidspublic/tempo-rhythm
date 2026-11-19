import { describe, expect, test } from "bun:test";
import { checkHabitCheckInDoc, checkHabitDoc, type HabitCheckInDoc, type HabitDoc } from "./habit-doc";

const habit: HabitDoc = {
  name: "Drink water",
  cadence: "daily",
  currentStreak: 2,
  longestStreak: 7,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

const checkIn: HabitCheckInDoc = {
  habitId: "habit-1",
  localDate: "2026-11-19",
  checkedAt: 1_700_000_000_100,
  source: "today",
  createdAt: 1_700_000_000_100,
  updatedAt: 1_700_000_000_100,
};

describe("habit Firestore documents", () => {
  test("valid habit passes", () => {
    expect(checkHabitDoc(habit)).toEqual({ ok: true, doc: habit });
  });

  test("blank name is rejected", () => {
    expect(checkHabitDoc({ ...habit, name: "  " }).ok).toBe(false);
  });

  test("negative streak is rejected", () => {
    expect(checkHabitDoc({ ...habit, currentStreak: -1 }).ok).toBe(false);
  });

  test("valid check-in passes", () => {
    expect(checkHabitCheckInDoc(checkIn)).toEqual({ ok: true, doc: checkIn });
  });

  test("check-in with an impossible local date is rejected", () => {
    expect(checkHabitCheckInDoc({ ...checkIn, localDate: "2026-13-01" }).ok).toBe(false);
  });

  test("unknown userId key is rejected on a check-in", () => {
    expect(checkHabitCheckInDoc({ ...checkIn, userId: "user-1" }).ok).toBe(false);
  });
});
