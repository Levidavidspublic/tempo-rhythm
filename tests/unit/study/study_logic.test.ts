/**
 * Kitchen T3 study screens, the pure parts: the hub's focal card and groups, the review session's
 * keys, a set's due counts and attempt records, and the "missed ones" subsets.
 */
import { describe, expect, test } from "bun:test";
import type { TestData } from "@tempo/utils";
import { dayStart, groupSets, type HubData, type HubSet, hubFocus, reviewHref, setHref } from "../../../apps/web/components/study/hub";
import { countKey } from "../../../apps/web/components/study/labels";
import { cardKey, nextSnapshot, sessionItems, splitKey } from "../../../apps/web/components/study/session";
import {
  deckCounts,
  onlyQuizQuestions,
  onlyTestQuestions,
  quizAttempt,
  testAttempt,
} from "../../../apps/web/components/study/set-logic";
import { noteIdAround, studyBlockHref } from "../../../apps/web/components/study/study-block";

const set = (over: Partial<HubSet>): HubSet => ({
  setId: "s1",
  noteId: "n1",
  kind: "flashcards",
  title: "Cell biology",
  itemCount: 12,
  dueCount: 0,
  newCount: 0,
  ...over,
});
const hub = (over: Partial<HubData>): HubData => ({ dueCount: 0, newCount: 0, reviewedToday: 0, sets: [set({})], ...over });

describe("hub focus", () => {
  test("no sets is the empty state that teaches how to start", () => {
    expect(hubFocus(hub({ sets: [] }))).toEqual({ kind: "empty" });
  });
  test("cards due come first, with the new cards beside them", () => {
    expect(hubFocus(hub({ dueCount: 12, newCount: 4 }))).toEqual({ kind: "due", due: 12, fresh: 4 });
  });
  test("only new cards: still something to start", () => {
    expect(hubFocus(hub({ newCount: 8 }))).toEqual({ kind: "new", fresh: 8 });
  });
  test("nothing due and nothing new is calm, not a warning", () => {
    expect(hubFocus(hub({}))).toEqual({ kind: "clear" });
  });
});

describe("sets grouped by kind", () => {
  test("decks, then quizzes, then tests; due decks first inside a group", () => {
    const groups = groupSets([
      set({ setId: "t", kind: "test", title: "Mock exam" }),
      set({ setId: "a", title: "Anatomy", dueCount: 0, lastStudiedAt: 5 }),
      set({ setId: "b", title: "Botany", dueCount: 3 }),
      set({ setId: "q", kind: "quiz", title: "Quick check" }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["flashcards", "quiz", "test"]);
    expect(groups[0]?.sets.map((s) => s.setId)).toEqual(["b", "a"]);
  });
  test("empty kinds are left out", () => {
    expect(groupSets([set({ kind: "quiz" })]).map((g) => g.kind)).toEqual(["quiz"]);
  });
});

describe("links and days", () => {
  test("review links: everything due, or one set", () => {
    expect(reviewHref()).toBe("/study/review");
    expect(reviewHref("k1 2")).toBe("/study/review?set=k1%202");
    expect(setHref("abc")).toBe("/study/abc");
  });
  test("today starts at local midnight", () => {
    const now = new Date(2026, 9, 16, 15, 30).getTime();
    expect(dayStart(now)).toBe(new Date(2026, 9, 16).getTime());
  });
  test("counts pick the one or many key", () => {
    expect(countKey("st.due", 1)).toBe("st.due.one");
    expect(countKey("st.due", 0)).toBe("st.due.many");
    expect(countKey("st.row.cards", 7)).toBe("st.row.cards.many");
  });
  test("a study block in a page opens its set through /study/new, or the hub without a page", () => {
    expect(studyBlockHref("n 1", "blk_1")).toBe("/study/new?from=n%201&block=blk_1");
    expect(studyBlockHref(null, "blk_1")).toBe("/study");
    expect(noteIdAround(null)).toBeNull();
  });
});

describe("review session", () => {
  test("cards are keyed by set and card, and the key splits back", () => {
    const items = sessionItems([
      { setId: "s1", setTitle: "Deck", cardId: "c1", front: "Mitosis", back: "Cell division", hint: "M", state: null },
      { setId: "s2", setTitle: "Deck 2", cardId: "c1", front: "Osmosis", back: "Water moves", state: null },
    ]);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
    expect(items[0]?.hint).toBe("M");
    expect(items[1]).not.toHaveProperty("hint");
    expect(splitKey(cardKey("s2", "c1"))).toEqual({ setId: "s2", cardId: "c1" });
  });  test("a card graded in this session shows the state the grade returned (intervals follow it)", () => {
    const before = { ease: 2.5, intervalDays: 6, repetitions: 2, lapses: 0, dueAt: 0, lastReviewedAt: 0 };
    const after = { ease: 2.3, intervalDays: 0, repetitions: 0, lapses: 1, dueAt: 600_000, lastReviewedAt: 0 };
    const cards = [
      { setId: "s1", setTitle: "Deck", cardId: "c1", front: "Mitosis", back: "Cell division", state: before },
      { setId: "s1", setTitle: "Deck", cardId: "c2", front: "Osmosis", back: "Water moves", state: null },
    ];
    const items = sessionItems(cards, { [cardKey("s1", "c1")]: after });
    expect(items[0]?.state).toEqual(after);
    expect(items[1]?.state).toBeNull();
    expect(sessionItems(cards)[0]?.state).toEqual(before);
  });
  test("moving from ?set=A to ?set=B starts a new snapshot instead of keeping A's cards", () => {
    const card = (setId: string) => ({ setId, setTitle: setId, cardId: "c1", front: "f", back: "b", state: null });
    const a = nextSnapshot(null, "A", [card("A")], 1);
    expect(a?.cards.map((c) => c.setId)).toEqual(["A"]);
    // The same set keeps its snapshot even when the live queue changes after a grade.
    expect(nextSnapshot(a, "A", [], 2)).toBe(a);
    // Another set: nothing until its queue loads, then its own cards.
    expect(nextSnapshot(a, "B", undefined, 3)).toBeNull();
    expect(nextSnapshot(a, "B", [card("B")], 3)?.cards.map((c) => c.setId)).toEqual(["B"]);
  });
});

describe("a set", () => {
  test("due and new cards in a deck", () => {
    const now = 1000;
    const counts = deckCounts([{ id: "a" }, { id: "b" }, { id: "c" }], { a: { dueAt: 500 }, b: { dueAt: 5000 } }, now);
    expect(counts).toEqual({ due: 1, fresh: 1 });
  });
  test("a quiz attempt is ids and right-or-not only", () => {
    const attempt = quizAttempt(new Map([["q1", true], ["q2", false], ["q3", true]]));
    expect(attempt).toEqual({
      score: 2,
      maxScore: 3,
      answers: [
        { itemId: "q1", correct: true },
        { itemId: "q2", correct: false },
        { itemId: "q3", correct: true },
      ],
    });
  });
  test("a test attempt sends counted questions with points, never written words", () => {
    const attempt = testAttempt({
      sections: [{ sectionId: "s", counted: ["m1", "b1"], points: 6, max: 11 }],
      questions: { m1: { points: 1, max: 1 }, b1: { points: 5, max: 10 }, x: { points: 0, max: 3 } },
      total: 6,
      max: 11,
      percent: 55,
    });
    expect(attempt.answers).toEqual([
      { itemId: "m1", points: 1, maxPoints: 1 },
      { itemId: "b1", points: 5, maxPoints: 10 },
    ]);
    expect(JSON.stringify(attempt)).not.toContain("text");
  });
  test("missed quiz questions keep their order", () => {
    const q = (id: string) => ({ id, prompt: id, choices: [{ id: "a", text: "x" }, { id: "b", text: "y" }], answerId: "a", difficulty: 1 as const });
    expect(onlyQuizQuestions([q("1"), q("2"), q("3")], ["3", "1"]).map((x) => x.id)).toEqual(["1", "3"]);
  });
  test("missed test questions drop pick, the timer and empty sections", () => {
    const test: TestData = {
      title: "Mock",
      style: "bagrut",
      durationMin: 90,
      origin: "user",
      sections: [
        { id: "s1", title: "A", pick: 2, questions: [{ plugin: "short", id: "q1", prompt: "p", points: 2, accepted: ["x"] }, { plugin: "short", id: "q2", prompt: "p", points: 2, accepted: ["y"] }] },
        { id: "s2", title: "B", questions: [{ plugin: "short", id: "q3", prompt: "p", points: 2, accepted: ["z"] }] },
      ],
    };
    const cut = onlyTestQuestions(test, ["q2"]);
    expect(cut?.sections.map((s) => s.id)).toEqual(["s1"]);
    expect(cut?.sections[0]).not.toHaveProperty("pick");
    expect(cut).not.toHaveProperty("durationMin");
    expect(onlyTestQuestions(test, ["nope"])).toBeNull();
  });
});
