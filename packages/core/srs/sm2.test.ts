import { describe, expect, test } from "bun:test";
import {
  DAY_MS,
  GRADE_FOR_BUTTON,
  INITIAL_EASE,
  MIN_EASE,
  isDue,
  newCardState,
  nextEase,
  previewIntervals,
  reviewCard,
} from "./sm2";

const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);

describe("SM-2", () => {
  test("a new card starts at EF 2.5 and is due at once", () => {
    const card = newCardState(T0);
    expect(card).toEqual({ ease: INITIAL_EASE, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: T0 });
    expect(isDue(card, T0)).toBe(true);
  });

  test("good reviews go 1 day, 6 days, then interval × EF", () => {
    let card = reviewCard(newCardState(T0), 4, T0);
    expect(card.intervalDays).toBe(1);
    expect(card.repetitions).toBe(1);
    expect(card.dueAt).toBe(T0 + DAY_MS);

    card = reviewCard(card, 4, card.dueAt);
    expect(card.intervalDays).toBe(6);

    const before = card;
    card = reviewCard(card, 4, card.dueAt);
    expect(card.intervalDays).toBe(Math.round(6 * before.ease));
    expect(card.repetitions).toBe(3);
  });

  test("EF follows the published formula and never drops below 1.3", () => {
    expect(nextEase(2.5, 5)).toBe(2.6);
    expect(nextEase(2.5, 4)).toBe(2.5);
    expect(nextEase(2.5, 3)).toBe(2.36);
    expect(nextEase(2.5, 0)).toBe(1.7);
    expect(nextEase(1.3, 0)).toBe(MIN_EASE);
  });

  test("a lapse resets repetitions, schedules tomorrow and counts once the card was learned", () => {
    const fresh = reviewCard(newCardState(T0), 1, T0);
    expect(fresh.repetitions).toBe(0);
    expect(fresh.intervalDays).toBe(1);
    expect(fresh.lapses).toBe(0);

    const learned = reviewCard(reviewCard(newCardState(T0), 4, T0), 4, T0 + DAY_MS);
    const forgotten = reviewCard(learned, GRADE_FOR_BUTTON.again, learned.dueAt);
    expect(forgotten.repetitions).toBe(0);
    expect(forgotten.lapses).toBe(1);
    expect(forgotten.dueAt).toBe(learned.dueAt + DAY_MS);
  });

  test("the input state is never changed", () => {
    const card = newCardState(T0);
    const copy = { ...card };
    reviewCard(card, 5, T0);
    expect(card).toEqual(copy);
  });

  test("grades outside 0..5 are refused", () => {
    expect(() => reviewCard(newCardState(T0), 6 as never, T0)).toThrow(RangeError);
    expect(() => reviewCard(newCardState(T0), 2.5 as never, T0)).toThrow(RangeError);
  });

  test("button previews match what a review would set", () => {
    const card = reviewCard(reviewCard(newCardState(T0), 4, T0), 4, T0 + DAY_MS);
    const preview = previewIntervals(card, card.dueAt);
    expect(preview.again).toBe(1);
    expect(preview.good).toBe(reviewCard(card, 4, card.dueAt).intervalDays);
    expect(preview.easy).toBeGreaterThanOrEqual(preview.good);
  });
});
