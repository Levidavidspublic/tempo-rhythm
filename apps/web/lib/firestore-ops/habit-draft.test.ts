import { expect, test } from "bun:test";
import { HABIT_NAME_MAX, draftHabit, sortHabitsForList } from "./habit-draft";

const now = 1_700_000_000_000;

test("name only gives a daily habit with zero streaks", () => {
  expect(draftHabit({ name: "  Drink   water  " }, now)).toEqual({
    ok: true,
    doc: {
      name: "Drink water",
      cadence: "daily",
      currentStreak: 0,
      longestStreak: 0,
      createdAt: now,
      updatedAt: now,
    },
  });
});

test("weekly cadence is kept", () => {
  const result = draftHabit({ name: "Plan meals", cadence: "weekly" }, now);

  expect(result.ok).toBe(true);
  if (result.ok) expect(result.doc.cadence).toBe("weekly");
});

test("empty name is refused", () => {
  expect(draftHabit({ name: " \n\t " }, now)).toEqual({ ok: false, reason: "empty-name" });
});

test("unknown cadence is refused", () => {
  expect(draftHabit({ name: "Stretch", cadence: "monthly" }, now)).toEqual({
    ok: false,
    reason: "invalid-cadence",
  });
});

test("long name is shortened without cutting a surrogate pair", () => {
  const result = draftHabit({ name: `${"a".repeat(HABIT_NAME_MAX - 1)}😀more` }, now);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.doc.name).toBe("a".repeat(HABIT_NAME_MAX - 1));
    expect(result.doc.name.length).toBeLessThanOrEqual(HABIT_NAME_MAX);
  }
});

test("new habit has no lastCompletedAt key", () => {
  const result = draftHabit({ name: "Read" }, now);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect("lastCompletedAt" in result.doc).toBe(false);
    expect(Object.values(result.doc)).not.toContain(undefined);
  }
});

test("list is sorted, drops deleted habits, and leaves input untouched", () => {
  const habits = [
    { id: "b", name: "B", cadence: "daily" as const, currentStreak: 0, longestStreak: 0, createdAt: 2, updatedAt: 2 },
    { id: "z", name: "Deleted", cadence: "daily" as const, currentStreak: 0, longestStreak: 0, createdAt: 0, updatedAt: 3, deletedAt: 3 },
    { id: "c", name: "C", cadence: "weekly" as const, currentStreak: 0, longestStreak: 0, createdAt: 1, updatedAt: 1 },
    { id: "a", name: "A", cadence: "daily" as const, currentStreak: 0, longestStreak: 0, createdAt: 2, updatedAt: 2 },
  ];
  const originalOrder = habits.slice();

  expect(sortHabitsForList(habits).map(({ id }) => id)).toEqual(["c", "a", "b"]);
  expect(habits).toEqual(originalOrder);
});
