/**
 * Editing a saved set while offline, driven in the small TestNode DOM (tests/unit/record/testDom):
 * Save waits with the offline words instead of sticking on "Saving…" (Convex would hold the
 * mutation until the connection is back), Cancel stays available, and the save goes ahead by
 * itself once the browser is back online. Sample data is fictional.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, findById, installTestDom, type TestNode, typeInto, useTestDom } from "../record/testDom";

const documentNode = installTestDom();
const webDir = `${process.cwd()}/apps/web`;
const goalsShared = Bun.resolveSync("@/components/goals/shared", webDir);
// goals/shared imports useConvexAuth, which other files' convex/react mocks leave out, so it is
// replaced outright with the same stand-in as study_screens.test.tsx.
function installModuleMocks() {
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
const { SetEditor } = await import("../../../apps/web/components/study/SetEditor?set-edit-offline-test");
const { closedEdit, setEditReducer } = await import("../../../apps/web/components/study/set-edit");
type StudyPreview = import("../../../apps/web/components/study/preview").StudyPreview;

const t = (key: MessageKey) => translate("en", key);
const deck = {
  title: "Cell biology",
  origin: "user" as const,
  cards: [
    { id: "a", front: "Mitosis", back: "Division" },
    { id: "b", front: "Osmosis", back: "Water" },
  ],
};
const base: StudyPreview = { kind: "flashcards", data: deck };
const editing = setEditReducer(closedEdit, { type: "open", version: "v1" });

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
async function rerender(node: ReturnType<typeof createElement>) {
  await act(async () => {
    root?.render(node);
  });
}
async function click(node: TestNode) {
  await act(async () => {
    node.click();
  });
}
async function type(node: TestNode, text: string) {
  await act(async () => {
    typeInto(node, text);
  });
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

const byAction = (view: TestNode, action: string) => {
  const found = findAll(view, (node) => node.getAttribute?.("data-action") === action)[0];
  if (!found) throw new Error(`Missing ${action}`);
  return found;
};

function editorWith(over: Record<string, unknown>) {
  const saves: StudyPreview[] = [];
  let cancels = 0;
  const props = {
    base,
    pageTitle: "Biology notes",
    state: editing,
    currentVersion: "v1",
    t,
    onSave: (next: StudyPreview) => void saves.push(next),
    onCancel: () => {
      cancels += 1;
    },
    onReload: () => {},
    ...over,
  };
  return {
    saves,
    cancels: () => cancels,
    element: (more: Record<string, unknown> = {}) => createElement(SetEditor, { ...props, ...more } as never),
  };
}

describe("editing a set offline", () => {
  test("Save waits with the offline words and Cancel stays; back online, it saves once by itself", async () => {
    const editor = editorWith({ online: false });
    const view = await render(editor.element());
    await type(findById(view, "st-ed-title"), "Cell biology, unit 2");
    const save = byAction(view, "save-edit");
    await click(save);
    expect(editor.saves).toHaveLength(0);
    expect(save.textContent).toBe(translate("en", "ig.waiting"));
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(byAction(view, "cancel-edit").hasAttribute("disabled")).toBe(false);

    await rerender(editor.element({ online: true }));
    expect(editor.saves).toHaveLength(1);
    expect(editor.saves[0]).toMatchObject({ kind: "flashcards", data: { title: "Cell biology, unit 2" } });
    expect(save.textContent).toBe("Save changes");
    await rerender(editor.element({ online: true }));
    expect(editor.saves).toHaveLength(1);
  });

  test("Cancel while a save waits closes the list without saving", async () => {
    const editor = editorWith({ online: false });
    const view = await render(editor.element());
    await type(findById(view, "st-ed-title"), "Cell biology, unit 2");
    await click(byAction(view, "save-edit"));
    await click(byAction(view, "cancel-edit"));
    expect(editor.cancels()).toBe(1);
    expect(editor.saves).toHaveLength(0);
  });

  test("a save already sent when the connection drops says it waits for the connection", async () => {
    const editor = editorWith({ online: false, state: setEditReducer(editing, { type: "save" }) });
    const view = await render(editor.element());
    const save = byAction(view, "save-edit");
    expect(save.textContent).toBe(translate("en", "ig.waiting"));
    expect(save.getAttribute("aria-busy")).toBe("true");
  });

  test("online, nothing changes: Save sends right away", async () => {
    const editor = editorWith({});
    const view = await render(editor.element());
    await type(findById(view, "st-ed-title"), "Cell biology, unit 2");
    await click(byAction(view, "save-edit"));
    expect(editor.saves).toHaveLength(1);
  });
});
