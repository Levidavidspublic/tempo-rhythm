/**
 * Kitchen states pass review: how the review session turns its reads into what it shows. With
 * `?set=`, the cards wait for `study.getSet`, so a gone set never flashes "Nothing to review".
 */
import { describe, expect, test } from "bun:test";
import { otherKindSet, type QueueCard, sessionView } from "../../../apps/web/components/study/session";

const card: QueueCard = { setId: "s1", setTitle: "Cells", cardId: "c1", front: "Mitosis", back: "Two cells", state: null };

describe("sessionView", () => {
  test("a ?set= that getSet answers null for is gone, whatever the queue says", () => {
    expect(sessionView({ signedOut: false, setId: "x", named: null, cards: [] })).toEqual({ cards: null, setGone: true });
    expect(sessionView({ signedOut: false, setId: "x", named: null, cards: null })).toEqual({ cards: null, setGone: true });
  });

  test("while getSet is still loading, an empty queue stays loading (no empty-state flash)", () => {
    expect(sessionView({ signedOut: false, setId: "x", named: undefined, cards: [] })).toEqual({ cards: null, setGone: false });
  });

  test("a set that is there shows the queue", () => {
    expect(sessionView({ signedOut: false, setId: "s1", named: { set: {} }, cards: [card] })).toEqual({ cards: [card], setGone: false });
    expect(sessionView({ signedOut: false, setId: "s1", named: { set: {} }, cards: [] })).toEqual({ cards: [], setGone: false });
  });

  test("without ?set= the queue alone decides; signed out has no cards", () => {
    expect(sessionView({ signedOut: false, setId: undefined, named: undefined, cards: [] })).toEqual({ cards: [], setGone: false });
    expect(sessionView({ signedOut: false, setId: undefined, named: undefined, cards: null })).toEqual({ cards: null, setGone: false });
    expect(sessionView({ signedOut: true, setId: "x", named: undefined, cards: null })).toEqual({ cards: [], setGone: false });
  });

  test("a live quiz or practice test says Review is for flashcards instead of the empty state", () => {
    const quiz = { set: { setId: "s4", kind: "quiz", title: "Photosynthesis check" } };
    expect(sessionView({ signedOut: false, setId: "s4", named: quiz, cards: [] })).toEqual({
      cards: null,
      setGone: false,
      otherKind: { setId: "s4", kind: "quiz", title: "Photosynthesis check" },
    });
    const test5 = { set: { setId: "s5", kind: "test", title: "Unit 2" } };
    expect(sessionView({ signedOut: false, setId: "s5", named: test5, cards: null }).otherKind).toEqual({
      setId: "s5",
      kind: "test",
      title: "Unit 2",
    });
  });

  test("a deck, a loading or gone set, and signed out never get otherKind", () => {
    const deck = { set: { setId: "s1", kind: "flashcards", title: "Cells" } };
    expect(sessionView({ signedOut: false, setId: "s1", named: deck, cards: [card] }).otherKind).toBeUndefined();
    expect(sessionView({ signedOut: false, setId: "s4", named: undefined, cards: [] }).otherKind).toBeUndefined();
    expect(sessionView({ signedOut: false, setId: "s4", named: null, cards: [] }).otherKind).toBeUndefined();
    const quiz = { set: { setId: "s4", kind: "quiz", title: "Q" } };
    expect(sessionView({ signedOut: true, setId: "s4", named: quiz, cards: null })).toEqual({ cards: [], setGone: false });
  });
});

describe("otherKindSet", () => {
  test("reads quiz and test sets loosely and ignores anything else", () => {
    expect(otherKindSet({ set: { setId: "s4", kind: "quiz" } })).toEqual({ setId: "s4", kind: "quiz", title: "" });
    expect(otherKindSet({ set: { setId: "s1", kind: "flashcards", title: "Cells" } })).toBeNull();
    expect(otherKindSet({ set: { kind: "quiz" } })).toBeNull();
    expect(otherKindSet({})).toBeNull();
    expect(otherKindSet(null)).toBeNull();
    expect(otherKindSet("quiz")).toBeNull();
  });
});
