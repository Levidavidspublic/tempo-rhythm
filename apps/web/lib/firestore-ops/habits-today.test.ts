import { describe, expect, test } from "bun:test";
import { splitHabitsForDay } from "./habits-today";

type Row = {
  id: string;
  name: string;
  cadence: "daily" | "weekly";
  lastCompletedAt?: number;
  deletedAt?: number;
};

const dayStartMs = 1_000;
const dayEndMs = 2_000;

describe("splitHabitsForDay", () => {
  test("splits the live habits for the half-open day window and returns counts", () => {
    const rows: Row[] = [
      { id: "never", name: "Never completed", cadence: "daily" },
      { id: "inside", name: "Inside", cadence: "daily", lastCompletedAt: dayStartMs },
      { id: "yesterday", name: "Yesterday", cadence: "daily", lastCompletedAt: 999 },
      { id: "at-end", name: "At end", cadence: "daily", lastCompletedAt: dayEndMs },
      {
        id: "deleted",
        name: "Deleted",
        cadence: "daily",
        lastCompletedAt: dayStartMs,
        deletedAt: 2_100,
      },
    ];

    const result = splitHabitsForDay(rows, dayStartMs, dayEndMs);

    expect(result.todo.map(({ id }) => id)).toEqual(["at-end", "never", "yesterday"]);
    expect(result.done.map(({ id }) => id)).toEqual(["inside"]);
    expect(result.doneCount).toBe(1);
    expect(result.total).toBe(4);
  });

  test("sorts each list by name and then by id without changing the input", () => {
    const rows: Row[] = [
      { id: "b", name: "Same", cadence: "weekly" },
      { id: "z", name: "Alpha", cadence: "daily", lastCompletedAt: 1_500 },
      { id: "a", name: "Same", cadence: "daily" },
      { id: "y", name: "Beta", cadence: "daily", lastCompletedAt: 1_500 },
      { id: "x", name: "Beta", cadence: "daily", lastCompletedAt: 1_500 },
    ];
    const originalOrder = rows.map(({ id }) => id);

    const result = splitHabitsForDay(rows, dayStartMs, dayEndMs);

    expect(result.todo.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(result.done.map(({ id }) => id)).toEqual(["z", "x", "y"]);
    expect(rows.map(({ id }) => id)).toEqual(originalOrder);
  });

  test.each([
    [Number.NaN, dayEndMs],
    [dayStartMs, Number.POSITIVE_INFINITY],
    [dayEndMs, dayStartMs],
    [dayStartMs, dayStartMs],
  ])("returns an empty result for invalid window %p to %p", (start, end) => {
    expect(splitHabitsForDay([{ id: "a", name: "A", cadence: "daily" }], start, end)).toEqual({
      todo: [],
      done: [],
      doneCount: 0,
      total: 0,
    });
  });
});
