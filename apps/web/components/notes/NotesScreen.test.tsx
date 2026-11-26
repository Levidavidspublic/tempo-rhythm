/**
 * The notes screens inside the shell: no second <main>, copy from the en/he strings, and a
 * waiting save sent when the page is hidden or goes away (a reload or a closed tab never
 * unmounts React, so the 500 ms timer may never fire).
 *
 * Testing Library is not a dependency here, so this is bun:test plus react-dom: static renders
 * for the views, and a real root for the save timing. The editor is a stub that renders
 * nothing, so that root needs only a stand-in window, document and container (EventTargets).
 */
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { type Lang, type MessageKey, translate } from "@/lib/i18n";

// --- Mocks (before the screen is imported) ---

let lang: Lang = "en";
let authed = true;
let profile: unknown = { _id: "user-1" };
let note: unknown;
let list: unknown;

type UpdateArgs = { noteId: string; title?: string; body?: string };
const update = mock(async (_args: UpdateArgs) => null);
const otherMutation = mock(async () => ({}));

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "next/navigation": { ...(await import("next/navigation")) },
  "next/link": { ...(await import("next/link")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
  "./PageEditorView": { ...(await import("./PageEditorView")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
  useQuery: (ref: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref === "users.getProfile") return profile;
    if (ref === "notes.getSafe") return note;
    if (ref === "notes.list") return list;
    return undefined;
  },
  // The same function on every render, as Convex gives.
  useMutation: (ref: string) => (ref === "notes.update" ? update : otherMutation),
}));
mock.module("@/convex/_generated/api", () => ({
  api: {
    notes: {
      list: "notes.list",
      getSafe: "notes.getSafe",
      create: "notes.create",
      update: "notes.update",
      togglePin: "notes.togglePin",
      remove: "notes.remove",
      restore: "notes.restore",
    },
    users: { getProfile: "users.getProfile" },
  },
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
}));
mock.module("next/link", () => ({
  default: (props: { href: string; className?: string; children?: unknown }) =>
    createElement("a", { href: props.href, className: props.className }, props.children as never),
}));
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

type EditorProps = { onBodyChange: (value: string) => void };
let editor: EditorProps | null = null;
mock.module("./PageEditorView", () => ({
  PageEditorView: (props: EditorProps) => {
    editor = props;
    return null;
  },
}));

const { NotesScreen } = await import("./NotesScreen");

// --- Static views ---

const OWN_TEXT = ["Groceries", "milk and eggs", "Plan for Monday"];

function render(noteId?: string): string {
  return renderToStaticMarkup(createElement(NotesScreen, noteId ? { noteId } : {}));
}

/** Latin words a reader sees or hears (text and labels), leaving out the user's own text. */
function latinLabels(markup: string): string[] {
  const labels = [...markup.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map(
    (match) => match[1] ?? ""
  );
  let seen = [markup.replace(/<[^>]*>/g, " "), ...labels]
    .join(" ")
    .replace(/&(?:amp|lt|gt|quot|#x27|#39|nbsp);/g, " ");
  for (const own of OWN_TEXT) seen = seen.split(own).join(" ");
  return seen.match(/[A-Za-z]+/g) ?? [];
}

const views: { name: string; setup: () => void; noteId?: string }[] = [
  {
    name: "the list, with notes",
    setup: () => {
      list = [
        { _id: "n1", title: "Groceries", body: "milk and eggs", pinned: true },
        { _id: "n2", title: "", body: "", pinned: false },
      ];
    },
  },
  {
    name: "the list, empty",
    setup: () => {
      list = [];
    },
  },
  {
    name: "the list, loading",
    setup: () => {
      list = undefined;
    },
  },
  {
    name: "a note, loading",
    noteId: "n1",
    setup: () => {
      note = undefined;
    },
  },
  {
    name: "a note, not found",
    noteId: "n1",
    setup: () => {
      note = null;
    },
  },
];

describe("notes views inside the shell", () => {
  for (const view of views) {
    test(`${view.name}: no <main> of its own`, () => {
      lang = "en";
      view.setup();
      expect(render(view.noteId)).not.toContain("<main");
    });

    test(`${view.name}: the Hebrew render has no Latin label besides the user's text`, () => {
      lang = "he";
      view.setup();
      expect(latinLabels(render(view.noteId))).toEqual([]);
    });
  }

  test("English copy is unchanged", () => {
    lang = "en";
    list = [{ _id: "n1", title: "Groceries", body: "", pinned: true }];
    const listMarkup = render();
    expect(listMarkup).toContain("Library");
    expect(listMarkup).toContain(">Notes</h1>");
    expect(listMarkup).toContain("1 note, pinned first.");
    expect(listMarkup).toContain('aria-label="Unpin Groceries"');
    note = undefined;
    expect(render("n1")).toContain("Loading note.");
    note = null;
    expect(render("n1")).toContain("We couldn&#x27;t find that note");
  });
});

// --- Saving when the page is hidden or goes away ---

const globals = globalThis as unknown as Record<string, unknown>;
const previous = {
  window: globals.window,
  document: globals.document,
  act: globals.IS_REACT_ACT_ENVIRONMENT,
};
const fakeDocument = Object.assign(new EventTarget(), {
  nodeType: 9,
  visibilityState: "visible" as DocumentVisibilityState,
  activeElement: null,
  body: null,
  defaultView: null as unknown,
});
const fakeWindow = Object.assign(new EventTarget(), {
  document: fakeDocument,
  HTMLIFrameElement: class {},
});
fakeDocument.defaultView = fakeWindow;
globals.window = fakeWindow;
globals.document = fakeDocument;
globals.IS_REACT_ACT_ENVIRONMENT = true;

afterAll(() => {
  globals.window = previous.window;
  globals.document = previous.document;
  globals.IS_REACT_ACT_ENVIRONMENT = previous.act;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let root: Root | null = null;

async function openNote() {
  lang = "en";
  authed = true;
  profile = { _id: "user-1" };
  note = { _id: "n1", title: "Plan for Monday", body: "", pinned: false };
  const container = Object.assign(new EventTarget(), {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    ownerDocument: fakeDocument,
    textContent: "",
  });
  root = createRoot(container as unknown as Element);
  await act(async () => root?.render(createElement(NotesScreen, { noteId: "n1" })));
}

async function type(value: string) {
  if (!editor) throw new Error("the editor did not render");
  const { onBodyChange } = editor;
  await act(async () => onBodyChange(value));
}

async function fire(target: EventTarget, type: string) {
  await act(async () => {
    target.dispatchEvent(new Event(type));
  });
}

async function wait(ms: number) {
  await act(async () => {
    await sleep(ms);
  });
}

afterEach(async () => {
  if (root) {
    const open = root;
    await act(async () => open.unmount());
  }
  root = null;
  editor = null;
  fakeDocument.visibilityState = "visible";
  update.mockClear();
});

describe("a waiting save is sent when the page goes away", () => {
  test("pagehide sends it once with the latest text; the timer and unmount don't send it again", async () => {
    await openNote();
    await type("Buy");
    await type("Buy milk");
    expect(update).toHaveBeenCalledTimes(0);

    await fire(fakeWindow, "pagehide");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({ noteId: "n1", body: "Buy milk" });

    await wait(650);
    const open = root;
    root = null;
    await act(async () => open?.unmount());
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("the tab going hidden sends it once; going visible doesn't, and a later pagehide adds nothing", async () => {
    await openNote();
    await type("Call the bank");

    await fire(fakeDocument, "visibilitychange");
    expect(update).toHaveBeenCalledTimes(0);

    fakeDocument.visibilityState = "hidden";
    await fire(fakeDocument, "visibilitychange");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({ noteId: "n1", body: "Call the bank" });

    await fire(fakeWindow, "pagehide");
    await wait(650);
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("with nothing waiting, pagehide sends nothing, and typing still waits 500 ms", async () => {
    await openNote();
    await fire(fakeWindow, "pagehide");
    expect(update).toHaveBeenCalledTimes(0);

    await type("Water the plants");
    await wait(200);
    expect(update).toHaveBeenCalledTimes(0);
    await wait(450);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({ noteId: "n1", body: "Water the plants" });
  });
});
