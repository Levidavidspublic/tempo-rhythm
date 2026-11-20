import { expect, test } from "bun:test";

import type { FocusBlockDoc } from "../firestore-docs/calendar-doc";
import { focusDayTotal } from "./focus-day-total";

const DAY_START = 1_000_000;
const DAY_END = DAY_START + 86_400_000;

function block(overrides: Partial<FocusBlockDoc> = {}): FocusBlockDoc {
  return {
    startedAtMs: DAY_START,
    durationMs: 60_000,
    createdAt: DAY_START,
    updatedAt: DAY_START,
    ...overrides,
  };
}

test("empty list gives zeros", () => {
  expect(focusDayTotal([], DAY_START, DAY_END)).toEqual({
    totalMs: 0,
    totalMinutes: 0,
    sessions: 0,
    copyKey: "today.focus.none",
  });
});

test("two sessions in the day are summed", () => {
  expect(
    focusDayTotal(
      [block({ durationMs: 90_000 }), block({ startedAtMs: DAY_START + 1, durationMs: 150_000 })],
      DAY_START,
      DAY_END
    )
  ).toEqual({
    totalMs: 240_000,
    totalMinutes: 4,
    sessions: 2,
    copyKey: "today.focus.some",
  });
});

test("only the start boundary is included", () => {
  expect(
    focusDayTotal(
      [
        block({ startedAtMs: DAY_START - 1 }),
        block({ startedAtMs: DAY_START, durationMs: 120_000 }),
        block({ startedAtMs: DAY_END }),
      ],
      DAY_START,
      DAY_END
    )
  ).toMatchObject({ totalMs: 120_000, sessions: 1 });
});

test("a session running past midnight counts in full on its start day", () => {
  expect(
    focusDayTotal([block({ startedAtMs: DAY_END - 30_000, durationMs: 120_000 })], DAY_START, DAY_END)
  ).toMatchObject({ totalMs: 120_000, totalMinutes: 2, sessions: 1 });
});

test("deleted and broken sessions are left out", () => {
  expect(
    focusDayTotal(
      [
        block({ deletedAt: DAY_START + 1 }),
        block({ startedAtMs: Number.NaN }),
        block({ durationMs: Number.POSITIVE_INFINITY }),
        block({ durationMs: -1 }),
        block({ durationMs: 30_000 }),
      ],
      DAY_START,
      DAY_END
    )
  ).toEqual({
    totalMs: 30_000,
    totalMinutes: 0,
    sessions: 1,
    copyKey: "today.focus.some",
  });
});

test("a bad day range gives zeros", () => {
  const empty = {
    totalMs: 0,
    totalMinutes: 0,
    sessions: 0,
    copyKey: "today.focus.none",
  } as const;

  expect(focusDayTotal([block()], Number.NaN, DAY_END)).toEqual(empty);
  expect(focusDayTotal([block()], DAY_START, Number.POSITIVE_INFINITY)).toEqual(empty);
  expect(focusDayTotal([block()], DAY_START, DAY_START)).toEqual(empty);
  expect(focusDayTotal([block()], DAY_END, DAY_START)).toEqual(empty);
});
