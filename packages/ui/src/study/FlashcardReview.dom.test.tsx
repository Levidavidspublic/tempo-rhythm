/**
 * FlashcardReview mounted in the small TestNode DOM (tests/unit/record/testDom; there is no
 * Testing Library here): where focus goes after a grade, which static markup can't show. The
 * next card's Show answer (or answer field) takes it, and after the last card the done state's
 * title does, so focus never falls to the page.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  findAll,
  installTestDom,
  type TestNode,
  useTestDom as pointGlobalsAt,
} from "../../../../tests/unit/record/testDom";
import { FlashcardReview, type ReviewCardItem } from "./FlashcardReview";
import { reviewLabels } from "./test-fixtures";

const documentNode = installTestDom();

const now = Date.UTC(2026, 9, 16, 9);
const cards: ReviewCardItem[] = [
  { key: "c1", front: "Mitochondria", back: "Makes ATP", state: null },
  { key: "c2", front: "Ribosome", back: "Makes proteins", state: null },
];

let root: Root | null = null;
let host: TestNode | null = null;

async function mount(typed: boolean) {
  pointGlobalsAt(documentNode);
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(FlashcardReview, { cards, now, labels: reviewLabels, typed }));
  });
  return host;
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});

/**
 * Focus in the TestNode DOM: `focus()` records the node, and `document.activeElement` falls back
 * to the body once that node leaves the document, as browsers do.
 */
function trackFocus() {
  const proto = Object.getPrototypeOf(documentNode) as { focus: (this: TestNode) => void };
  const plainFocus = proto.focus;
  let focused: TestNode | null = null;
  proto.focus = function (this: TestNode) {
    focused = this;
  };
  Object.defineProperty(documentNode, "activeElement", {
    configurable: true,
    get: () => (focused && documentNode.contains(focused) ? focused : documentNode.body),
  });
  return {
    get active() {
      return documentNode.activeElement;
    },
    restore() {
      proto.focus = plainFocus;
      Object.defineProperty(documentNode, "activeElement", {
        configurable: true,
        writable: true,
        value: documentNode.body,
      });
    },
  };
}

const one = (view: TestNode, match: (node: TestNode) => boolean) => {
  const found = findAll(view, match)[0];
  if (!found) throw new Error("not found");
  return found;
};
const byAction = (view: TestNode, action: string) =>
  one(view, (node) => node.getAttribute("data-action") === action);
const grade = (view: TestNode, button: string) =>
  one(view, (node) => node.getAttribute("data-grade") === button);

/** The focused node in a few words ("H2 All done for now", "BUTTON review-reveal"), for short diffs. */
const named = (node: TestNode | null | undefined) =>
  node ? `${node.tagName} ${node.getAttribute("data-action") ?? node.textContent}` : "none";

async function press(node: TestNode) {
  node.focus();
  await act(async () => {
    node.click();
  });
}

describe("FlashcardReview, mounted: focus after a grade", () => {
  test("the next card's Show answer, then the done state's title after the last card", async () => {
    const focus = trackFocus();
    try {
      const view = await mount(false);
      await press(byAction(view, "review-reveal"));
      expect(focus.active?.tagName).toBe("FIELDSET");
      await press(grade(view, "good"));
      expect(named(focus.active)).toBe("BUTTON review-reveal");
      expect(focus.active === byAction(view, "review-reveal")).toBe(true);
      await press(byAction(view, "review-reveal"));
      await press(grade(view, "good"));
      const title = one(view, (node) => node.tagName === "H2");
      expect(title.textContent).toBe(reviewLabels.doneTitle);
      expect(title.getAttribute("tabindex")).toBe("-1");
      expect(named(focus.active)).toBe(`H2 ${reviewLabels.doneTitle}`);
      expect(focus.active === title).toBe(true);
    } finally {
      focus.restore();
    }
  });

  test("typed mode: the next card's answer field, then the done state's title", async () => {
    const focus = trackFocus();
    try {
      const view = await mount(true);
      await press(byAction(view, "review-check"));
      await press(grade(view, "hard"));
      expect(named(focus.active)).toBe("INPUT recall-input");
      await press(byAction(view, "review-check"));
      await press(grade(view, "easy"));
      const title = one(view, (node) => node.tagName === "H2");
      expect(named(focus.active)).toBe(`H2 ${reviewLabels.doneTitle}`);
      expect(focus.active === title).toBe(true);
    } finally {
      focus.restore();
    }
  });
});
