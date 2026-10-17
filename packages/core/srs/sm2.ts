/**
 * SM-2 spaced repetition (Wozniak, SuperMemo 2, 1987), kitchen T3.
 *
 * Pure functions, no clock and no randomness: the caller passes `now`. Times are Unix ms.
 *
 * The algorithm, as published:
 * - A review is graded q = 0..5. q < 3 is a lapse: repetitions go back to 0 and the next
 *   interval is 1 day. Otherwise the interval is 1 day after the first good review, 6 days after
 *   the second, and then the previous interval times the easiness factor (EF), rounded.
 * - EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), never below 1.3. New cards start at 2.5.
 *   (Changed on every review, lapses included, as in the original.)
 *
 * Tempo shows four buttons instead of six grades. `GRADE_FOR_BUTTON` maps them: Again = 1,
 * Hard = 3, Good = 4, Easy = 5. A card answered "Again" is also shown again before the session
 * ends (see `queue.ts`); that is session behaviour, not part of SM-2's schedule.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const INITIAL_EASE = 2.5;
export const MIN_EASE = 1.3;

/** SM-2 quality of a response, 0 (blackout) to 5 (perfect). */
export type Sm2Grade = 0 | 1 | 2 | 3 | 4 | 5;

/** The four answer buttons a review shows. */
export type ReviewButton = "again" | "hard" | "good" | "easy";

export const GRADE_FOR_BUTTON: Record<ReviewButton, Sm2Grade> = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
};

export type Sm2State = {
  /** Easiness factor, at least 1.3. */
  ease: number;
  /** Days until the next review after the last one; 0 for a card never reviewed. */
  intervalDays: number;
  /** Good reviews in a row since the last lapse. */
  repetitions: number;
  /** Times the card was forgotten (graded below 3) after being learned. */
  lapses: number;
  /** When the card is next due. A new card is due at once. */
  dueAt: number;
  lastReviewedAt?: number;
};

export function isSm2Grade(value: unknown): value is Sm2Grade {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5;
}

/** A card that has never been reviewed, due now. */
export function newCardState(now: number): Sm2State {
  return { ease: INITIAL_EASE, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now };
}

/** SM-2's easiness update for one grade, floored at 1.3 and rounded to 2 decimals. */
export function nextEase(ease: number, grade: Sm2Grade): number {
  const miss = 5 - grade;
  const updated = ease + (0.1 - miss * (0.08 + miss * 0.02));
  return Math.round(Math.max(MIN_EASE, updated) * 100) / 100;
}

/** Applies one graded review. Returns a new state; the input is not changed. */
export function reviewCard(state: Sm2State, grade: Sm2Grade, now: number): Sm2State {
  if (!isSm2Grade(grade)) throw new RangeError("grade must be an integer from 0 to 5");
  const ease = nextEase(state.ease, grade);
  if (grade < 3) {
    return {
      ease,
      intervalDays: 1,
      repetitions: 0,
      lapses: state.repetitions > 0 ? state.lapses + 1 : state.lapses,
      dueAt: now + DAY_MS,
      lastReviewedAt: now,
    };
  }
  const repetitions = state.repetitions + 1;
  const intervalDays =
    repetitions === 1
      ? 1
      : repetitions === 2
        ? 6
        : Math.max(1, Math.round(state.intervalDays * state.ease));
  return {
    ease,
    intervalDays,
    repetitions,
    lapses: state.lapses,
    dueAt: now + intervalDays * DAY_MS,
    lastReviewedAt: now,
  };
}

/** True when the card should be shown at `now`. */
export function isDue(state: Pick<Sm2State, "dueAt">, now: number): boolean {
  return state.dueAt <= now;
}

/** The interval, in days, each button would set: for labels like "Good · 6 days". */
export function previewIntervals(state: Sm2State, now: number): Record<ReviewButton, number> {
  const out = {} as Record<ReviewButton, number>;
  for (const button of Object.keys(GRADE_FOR_BUTTON) as ReviewButton[]) {
    out[button] = reviewCard(state, GRADE_FOR_BUTTON[button], now).intervalDays;
  }
  return out;
}
