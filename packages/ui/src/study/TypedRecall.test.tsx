import { describe, expect, mock, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Sm2State } from "../../../core/srs/sm2";
import {
  type DeckAction,
  type DeckState,
  deckReducer,
  FlashcardDeck,
  FlashcardDeckView,
  initDeck,
} from "./FlashcardDeck";
import {
  FlashcardReview,
  FlashcardReviewView,
  initReview,
  type ReviewAction,
  type ReviewCardItem,
  type ReviewState,
  reviewReducer,
} from "./FlashcardReview";
import { deckLabels, recallLabels, reviewLabels } from "./test-fixtures";
import { byAction, type Found, hostElements } from "./test-tree";
import { RecallVerdict, recallKeyAction, recallKeyDown } from "./TypedRecall";

const now = Date.UTC(2026, 9, 16, 9);
const learned: Sm2State = { ease: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, dueAt: now };
const cards: ReviewCardItem[] = [
  { key: "c1", front: "Mitochondria", back: "Makes ATP", state: learned },
  { key: "c2", front: "גרעין", back: "שָׁלוֹם", hint: "Holds DNA", state: null },
];

const run = (actions: ReviewAction[], keys = ["c1", "c2"]) =>
  actions.reduce(reviewReducer, initReview(keys));
const typing = (text: string): ReviewAction => ({ type: "type", text });
const reveal: ReviewAction = { type: "reveal" };

const view = (state: ReviewState, onAction: (action: ReviewAction) => void = () => {}) =>
  createElement(FlashcardReviewView, {
    cards,
    now,
    labels: reviewLabels,
    state,
    onAction,
    onKeyDown: () => {},
    typed: true,
  });
const html = (state: ReviewState) => renderToStaticMarkup(view(state));
const primaries = (markup: string) => markup.match(/tp-btn--primary/g)?.length ?? 0;
const input = (tree: ReactNode): Found => byAction(tree, "recall-input");

function keyEvent(key: string, extra: Record<string, unknown> = {}) {
  const preventDefault = mock(() => {});
  return { key, preventDefault, ...extra } as never as Parameters<
    ReturnType<typeof recallKeyDown>
  >[0] & { preventDefault: ReturnType<typeof mock> };
}

describe("recall keys", () => {
  test("Enter checks; Escape clears only when there is text; typing in an IME is left alone", () => {
    expect(recallKeyAction("Enter", "")).toBe("check");
    expect(recallKeyAction("Enter", "atp")).toBe("check");
    expect(recallKeyAction("Escape", "atp")).toBe("clear");
    expect(recallKeyAction("Escape", "")).toBeNull();
    expect(recallKeyAction(" ", "atp")).toBeNull();
    expect(recallKeyAction("3", "atp")).toBeNull();
    expect(recallKeyAction("Enter", "atp", true)).toBeNull();
  });

  test("the handler prevents the default only for keys it uses", () => {
    const taken: string[] = [];
    const enter = keyEvent("Enter");
    expect(recallKeyDown("x", (action) => taken.push(action))(enter)).toBe("check");
    expect(enter.preventDefault).toHaveBeenCalledTimes(1);
    const letter = keyEvent("a");
    expect(recallKeyDown("x", (action) => taken.push(action))(letter)).toBeNull();
    expect(letter.preventDefault).not.toHaveBeenCalled();
    const composing = keyEvent("Enter", { nativeEvent: { isComposing: true } });
    expect(recallKeyDown("x", (action) => taken.push(action))(composing)).toBeNull();
    expect(taken).toEqual(["check"]);
  });
});

describe("RecallVerdict", () => {
  test.each([
    ["matches", "Matches"],
    ["close", "Close"],
    ["different", "Different"],
  ] as const)("%p: the typed answer, an icon and the word", (result, word) => {
    const markup = renderToStaticMarkup(
      createElement(RecallVerdict, { typed: "  Makes ATP ", result, labels: recallLabels })
    );
    expect(markup).toContain(`data-result="${result}"`);
    expect(markup).toContain('Your answer</span> <span dir="auto">Makes ATP</span>');
    expect(markup).toMatch(new RegExp(`<svg[^>]*aria-hidden="true"[\\s\\S]*</svg><span>${word}</span>`));
  });

  test("nothing typed: says so in words, with no empty answer line", () => {
    const markup = renderToStaticMarkup(
      createElement(RecallVerdict, { typed: "", result: "empty", labels: recallLabels })
    );
    expect(markup).toContain("<span>No answer typed</span>");
    expect(markup).not.toContain("Your answer");
    expect(markup).toContain("<svg");
  });
});

describe("FlashcardReview typed session", () => {
  test("typing changes the answer on the front only; a grade starts the next card empty", () => {
    expect(run([typing("Makes ATP")]).answer).toBe("Makes ATP");
    expect(run([typing("Makes ATP"), reveal, typing("other")]).answer).toBe("Makes ATP");
    const next = run([typing("Makes ATP"), reveal, { type: "grade", button: "good" }]);
    expect(next).toMatchObject({ queue: ["c2"], revealed: false, answer: "" });
    expect(run([], []).answer).toBe("");
    expect(run([typing("x")], [])).toEqual(initReview([]));
  });

  test("Escape clears the field; clearing an empty field changes nothing", () => {
    expect(run([typing("ATP"), { type: "clear" }]).answer).toBe("");
    const empty = run([]);
    expect(reviewReducer(empty, { type: "clear" })).toBe(empty);
  });

  test("Undo brings the card back with its typed answer and the comparison", () => {
    const graded = run([typing("Makes ATQ"), reveal, { type: "grade", button: "hard" }]);
    const undone = reviewReducer(graded, { type: "undo" });
    expect(undone).toMatchObject({ queue: ["c1", "c2"], revealed: true, answer: "Makes ATQ" });
    expect(html(undone)).toContain('data-result="close"');
  });
});

describe("FlashcardReview typed view", () => {
  test("before Check: the front, a labelled field, one primary Check and the typed keys", () => {
    const markup = html(run([typing("Makes")]));
    expect(markup).toContain('data-side="front"');
    expect(markup).toContain('<span class="tp-label">Your answer</span>');
    expect(markup).toMatch(/<label class="tp-field tp-study-recall__field">[\s\S]*<input[^>]*dir="auto"/);
    expect(markup).toContain('value="Makes"');
    expect(markup).toContain('data-action="review-check">Check</button>');
    expect(markup).not.toContain("Show answer");
    expect(markup).toContain("Enter checks. Escape clears. Then 1 to 4 grade it.");
    expect(markup).not.toContain("Space shows the answer");
    expect(markup).not.toContain("review-grade");
    expect(markup).not.toContain("RecallVerdict");
    expect(primaries(markup)).toBe(1);
  });

  test("typing, Enter and Escape in the field send their actions", () => {
    const sent: ReviewAction[] = [];
    const tree = view(run([typing("Makes")]), (action) => sent.push(action));
    const field = input(tree);
    (field.props.onChange as (event: unknown) => void)({ currentTarget: { value: "Makes ATP" } });
    (field.props.onKeyDown as (event: unknown) => void)(keyEvent("Enter"));
    (field.props.onKeyDown as (event: unknown) => void)(keyEvent("Escape"));
    expect(sent).toEqual([typing("Makes ATP"), reveal, { type: "clear" }]);
    const empty = view(run([]), (action) => sent.push(action));
    (input(empty).props.onKeyDown as (event: unknown) => void)(keyEvent("Escape"));
    expect(sent).toHaveLength(3);
  });

  test.each([
    ["Makes ATP", "matches", "Matches", "good"],
    ["makes atp!", "matches", "Matches", "good"],
    ["Makes ATQ", "close", "Close", "hard"],
    ["Ribosome", "different", "Different", "again"],
  ] as const)("after Check, %p: %p in words, %p suggested, the person still grades", (typed, result, word, grade) => {
    const markup = html(run([typing(typed), reveal]));
    expect(markup).toContain('data-side="back"');
    expect(markup).toContain(`data-result="${result}"`);
    expect(markup).toContain(`<span>${word}</span>`);
    expect(markup).toContain(`Your answer</span> <span dir="auto">${typed}</span>`);
    expect(markup).not.toContain('data-action="recall-input"');
    const grades = [...markup.matchAll(/data-grade="(\w+)"/g)].map((match) => match[1]);
    expect(grades).toEqual(["again", "hard", "good", "easy"]);
    const suggested = [...markup.matchAll(/data-grade="(\w+)" data-suggested="true"/g)].map((m) => m[1]);
    expect(suggested).toEqual([grade]);
    expect(markup.match(/class="tp-study-grade__suggested">Suggested</g)).toHaveLength(1);
    expect(markup).toMatch(/aria-label="[A-Za-z]+ · \d+ days? · Suggested"/);
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-typed="true"');
    expect(primaries(markup)).toBe(0);
  });

  test("Check with nothing typed turns the card over and says so, with no suggestion", () => {
    const markup = html(run([reveal]));
    expect(markup).toContain('data-side="back"');
    expect(markup).toContain('data-result="empty"');
    expect(markup).toContain("No answer typed");
    expect(markup).not.toContain("data-suggested");
    expect(markup).not.toContain("tp-study-grade__suggested");
    expect(markup).not.toContain("tp-error");
  });

  test("Hebrew with niqqud on the back matches the plain spelling", () => {
    const state = run([typing("Makes ATP"), reveal, { type: "grade", button: "good" }, typing("שלום"), reveal]);
    const markup = html(state);
    expect(markup).toContain('data-result="matches"');
    expect(markup).toContain('<span dir="auto">שלום</span>');
  });

  test("1 to 4 work while the grade group itself has focus, and only then", () => {
    const keys: string[] = [];
    const tree = createElement(FlashcardReviewView, {
      cards,
      now,
      labels: reviewLabels,
      state: run([reveal]),
      onAction: () => {},
      onKeyDown: (event) => keys.push(event.key),
      typed: true,
    });
    const group = hostElements(tree).find((element) => element.type === "fieldset");
    const onKeyDown = group?.props.onKeyDown as (event: unknown) => void;
    const self = {};
    onKeyDown({ key: "3", target: self, currentTarget: self });
    onKeyDown({ key: "2", target: {}, currentTarget: self });
    expect(keys).toEqual(["3"]);
  });

  test("outside typed mode the grade group still takes focus after Show answer, without typed marks", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardReviewView, { cards, now, labels: reviewLabels, state: run([reveal]), onAction: () => {} })
    );
    // Show answer goes away when the card turns over, so the group (tabindex -1) takes focus.
    expect(markup).toContain('<fieldset class="tp-study-grades"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).not.toContain("data-typed");
    expect(markup).not.toContain("RecallVerdict");
  });

  test("the stateful review in typed mode: Check, the field, and read-aloud on both faces", () => {
    const slot = (text: string) => createElement("span", { "data-component": "ReadAloudButton" }, text);
    const markup = renderToStaticMarkup(
      createElement(FlashcardReview, { cards, now, labels: reviewLabels, readAloud: slot, typed: true })
    );
    expect(markup.match(/data-component="ReadAloudButton"/g)).toHaveLength(2);
    expect(markup).toContain('data-action="review-check"');
    expect(markup).toContain('data-action="recall-input"');
    expect(markup).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});

const deckCards = [
  { front: "Mitochondria", back: "Makes ATP" },
  { front: "תא", back: "Cell" },
];
const deckRun = (actions: DeckAction[]) => actions.reduce(deckReducer, initDeck(deckCards.length));
const deckView = (state: DeckState, onAction: (action: DeckAction) => void = () => {}) =>
  createElement(FlashcardDeckView, { cards: deckCards, labels: deckLabels, state, onAction, typed: true });
const deckHtml = (state: DeckState) => renderToStaticMarkup(deckView(state));

describe("FlashcardDeck typed mode", () => {
  test("the answer is typed on the front, kept on a flip and cleared on a move", () => {
    expect(deckRun([{ type: "type", text: "ATP" }]).answer).toBe("ATP");
    expect(deckRun([{ type: "flip" }, { type: "type", text: "ATP" }]).answer).toBeUndefined();
    expect(deckRun([{ type: "type", text: "ATP" }, { type: "flip" }]).answer).toBe("ATP");
    expect(deckRun([{ type: "type", text: "ATP" }, { type: "next" }])).toEqual({
      order: [0, 1],
      index: 1,
      side: "front",
    });
    expect(deckRun([{ type: "type", text: "ATP" }, { type: "clear" }])).toEqual(initDeck(2));
    expect(deckRun([{ type: "type", text: "ATP" }, { type: "type", text: "" }])).toEqual(initDeck(2));
  });

  test("front: the field and one primary Check, which is not a toggle", () => {
    const markup = deckHtml(deckRun([{ type: "type", text: "Makes" }]));
    expect(markup).toContain('<span class="tp-label">Your answer</span>');
    expect(markup).toContain('value="Makes"');
    expect(markup).toContain('data-action="card-check">Check</button>');
    expect(markup).not.toContain("aria-pressed");
    expect(markup).toContain("Enter checks. Escape clears.");
    expect(primaries(markup)).toBe(1);
  });

  test("back: what was typed and the comparison; the main button turns the card back", () => {
    const markup = deckHtml(deckRun([{ type: "type", text: "makes atp" }, { type: "flip" }]));
    expect(markup).toContain('data-result="matches"');
    expect(markup).toContain("<span>Matches</span>");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(">Show front</button>");
    expect(markup).not.toContain('data-action="recall-input"');
    expect(deckHtml(deckRun([{ type: "flip" }]))).toContain("No answer typed");
  });

  test("Enter in the field checks and keeps focus on the deck's main button", () => {
    const sent: DeckAction[] = [];
    const focus = mock(() => {});
    const button = { focus };
    const deck = { querySelector: (selector: string) => (selector.includes("card-check") ? button : null) };
    const field = input(deckView(deckRun([{ type: "type", text: "ATP" }]), (action) => sent.push(action)));
    (field.props.onKeyDown as (event: unknown) => void)(
      keyEvent("Enter", { currentTarget: { closest: () => deck } })
    );
    expect(sent).toEqual([{ type: "flip" }]);
    expect(focus).toHaveBeenCalledTimes(1);
    (field.props.onKeyDown as (event: unknown) => void)(
      keyEvent("Escape", { currentTarget: { closest: () => deck } })
    );
    expect(sent.at(-1)).toEqual({ type: "clear" });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  test("off by default: the deck looks as it always did", () => {
    const markup = renderToStaticMarkup(createElement(FlashcardDeck, { cards: deckCards, labels: deckLabels }));
    expect(markup).not.toContain("recall-input");
    expect(markup).toContain('data-action="card-flip"');
    expect(markup).toContain('aria-pressed="false"');
  });
});
