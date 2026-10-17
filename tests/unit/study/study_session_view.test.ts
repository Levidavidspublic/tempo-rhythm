/**
 * Kitchen states pass review: how the review session turns its reads into what it shows. With
 * `?set=`, the cards wait for `study.getSet`, so a gone set never flashes "Nothing to review".
 */
import { describe, expect, test } from "bun:test";
import { type QueueCard, sessionView } from "../../../apps/web/components/study/session";

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
});
