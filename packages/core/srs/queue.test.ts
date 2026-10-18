import { describe, expect, test } from "bun:test";
import {
  answerCard,
  buildReviewQueue,
  currentCard,
  isSessionOver,
  type QueueItem,
  sessionProgress,
  startSession,
} from "./queue";
import { DAY_MS, newCardState, reviewCard, type Sm2State } from "./sm2";

const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);

function dueAt(dueAtMs: number): Sm2State {
  return { ...newCardState(T0 - 10 * DAY_MS), dueAt: dueAtMs, repetitions: 1, intervalDays: 1 };
}

function keys(items: readonly { key: string }[]): string[] {
  return items.map((item) => item.key);
}

describe("buildReviewQueue", () => {
  test("due cards first, oldest due first, then new cards in input order", () => {
    const items: QueueItem[] = [
      { key: "new1", state: null },
      { key: "due-late", state: dueAt(T0 - 1000) },
      { key: "later", state: dueAt(T0 + DAY_MS) },
      { key: "due-old", state: dueAt(T0 - 3 * DAY_MS) },
      { key: "new2", state: null },
      { key: "due-now", state: dueAt(T0) },
    ];
    expect(keys(buildReviewQueue(items, T0))).toEqual([
      "due-old",
      "due-late",
      "due-now",
      "new1",
      "new2",
    ]);
  });

  test("equal due times keep input order", () => {
    const items: QueueItem[] = [
      { key: "b", state: dueAt(T0 - 5) },
      { key: "a", state: dueAt(T0 - 5) },
    ];
    expect(keys(buildReviewQueue(items, T0))).toEqual(["b", "a"]);
  });

  test("new cards are capped at newLimit (default 20); due cards are not", () => {
    const fresh: QueueItem[] = Array.from({ length: 30 }, (_, i) => ({
      key: `n${i}`,
      state: null,
    }));
    const due: QueueItem[] = Array.from({ length: 25 }, (_, i) => ({
      key: `d${i}`,
      state: dueAt(T0 - i),
    }));
    expect(buildReviewQueue([...fresh, ...due], T0)).toHaveLength(45);
    expect(buildReviewQueue(fresh, T0, { newLimit: 5 })).toHaveLength(5);
    expect(buildReviewQueue(fresh, T0, { newLimit: 0 })).toHaveLength(0);
    expect(buildReviewQueue(fresh, T0, { newLimit: -3 })).toHaveLength(0);
  });

  test("extra fields ride along and the input is not changed", () => {
    const items = [{ key: "x", state: null, front: "Front" }];
    const copy = structuredClone(items);
    expect(buildReviewQueue(items, T0)[0]?.front).toBe("Front");
    expect(items).toEqual(copy);
  });

  test("a card reviewed today is not due again today", () => {
    const state = reviewCard(newCardState(T0), 4, T0);
    expect(buildReviewQueue([{ key: "k", state }], T0 + 1000)).toEqual([]);
  });
});

describe("review session", () => {
  const cards = [{ key: "a" }, { key: "b" }, { key: "c" }];

  test("walks the queue; good/hard/easy finish a card", () => {
    let s = startSession(cards);
    expect(currentCard(s)?.key).toBe("a");
    expect(sessionProgress(s)).toEqual({ done: 0, left: 3, again: 0 });
    s = answerCard(s, "good");
    s = answerCard(s, "hard");
    expect(currentCard(s)?.key).toBe("c");
    s = answerCard(s, "easy");
    expect(isSessionOver(s)).toBe(true);
    expect(currentCard(s)).toBeNull();
    expect(sessionProgress(s)).toEqual({ done: 3, left: 0, again: 0 });
  });

  test("again sends the card to the end of the session", () => {
    let s = startSession(cards);
    s = answerCard(s, "again");
    expect(keys(s.queue)).toEqual(["b", "c", "a"]);
    expect(sessionProgress(s)).toEqual({ done: 0, left: 3, again: 1 });
  });

  test("a card comes back at most twice, then leaves the session", () => {
    let s = startSession([{ key: "a" }]);
    s = answerCard(s, "again");
    expect(currentCard(s)?.key).toBe("a");
    s = answerCard(s, "again");
    expect(currentCard(s)?.key).toBe("a");
    s = answerCard(s, "again");
    expect(isSessionOver(s)).toBe(true);
    expect(sessionProgress(s)).toEqual({ done: 1, left: 0, again: 3 });
    expect(s.againByKey).toEqual({ a: 3 });
  });

  test("maxAgain is configurable", () => {
    let s = startSession([{ key: "a" }], { maxAgain: 0 });
    s = answerCard(s, "again");
    expect(isSessionOver(s)).toBe(true);
  });

  test("steps never change the previous session (undo = keep the old value)", () => {
    const before = startSession(cards);
    const after = answerCard(before, "again");
    expect(keys(before.queue)).toEqual(["a", "b", "c"]);
    expect(before.again).toBe(0);
    expect(after).not.toBe(before);
  });

  test("answering a finished session changes nothing", () => {
    const over = startSession([]);
    expect(answerCard(over, "good")).toBe(over);
  });
});
