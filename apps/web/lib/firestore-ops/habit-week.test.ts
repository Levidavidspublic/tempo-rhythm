import { expect, test } from "bun:test";
import type { HabitCheckInDoc } from "../firestore-docs/habit-doc";
import { habitWeekStrip } from "./habit-week";

const dates = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
] as const;

function checkIn(
  localDate: string,
  checkedAt: number,
  overrides: Partial<HabitCheckInDoc> = {}
): HabitCheckInDoc {
  return {
    habitId: "habit-1",
    localDate,
    checkedAt,
    source: "habits",
    createdAt: checkedAt,
    updatedAt: checkedAt,
    ...overrides,
  };
}

test("no check-ins gives seven not-done days", () => {
  expect(habitWeekStrip([], "habit-1", dates)).toEqual({
    days: dates.map((localDate) => ({ localDate, done: false })),
    doneCount: 0,
  });
});

test("three check-ins mark three days", () => {
  const result = habitWeekStrip(
    [checkIn(dates[0], 10), checkIn(dates[3], 20), checkIn(dates[6], 30)],
    "habit-1",
    dates
  );

  expect(result.days.filter((day) => day.done)).toEqual([
    { localDate: dates[0], done: true, checkedAt: 10 },
    { localDate: dates[3], done: true, checkedAt: 20 },
    { localDate: dates[6], done: true, checkedAt: 30 },
  ]);
  expect(result.doneCount).toBe(3);
});

test("two check-ins on one date count once and keep the latest time", () => {
  const result = habitWeekStrip(
    [checkIn(dates[2], 50), checkIn(dates[2], 90)],
    "habit-1",
    dates
  );

  expect(result.days[2]).toEqual({ localDate: dates[2], done: true, checkedAt: 90 });
  expect(result.doneCount).toBe(1);
});

test("another habit's check-ins are left out", () => {
  const result = habitWeekStrip(
    [checkIn(dates[1], 10, { habitId: "habit-2" })],
    "habit-1",
    dates
  );

  expect(result.days.every((day) => !day.done)).toBe(true);
  expect(result.doneCount).toBe(0);
});

test("deleted check-ins are left out", () => {
  const result = habitWeekStrip(
    [checkIn(dates[4], 10, { deletedAt: 20 })],
    "habit-1",
    dates
  );

  expect(result.days[4]).toEqual({ localDate: dates[4], done: false });
  expect(result.doneCount).toBe(0);
});

test("malformed and repeated dates are dropped and only seven days are kept", () => {
  const inputDates = ["bad", dates[0], dates[0], ...dates.slice(1), "2026-11-23"];
  const inputSnapshot = [...inputDates];
  const checkIns = [checkIn(dates[0], 10)];
  const checkInsSnapshot = [...checkIns];

  const result = habitWeekStrip(checkIns, "habit-1", inputDates);

  expect(result.days.map((day) => day.localDate)).toEqual([...dates]);
  expect(inputDates).toEqual(inputSnapshot);
  expect(checkIns).toEqual(checkInsSnapshot);
});

test("an empty habit id gives no done days", () => {
  const result = habitWeekStrip([checkIn(dates[0], 10)], "", dates);

  expect(result.days.every((day) => !day.done)).toBe(true);
  expect(result.doneCount).toBe(0);
});
