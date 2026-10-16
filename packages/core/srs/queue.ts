/**
 * Review queue and session, kitchen T3.
 *
 * Pure functions, no clock: the caller passes `now`. Sessions are plain immutable values; every
 * step returns a new one, so "Undo the last grade" is keeping the previous value.
 *
 * - `buildReviewQueue` picks what to study: cards already due first (the longest-waiting first),
 *   then cards never studied, up to `newLimit` (default 20), in the order given. Cards scheduled
 *   for later are left out.
 * - A session walks that queue. "Again" puts the card back at the end of this session so it comes
 *   round once more before the end, at most `maxAgain` times per card (default 2); after that it
 *   waits for its SM-2 date like any other card. Any other button finishes the card.
 *
 * The SM-2 schedule itself is `sm2.ts`; this module only orders cards inside one sitting.
 */

import { isDue, type ReviewButton, type Sm2State } from "./sm2";

export const DEFAULT_NEW_LIMIT = 20;
export const DEFAULT_MAX_AGAIN = 2;

/** One card to place in a queue: its key and its SM-2 state, or `null` if never studied. */
export type QueueItem = { key: string; state: Sm2State | null };

export type ReviewQueueOptions = { newLimit?: number };

/** Due cards (oldest due first), then new cards up to `newLimit`. Input order breaks ties. */
export function buildReviewQueue<T extends QueueItem>(
  items: readonly T[],
  now: number,
  options: ReviewQueueOptions = {},
): T[] {
  const newLimit = Math.max(0, Math.floor(options.newLimit ?? DEFAULT_NEW_LIMIT));
  const due = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.state !== null && isDue(item.state, now))
    .sort((a, b) => (a.item.state as Sm2State).dueAt - (b.item.state as Sm2State).dueAt || a.index - b.index)
    .map(({ item }) => item);
  const fresh = items.filter((item) => item.state === null).slice(0, newLimit);
  return [...due, ...fresh];
}

export type ReviewSession<T extends { key: string }> = {
  /** Cards still to show; the first is the current one. */
  queue: readonly T[];
  /** Cards finished this session. */
  done: number;
  /** "Again" presses this session. */
  again: number;
  /** "Again" presses per card key. */
  againByKey: Readonly<Record<string, number>>;
  maxAgain: number;
};

export type SessionProgress = { done: number; left: number; again: number };

export function startSession<T extends { key: string }>(
  cards: readonly T[],
  options: { maxAgain?: number } = {},
): ReviewSession<T> {
  return {
    queue: [...cards],
    done: 0,
    again: 0,
    againByKey: {},
    maxAgain: Math.max(0, Math.floor(options.maxAgain ?? DEFAULT_MAX_AGAIN)),
  };
}

/** The card to show now, or `null` when the session is over. */
export function currentCard<T extends { key: string }>(session: ReviewSession<T>): T | null {
  return session.queue[0] ?? null;
}

export function isSessionOver<T extends { key: string }>(session: ReviewSession<T>): boolean {
  return session.queue.length === 0;
}

/**
 * Answers the current card. "Again" sends it to the end of the session while it has repeats
 * left; every other answer (and an "Again" past the limit) finishes it. A finished session is
 * returned unchanged.
 */
export function answerCard<T extends { key: string }>(
  session: ReviewSession<T>,
  button: ReviewButton,
): ReviewSession<T> {
  const [card, ...rest] = session.queue;
  if (card === undefined) return session;
  if (button !== "again") {
    return { ...session, queue: rest, done: session.done + 1 };
  }
  const repeats = session.againByKey[card.key] ?? 0;
  const againByKey = { ...session.againByKey, [card.key]: repeats + 1 };
  const again = session.again + 1;
  if (repeats < session.maxAgain) {
    return { ...session, queue: [...rest, card], again, againByKey };
  }
  return { ...session, queue: rest, done: session.done + 1, again, againByKey };
}

/** Counts for a progress line: finished, still to show (including repeats), "Again" presses. */
export function sessionProgress<T extends { key: string }>(session: ReviewSession<T>): SessionProgress {
  return { done: session.done, left: session.queue.length, again: session.again };
}
