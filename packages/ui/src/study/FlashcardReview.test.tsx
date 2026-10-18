import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DAY_MS, type Sm2State } from "../../../core/srs/sm2";
import {
  FlashcardReview,
  FlashcardReviewView,
  initReview,
  notifyReview,
  type ReviewAction,
  type ReviewCardItem,
  type ReviewState,
  reviewKeyAction,
  reviewKeyDown,
  reviewReducer,
} from "./FlashcardReview";
import { reviewLabels } from "./test-fixtures";
import { byAction, click, hostElements } from "./test-tree";

const now = Date.UTC(2026, 9, 16, 9);
const learned: Sm2State = { ease: 2.5, intervalDays: 1, repetitions: 1, lapses: 0, dueAt: now };
const cards: ReviewCardItem[] = [
  { key: "c1", front: "Mitochondria", back: "Makes ATP", state: learned },
  { key: "c2", front: "גרעין", back: "Nucleus", hint: "Holds DNA", state: null },
];

const run = (actions: ReviewAction[], keys = ["c1", "c2"]) =>
  actions.reduce(reviewReducer, initReview(keys));
const reveal: ReviewAction = { type: "reveal" };
const grade = (button: "again" | "hard" | "good" | "easy"): ReviewAction => ({
  type: "grade",
  button,
});

const view = (state: ReviewState, onAction: (action: ReviewAction) => void = () => {}) =>
  createElement(FlashcardReviewView, { cards, now, labels: reviewLabels, state, onAction });
const html = (state: ReviewState) => renderToStaticMarkup(view(state));

describe("FlashcardReview session", () => {
  test("reveal, then grade: the card is done and the next one shows its front", () => {
    const state = run([reveal, grade("good")]);
    expect(state).toMatchObject({ queue: ["c2"], revealed: false, done: 1 });
  });

  test("grading before the answer is shown does nothing", () => {
    expect(run([grade("good")])).toEqual(initReview(["c1", "c2"]));
  });

  test("Again brings the card back at the end, at most twice", () => {
    const once = run([reveal, grade("again")]);
    expect(once).toMatchObject({ queue: ["c2", "c1"], done: 0, again: { c1: 1 } });
    const thrice = run(
      [reveal, grade("again"), reveal, grade("again"), reveal, grade("again")],
      ["c1"]
    );
    expect(thrice).toMatchObject({ queue: [], done: 1, again: { c1: 2 } });
  });

  test("Undo takes back the last grade, one at a time", () => {
    const graded = run([reveal, grade("good"), reveal, grade("easy")]);
    expect(graded.queue).toEqual([]);
    const once = reviewReducer(graded, { type: "undo" });
    expect(once).toMatchObject({ queue: ["c2"], revealed: true, done: 1 });
    const twice = reviewReducer(once, { type: "undo" });
    expect(twice).toMatchObject({ queue: ["c1", "c2"], revealed: true, done: 0, history: [] });
    expect(reviewReducer(initReview(["c1"]), { type: "undo" })).toEqual(initReview(["c1"]));
  });

  test("the host hears each grade and each Undo, with the card key", () => {
    const onGrade = mock((_grade: unknown) => {});
    const onUndo = mock((_grade: unknown) => {});
    const revealed = run([reveal]);
    notifyReview(revealed, grade("hard"), { onGrade, onUndo });
    expect(onGrade).toHaveBeenCalledWith({ key: "c1", button: "hard" });
    notifyReview(run([]), grade("hard"), { onGrade, onUndo });
    expect(onGrade).toHaveBeenCalledTimes(1);
    notifyReview(run([reveal, grade("easy")]), { type: "undo" }, { onGrade, onUndo });
    expect(onUndo).toHaveBeenCalledWith({ key: "c1", button: "easy" });
  });
});

describe("FlashcardReview keyboard", () => {
  test("Space or Enter shows the answer; then 1 to 4 grade", () => {
    expect(reviewKeyAction(" ", false)).toEqual(reveal);
    expect(reviewKeyAction("Enter", false)).toEqual(reveal);
    expect(reviewKeyAction("3", false)).toBeNull();
    expect(reviewKeyAction("1", true)).toEqual(grade("again"));
    expect(reviewKeyAction("3", true)).toEqual(grade("good"));
    expect(reviewKeyAction("4", true)).toEqual(grade("easy"));
    expect(reviewKeyAction("5", true)).toBeNull();
  });

  test("the handler prevents the page scroll for keys it uses", () => {
    const sent: ReviewAction[] = [];
    const preventDefault = mock(() => {});
    reviewKeyDown(false, (action) => sent.push(action))({
      key: " ",
      target: null,
      preventDefault,
    } as never);
    expect(sent).toEqual([reveal]);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe("FlashcardReview view", () => {
  test("before reveal: the front, progress and one Show answer button", () => {
    const markup = html(initReview(["c1", "c2"]));
    expect(markup).toContain('data-component="FlashcardReview"');
    expect(markup).toContain('data-side="front"');
    expect(markup).toContain(
      '<span class="tp-num">0</span> done, <span class="tp-num">2</span> to go'
    );
    expect(markup).toContain('data-action="review-reveal">Show answer</button>');
    expect(markup).not.toContain("review-grade");
    expect(markup).not.toContain("review-undo");
  });

  test("after reveal: four buttons, each with the interval SM-2 would set", () => {
    const markup = html(run([reveal]));
    expect(markup).toContain('data-side="back"');
    expect(markup).toContain('aria-label="Good · 6 days"');
    expect(markup).toContain('aria-label="Again · 1 day"');
    expect(markup).toContain('<span class="tp-num">6</span> days');
    const grades = [...markup.matchAll(/data-grade="(\w+)"/g)].map((match) => match[1]);
    expect(grades).toEqual(["again", "hard", "good", "easy"]);
    expect(markup.match(/tp-btn--primary/g)).toBeNull();
  });

  test("a new card previews from a fresh state", () => {
    const markup = html(run([reveal, grade("good"), reveal]));
    expect(markup).toContain('dir="auto">Nucleus</p>');
    expect(markup).toContain('aria-label="Good · 1 day"');
  });

  test("grade buttons send their grade; Undo shows once there is something to undo", () => {
    const sent: ReviewAction[] = [];
    const tree = view(run([reveal]), (action) => sent.push(action));
    for (const element of hostElements(tree).filter((e) => e.props["data-grade"])) click(element);
    expect(sent).toEqual([grade("again"), grade("hard"), grade("good"), grade("easy")]);
    const after = view(run([reveal, grade("good")]), (action) => sent.push(action));
    click(byAction(after, "review-undo"));
    expect(sent.at(-1)).toEqual({ type: "undo" });
  });

  test("the end state is calm and keeps Undo for the last grade", () => {
    const markup = html(run([reveal, grade("good"), reveal, grade("good")]));
    expect(markup).toContain('data-state="done"');
    expect(markup).toContain("All done for now");
    expect(markup).toContain('You reviewed <span class="tp-num">2</span> cards.');
    expect(markup).toContain("Undo");
  });

  test("the host can hide Undo when its window has passed", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardReviewView, {
        cards,
        now,
        labels: reviewLabels,
        state: run([reveal, grade("good")]),
        onAction: () => {},
        undoAvailable: false,
      })
    );
    expect(markup).not.toContain("review-undo");
  });

  test("the stateful review renders the first card and never an empty button", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardReview, { cards, now: now + DAY_MS, labels: reviewLabels })
    );
    expect(markup).toContain("Mitochondria");
    expect(markup).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});
