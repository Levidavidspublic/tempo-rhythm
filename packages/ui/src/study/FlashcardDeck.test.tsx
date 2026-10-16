import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type DeckAction,
  type DeckState,
  deckKeyAction,
  deckKeyDown,
  deckReducer,
  FlashcardDeck,
  FlashcardDeckView,
  initDeck,
} from "./FlashcardDeck";
import { deckLabels } from "./test-fixtures";
import { byAction, click, hostElements } from "./test-tree";

const cards = [
  { front: "Mitochondria", back: "Makes ATP", hint: "Powerhouse" },
  { front: "Ribosome", back: "Builds proteins" },
  { front: "תא", back: "Cell" },
];

const run = (actions: DeckAction[]) => actions.reduce(deckReducer, initDeck(cards.length));

function keyEvent(key: string, options: { dir?: string; fromButton?: boolean } = {}) {
  const preventDefault = mock(() => {});
  const currentTarget = {
    closest: () => (options.dir ? { getAttribute: () => options.dir } : null),
  };
  const target = options.fromButton ? { closest: () => ({}) } : { closest: () => null };
  return { key, target, currentTarget, preventDefault } as never as Parameters<
    ReturnType<typeof deckKeyDown>
  >[0] & { preventDefault: ReturnType<typeof mock> };
}

function pressed(
  key: string,
  options: { dir?: string; fromButton?: boolean; prop?: "ltr" | "rtl" } = {}
) {
  const dispatched: DeckAction[] = [];
  const event = keyEvent(key, options);
  deckKeyDown(options.prop, (action) => dispatched.push(action))(event);
  return { dispatched, prevented: event.preventDefault.mock.calls.length > 0 };
}

const view = (state: DeckState, onAction: (action: DeckAction) => void = () => {}) =>
  createElement(FlashcardDeckView, { cards, labels: deckLabels, state, onAction });
const html = (state: DeckState) => renderToStaticMarkup(view(state));

describe("FlashcardDeck state", () => {
  test("flip turns the card and back again; moving shows the front of the next card", () => {
    expect(run([{ type: "flip" }]).side).toBe("back");
    expect(run([{ type: "flip" }, { type: "flip" }]).side).toBe("front");
    expect(run([{ type: "flip" }, { type: "next" }])).toMatchObject({ index: 1, side: "front" });
  });

  test("the ends do not wrap", () => {
    expect(run([{ type: "prev" }]).index).toBe(0);
    expect(run([{ type: "next" }, { type: "next" }, { type: "next" }]).index).toBe(2);
  });

  test("shuffle reorders with the given random source and starts over", () => {
    const shuffled = run([{ type: "next" }, { type: "shuffle", random: () => 0 }]);
    expect(shuffled).toEqual({ order: [1, 2, 0], index: 0, side: "front" });
    expect([...shuffled.order].sort()).toEqual([0, 1, 2]);
  });
});

describe("FlashcardDeck keyboard", () => {
  test("Space and Enter flip; arrows move in LTR", () => {
    expect(deckKeyAction(" ", "ltr")).toEqual({ type: "flip" });
    expect(deckKeyAction("Enter", "ltr")).toEqual({ type: "flip" });
    expect(deckKeyAction("ArrowRight", "ltr")).toEqual({ type: "next" });
    expect(deckKeyAction("ArrowLeft", "ltr")).toEqual({ type: "prev" });
    expect(deckKeyAction("a", "ltr")).toBeNull();
  });

  test("arrows swap in RTL", () => {
    expect(deckKeyAction("ArrowRight", "rtl")).toEqual({ type: "prev" });
    expect(deckKeyAction("ArrowLeft", "rtl")).toEqual({ type: "next" });
  });

  test("the handler reads dir from the closest element, and the dir prop wins", () => {
    expect(pressed("ArrowLeft", { dir: "rtl" }).dispatched).toEqual([{ type: "next" }]);
    expect(pressed("ArrowLeft").dispatched).toEqual([{ type: "prev" }]);
    expect(pressed("ArrowLeft", { dir: "rtl", prop: "ltr" }).dispatched).toEqual([
      { type: "prev" },
    ]);
    expect(pressed("ArrowRight", { prop: "rtl" }).dispatched).toEqual([{ type: "prev" }]);
  });

  test("handled keys stop the page scrolling; other keys and Space on a button pass through", () => {
    expect(pressed(" ")).toEqual({ dispatched: [{ type: "flip" }], prevented: true });
    expect(pressed("Tab")).toEqual({ dispatched: [], prevented: false });
    expect(pressed(" ", { fromButton: true })).toEqual({ dispatched: [], prevented: false });
  });
});

describe("FlashcardDeck view", () => {
  test("shows the front, the position as numbers and an unpressed flip button", () => {
    const markup = html(initDeck(3));
    expect(markup).toContain('data-component="FlashcardDeck"');
    expect(markup).toContain('class="tp-flashcard" data-component="Flashcard" data-side="front"');
    expect(markup).toContain('<span class="tp-num">1</span> of <span class="tp-num">3</span>');
    expect(markup).toMatch(/data-action="card-flip" aria-pressed="false">Show back</);
    expect(markup).toMatch(/data-dir="prev" disabled=""/);
    expect(markup).toContain('dir="auto">Mitochondria</p>');
    expect(markup).toContain("Powerhouse");
    expect(markup).toContain('aria-label="Flashcard"');
    expect(markup).toContain('aria-live="polite"');
  });

  test("flipped: the back side and a pressed flip button", () => {
    const markup = html({ ...initDeck(3), side: "back" });
    expect(markup).toContain('data-side="back"');
    expect(markup).toMatch(/aria-pressed="true">Show front</);
  });

  test("Hebrew text keeps dir=auto; arrows flip with the page direction", () => {
    const markup = html({ ...initDeck(3), index: 2 });
    expect(markup).toContain('dir="auto">תא</p>');
    expect(markup).toContain("tp-icon tp-icon--flip");
    expect(markup).toContain("tp-icon tp-icon--back");
    expect(markup).toMatch(/data-dir="next" disabled=""/);
  });

  test("every deck button carries the keyboard handler", () => {
    const onKeyDown = () => {};
    const tree = createElement(FlashcardDeckView, {
      cards,
      labels: deckLabels,
      state: initDeck(3),
      onAction: () => {},
      onKeyDown,
    });
    const buttons = hostElements(tree).filter((element) => element.type === "button");
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(button.props.onKeyDown).toBe(onKeyDown);
  });

  test("buttons send their actions (flip by button, never hover)", () => {
    const sent: DeckAction[] = [];
    const tree = view({ ...initDeck(3), index: 1 }, (action) => sent.push(action));
    click(byAction(tree, "card-flip"));
    for (const element of hostElements(tree).filter((e) => e.props["data-dir"])) click(element);
    expect(sent.map((action) => action.type)).toEqual(["flip", "prev", "next"]);
    expect(
      hostElements(tree).some((e) => "onMouseEnter" in e.props || "onMouseOver" in e.props)
    ).toBe(false);
  });

  test("the stateful deck renders its first card", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardDeck, { cards, labels: deckLabels, dir: "rtl" })
    );
    expect(markup).toContain("Mitochondria");
    expect(markup).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});
