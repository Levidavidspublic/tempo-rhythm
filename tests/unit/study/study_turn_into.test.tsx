/**
 * Kitchen T3 fixes after the web review, driven in the small TestNode DOM (tests/unit/record/testDom):
 * "Ask the coach" never replaces an accepted or edited card (so its Undo and edits survive), and
 * the "Study" links on a page open /study client-side (so the page's pending autosave goes first).
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, findByTag, installTestDom, queryByTag, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();
const webDir = `${process.cwd()}/apps/web`;
const goalsShared = Bun.resolveSync("@/components/goals/shared", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const nextNavigation = Bun.resolveSync("next/navigation", webDir);
const nextLink = Bun.resolveSync("next/link", webDir);
// goals/shared imports useConvexAuth, which other files' convex/react mocks leave out, so it is
// replaced outright (as study_screens.test.tsx does) rather than snapshotted.
const MOCKED = [localeProvider, nextNavigation, nextLink];
const previous: Record<string, Record<string, unknown>> = {};
for (const key of MOCKED) previous[key] = { ...(await import(key)) };

const pushed: string[] = [];
function installModuleMocks() {
  mock.module(localeProvider, () => ({
    ...previous[localeProvider],
    useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
  }));
  mock.module(nextNavigation, () => ({
    ...previous[nextNavigation],
    useRouter: () => ({ push: (href: string) => pushed.push(href), replace() {}, prefetch() {}, back() {}, refresh() {} }),
  }));
  // A stand-in that marks next/link's anchors (other files mock next/link process-wide too).
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
      makeToast: (title: string, onUndo: () => Promise<void>) => ({ id: 1, title, onUndo }),
      // As the real toast does, a successful Undo closes it (onClose); a thrown one keeps it open.
      UndoToast: ({ toast, onClose }: { toast: { title: string; onUndo: () => Promise<void> }; onClose: () => void }) =>
        h(
          "output",
          { "data-component": "UndoToast" },
          h("span", null, toast.title),
          h("button", { type: "button", onClick: () => void toast.onUndo().then(onClose, () => {}) }, "Undo"),
        ),
    };
  });
}
installModuleMocks();
const { TurnIntoView } = await import("../../../apps/web/components/study/TurnIntoView?turn-into-test");
const { STUDY_NAVIGATE_EVENT, listenForStudyLinks, openStudyLink } = await import("../../../apps/web/components/study/study-block");
const { canAskCoach } = await import("../../../apps/web/components/study/preview");

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

async function click(node: TestNode) {
  await act(async () => {
    node.click();
  });
}

const byAction = (view: TestNode, action: string) => findAll(view, (n) => n.getAttribute?.("data-action") === action)[0] ?? null;

beforeEach(() => {
  installModuleMocks();
  useTestDom(documentNode);
  pushed.length = 0;
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

const PAGE = "# Cell biology\n\nMitosis: cell division\nOsmosis: water moving across a membrane\nDiffusion: spreading from high to low\n";

describe("Turn into: the coach never replaces a card in use", () => {
  test("after Accept the Undo toast stays and Ask the coach is gone; it comes back after Undo", async () => {
    const created: string[] = [];
    const undone: string[] = [];
    const view = await render(
      createElement(TurnIntoView, {
        note: { id: "n1", title: "Cell biology", body: PAGE },
        hasFrom: true,
        kind: "flashcards",
        online: true,
        onGenerate: async () => ({ status: "unavailable", reason: "busy" }),
        onCreate: async () => {
          created.push("s2");
          return { noteId: "n2", setId: "s2", undoUntil: 300_000 };
        },
        onUndo: async (setId: string) => {
          undone.push(setId);
        },
      }),
    );
    expect(byAction(view, "ask-coach")).not.toBeNull();
    await click(byAction(view, "accept") as TestNode);
    expect(created).toEqual(["s2"]);
    expect(findAll(view, (n) => n.getAttribute?.("data-status") === "accepted")).toHaveLength(1);
    expect(queryByTag(view, "OUTPUT", translate("en", "st.pv.toast"))).not.toBeNull();
    expect(byAction(view, "ask-coach")).toBeNull();
    // Undo still reaches the set that was made.
    await click(findByTag(view, "BUTTON", "Undo"));
    expect(undone).toEqual(["s2"]);
    expect(byAction(view, "ask-coach")).not.toBeNull();
  });

  test("while editing, Ask the coach is hidden so the edits can't be dropped", async () => {
    const view = await render(
      createElement(TurnIntoView, {
        note: { id: "n1", title: "Cell biology", body: PAGE },
        hasFrom: true,
        kind: "flashcards",
        online: true,
        onGenerate: async () => ({ status: "unavailable", reason: "busy" }),
        onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: 0 }),
        onUndo: async () => {},
      }),
    );
    await click(byAction(view, "edit") as TestNode);
    expect(findAll(view, (n) => n.getAttribute?.("data-component") === "DraftEditor")).toHaveLength(1);
    expect(byAction(view, "ask-coach")).toBeNull();
    await click(byAction(view, "edit") as TestNode);
    expect(byAction(view, "ask-coach")).not.toBeNull();
  });

  test("Undo that took changes made since says so, and Bring it back shows the set again (HARD_RULES §1)", async () => {
    const redone: string[] = [];
    const view = await render(
      createElement(TurnIntoView, {
        note: { id: "n1", title: "Cell biology", body: PAGE },
        hasFrom: true,
        kind: "flashcards",
        online: true,
        onGenerate: async () => ({ status: "unavailable", reason: "busy" }),
        onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: Date.now() + 300_000 }),
        onUndo: async () => ({ removedEdits: true, redoUntil: Date.now() + 300_000 }),
        onRedo: async (setId: string) => {
          redone.push(setId);
        },
      }),
    );
    await click(byAction(view, "accept") as TestNode);
    await click(findByTag(view, "BUTTON", "Undo"));
    // The set is taken back, always; the toast says what went with it and offers it back.
    expect(findAll(view, (n) => n.getAttribute?.("data-status") === "preview")).toHaveLength(1);
    expect(view.textContent).toContain(translate("en", "st.pv.undone"));
    expect(view.textContent).toContain("Removed, with its page and the changes made since.");
    expect(view.textContent).toContain("You can bring it back for");
    await click(findByTag(view, "BUTTON", "Bring it back"));
    expect(redone).toEqual(["s2"]);
    expect(findAll(view, (n) => n.getAttribute?.("data-status") === "accepted")).toHaveLength(1);
    expect(view.textContent).toContain("Brought back as it was, changes and all.");
    expect(findByTag(view, "A", translate("en", "st.pv.studyNow")).getAttribute("href")).toContain("s2");
    expect(queryByTag(view, "BUTTON", "Bring it back")).toBeNull();
    expect(byAction(view, "ask-coach")).toBeNull();
  });

  test("a plain Undo offers nothing to bring back", async () => {
    const view = await render(
      createElement(TurnIntoView, {
        note: { id: "n1", title: "Cell biology", body: PAGE },
        hasFrom: true,
        kind: "flashcards",
        online: true,
        onGenerate: async () => ({ status: "unavailable", reason: "busy" }),
        onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: Date.now() + 300_000 }),
        onUndo: async () => ({ removedEdits: false }),
        onRedo: async () => {},
      }),
    );
    await click(byAction(view, "accept") as TestNode);
    await click(findByTag(view, "BUTTON", "Undo"));
    expect(view.textContent).toContain(translate("en", "st.pv.undone"));
    expect(queryByTag(view, "BUTTON", "Bring it back")).toBeNull();
  });

  test("canAskCoach: only a plain preview, and only before the coach answered", () => {
    expect(canAskCoach("preview", false)).toBe(true);
    for (const phase of ["editing", "saving", "accepted", "rejected"] as const) expect(canAskCoach(phase, false)).toBe(false);
    expect(canAskCoach("preview", true)).toBe(false);
  });
});

describe("Study links open /study client-side", () => {
  const plain = () => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } });

  test("the editor card's link asks the host, which pushes with the router (no full reload)", () => {
    const page = new EventTarget();
    const link = new EventTarget();
    // The link sits inside the page: requests from the link reach the page's listener.
    link.addEventListener(STUDY_NAVIGATE_EVENT, (event) => page.dispatchEvent(new CustomEvent(STUDY_NAVIGATE_EVENT, { cancelable: true, detail: (event as CustomEvent).detail })) || event.preventDefault());
    const navigated: string[] = [];
    const reloads: string[] = [];
    const stop = listenForStudyLinks(page, (href) => navigated.push(href));
    const click = plain();
    openStudyLink(click, link, "/study/new?from=n1&block=b1", (href) => reloads.push(href));
    expect(click.defaultPrevented).toBe(true);
    expect(navigated).toEqual(["/study/new?from=n1&block=b1"]);
    expect(reloads).toEqual([]);
    stop();
    // With no host listening, it still gets there (a document navigation).
    openStudyLink(plain(), link, "/study", (href) => reloads.push(href));
    expect(reloads).toEqual(["/study"]);
  });

  test("a click asking for a new tab is left to the browser", () => {
    const click = { ...plain(), metaKey: true };
    const reloads: string[] = [];
    openStudyLink(click, new EventTarget(), "/study", (href) => reloads.push(href));
    expect(click.defaultPrevented).toBe(false);
    expect(reloads).toEqual([]);
  });

  test("the read view's Study link is a client-side link, not a plain anchor", async () => {
    const { StudyBlockView } = await import("../../../apps/web/components/study/StudyBlockView?turn-into-test");
    const view = await render(
      createElement(StudyBlockView, { block: { id: "blk", v: 1, type: "flashcards", data: { title: "Cells", origin: "user", cards: [{ id: "a", front: "f", back: "b" }] } } as never }),
    );
    const link = findByTag(view, "A", "Study");
    expect(link.getAttribute("data-next-link")).toBe("");
    expect(link.getAttribute("href")).toBe("/study");
  });
});

describe("Turn into: Bring it back offers the save's own Undo again", () => {
  const props = (over: Record<string, unknown>) => ({
    note: { id: "n1", title: "Cell biology", body: PAGE },
    hasFrom: true,
    kind: "flashcards",
    online: true,
    onGenerate: async () => ({ status: "unavailable", reason: "busy" }),
    onUndo: async () => ({ removedEdits: true, redoUntil: Date.now() + 300_000 }),
    onRedo: async () => {},
    ...over,
  });

  test("while the save's window is open, Undo is there again after Bring it back", async () => {
    const undone: string[] = [];
    const view = await render(
      createElement(
        TurnIntoView,
        props({
          onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: Date.now() + 300_000 }),
          onUndo: async (setId: string) => {
            undone.push(setId);
            return { removedEdits: true, redoUntil: Date.now() + 300_000 };
          },
        }) as never,
      ),
    );
    await click(byAction(view, "accept") as TestNode);
    await click(findByTag(view, "BUTTON", "Undo"));
    await click(findByTag(view, "BUTTON", "Bring it back"));
    await click(findByTag(view, "BUTTON", "Undo"));
    expect(undone).toEqual(["s2", "s2"]);
  });

  test("not once the save's window has ended", async () => {
    const view = await render(
      createElement(
        TurnIntoView,
        props({ onCreate: async () => ({ noteId: "n2", setId: "s2", undoUntil: Date.now() - 1 }) }) as never,
      ),
    );
    await click(byAction(view, "accept") as TestNode);
    await click(findByTag(view, "BUTTON", "Undo"));
    await click(findByTag(view, "BUTTON", "Bring it back"));
    expect(queryByTag(view, "BUTTON", "Undo")).toBeNull();
  });
});
