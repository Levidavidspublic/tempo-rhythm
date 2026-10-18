/**
 * The review session (/study/review) driven in the small TestNode DOM (tests/unit/record/testDom):
 * after a grade is saved, focus goes to the next card's Show answer, and after the last card to
 * the done state's title, so it never falls to the page. Sample cards are fictional.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, installTestDom, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();
const webDir = `${process.cwd()}/apps/web`;
const goalsShared = Bun.resolveSync("@/components/goals/shared", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const nextLink = Bun.resolveSync("next/link", webDir);
// goals/shared imports useConvexAuth, which other files' convex/react mocks leave out, so it is
// replaced outright (as study_screens.test.tsx does) rather than snapshotted.
const MOCKED = [localeProvider, nextLink];
const previous: Record<string, Record<string, unknown>> = {};
for (const key of MOCKED) previous[key] = { ...(await import(key)) };

function installModuleMocks() {
  mock.module(localeProvider, () => ({
    ...previous[localeProvider],
    useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
  }));
  // A stand-in that forwards every prop (other files mock next/link process-wide too).
  mock.module(nextLink, () => ({
    default: ({ href, children, ...rest }: { href: string; children: unknown } & Record<string, unknown>) =>
      createElement("a", { href, "data-next-link": "", ...rest }, children as never),
  }));
  mock.module(goalsShared, () => {
    const h = createElement;
    return {
      UNDO_WINDOW_MS: 300_000,
      useSignedIn: () => "ready",
      useOnline: () => true,
      ScreenBoundary: ({ children }: { children?: unknown }) => children,
      StateError: ({ title }: { title: string }) => h("div", null, title),
      SignedOutState: () => h("div", { "data-component": "StateSignedOut" }),
      OfflineNotice: ({ text }: { text: string }) => h("output", null, text),
      StateLoading: ({ label }: { label: string }) => h("output", null, label),
      StateEmpty: ({ title }: { title: string }) => h("div", null, title),
      makeToast: (title: string) => ({ id: 1, title, undoUntilMs: 0 }),
      UndoToast: () => null,
    };
  });
}
installModuleMocks();
const { ReviewSessionView } = await import("../../../apps/web/components/study/ReviewSessionView?review-focus-test");

let root: Root | null = null;
let host: TestNode | null = null;

async function render(node: ReturnType<typeof createElement>) {
  useTestDom(documentNode);
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(node);
  });
  return host;
}

beforeEach(() => {
  installModuleMocks();
  useTestDom(documentNode);
});
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});
afterAll(() => {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
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
      Object.defineProperty(documentNode, "activeElement", { configurable: true, writable: true, value: documentNode.body });
    },
  };
}

const one = (view: TestNode, match: (node: TestNode) => boolean) => {
  const found = findAll(view, match)[0];
  if (!found) throw new Error("not found");
  return found;
};
const byAction = (view: TestNode, action: string) => one(view, (node) => node.getAttribute?.("data-action") === action);
const grade = (view: TestNode, button: string) => one(view, (node) => node.getAttribute?.("data-grade") === button);
/** The focused node in a few words ("H2 All done for now", "BUTTON review-reveal"), for short diffs. */
const named = (node: TestNode | null | undefined) =>
  node ? `${node.tagName} ${node.getAttribute("data-action") ?? node.textContent}` : "none";

async function press(node: TestNode) {
  node.focus();
  await act(async () => {
    node.click();
  });
}

const cards = [
  { setId: "s1", setTitle: "Cell biology", cardId: "a", front: "Mitosis", back: "Two identical cells", state: null },
  { setId: "s1", setTitle: "Cell biology", cardId: "b", front: "Osmosis", back: "Water across a membrane", state: null },
];

describe("review session: focus after a saved grade", () => {
  test("the next card's Show answer, then the done state's title after the last card", async () => {
    const focus = trackFocus();
    try {
      const saved: string[] = [];
      const view = await render(
        createElement(ReviewSessionView, {
          cards,
          now: 0,
          online: true,
          onSave: async (key: string) => {
            saved.push(key);
            return { reviewId: `r${saved.length}`, undoUntil: Date.now() + 300_000 };
          },
          onUndo: async () => {},
        }),
      );
      await press(byAction(view, "review-reveal"));
      await press(grade(view, "good"));
      expect(named(focus.active)).toBe("BUTTON review-reveal");
      await press(byAction(view, "review-reveal"));
      await press(grade(view, "good"));
      expect(saved).toHaveLength(2);
      const doneTitle = translate("en", "st.rv.doneTitle");
      const title = one(view, (node) => node.tagName === "H2" && node.textContent === doneTitle);
      expect(title.getAttribute("tabindex")).toBe("-1");
      expect(named(focus.active)).toBe(`H2 ${doneTitle}`);
      expect(focus.active === title).toBe(true);
    } finally {
      focus.restore();
    }
  });
});
