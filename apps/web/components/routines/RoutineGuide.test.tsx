/**
 * /routines: a routine with no steps says so, and a run keeps its place through a reload.
 * Vitest and Testing Library are not dependencies in this repo, so this is bun:test with
 * react-dom: static renders for what a screen shows, and a small test DOM (as in
 * TemplateRun.test.tsx) for Done, Skip and Pause. Every screen check runs in English and Hebrew.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { Lang, MessageKey } from "@/lib/i18n";

/* ---------- A small test DOM, enough for react-dom to render and handle clicks ---------- */

type Listener = (event: TestEvent) => void;

class TestEvent {
  bubbles = true;
  cancelable = true;
  defaultPrevented = false;
  cancelBubble = false;
  eventPhase = 3;
  timeStamp = Date.now();
  button = 0;
  buttons = 1;
  detail = 1;
  view: unknown = globalThis;
  currentTarget: TestNode | null = null;
  srcElement: TestNode;
  constructor(
    public type: string,
    public target: TestNode
  ) {
    this.srcElement = target;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.cancelBubble = true;
  }
  persist() {}
  getModifierState() {
    return false;
  }
}

class TestNode {
  nodeType = 1;
  childNodes: TestNode[] = [];
  parentNode: TestNode | null = null;
  nextSibling: TestNode | null = null;
  previousSibling: TestNode | null = null;
  firstChild: TestNode | null = null;
  lastChild: TestNode | null = null;
  ownerDocument: TestNode;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  attributes: Record<string, string> = {};
  style = { setProperty() {}, getPropertyValue: () => "" };
  className = "";
  id = "";
  disabled = false;
  nodeValue: string | null = null;
  defaultView: unknown = globalThis;
  activeElement: TestNode | null = null;
  body: TestNode | null = null;
  documentElement: TestNode | null = null;
  tagName: string;
  private listeners: Record<string, Listener[]> = {};

  constructor(
    public nodeName: string,
    owner: TestNode | null
  ) {
    this.tagName = nodeName;
    this.ownerDocument = owner ?? this;
  }

  get textContent(): string {
    if (this.nodeType === 3) return this.nodeValue ?? "";
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    for (const child of [...this.childNodes]) this.removeChild(child);
    if (value) this.appendChild(this.ownerDocument.createTextNode(value));
  }

  appendChild(child: TestNode) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const prev = this.lastChild;
    if (prev) {
      prev.nextSibling = child;
      child.previousSibling = prev;
    } else {
      this.firstChild = child;
    }
    child.nextSibling = null;
    this.lastChild = child;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child: TestNode, ref: TestNode | null) {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.childNodes.indexOf(ref);
    if (index < 0) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    const prev = ref.previousSibling;
    child.previousSibling = prev;
    child.nextSibling = ref;
    ref.previousSibling = child;
    if (prev) prev.nextSibling = child;
    else this.firstChild = child;
    return child;
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    if (child.previousSibling) child.previousSibling.nextSibling = child.nextSibling;
    if (child.nextSibling) child.nextSibling.previousSibling = child.previousSibling;
    if (this.firstChild === child) this.firstChild = child.nextSibling;
    if (this.lastChild === child) this.lastChild = child.previousSibling;
    child.parentNode = null;
    child.nextSibling = null;
    child.previousSibling = null;
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = String(value);
    if (name === "id") this.id = String(value);
    if (name === "disabled") this.disabled = true;
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
    if (name === "disabled") this.disabled = false;
  }

  hasAttribute(name: string) {
    return Object.hasOwn(this.attributes, name);
  }

  addEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const key = capture ? `${type}:capture` : type;
    this.listeners[key] = [...(this.listeners[key] ?? []), fn];
  }

  removeEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const key = capture ? `${type}:capture` : type;
    this.listeners[key] = (this.listeners[key] ?? []).filter((item) => item !== fn);
  }

  dispatchEvent(event: TestEvent) {
    const path: TestNode[] = [];
    let node: TestNode | null = event.target;
    while (node) {
      path.push(node);
      node = node.parentNode;
    }
    for (const current of path) {
      event.currentTarget = current;
      for (const fn of [...(current.listeners[event.type] ?? [])]) fn(event);
      if (event.cancelBubble) break;
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new TestEvent("click", this));
  }

  focus() {}
  blur() {}
  contains(other: TestNode) {
    let node: TestNode | null = other;
    while (node) {
      if (node === this) return true;
      node = node.parentNode;
    }
    return false;
  }
  getRootNode() {
    return this.ownerDocument;
  }
  compareDocumentPosition() {
    return 0;
  }
  createElement(tag: string) {
    return new TestNode(tag.toUpperCase(), this.ownerDocument);
  }
  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new TestNode("#text", this.ownerDocument);
    node.nodeType = 3;
    node.nodeValue = text;
    return node;
  }
  createComment(text: string) {
    const node = new TestNode("#comment", this.ownerDocument);
    node.nodeType = 8;
    node.nodeValue = text;
    return node;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getElementById() {
    return null;
  }
}

function installTestDom() {
  const documentNode = new TestNode("#document", null);
  documentNode.nodeType = 9;
  const documentElement = new TestNode("HTML", documentNode);
  const body = new TestNode("BODY", documentNode);
  documentNode.appendChild(documentElement);
  documentElement.appendChild(body);
  documentNode.documentElement = documentElement;
  documentNode.body = body;
  documentNode.activeElement = body;
  const globals = globalThis as Record<string, unknown>;
  globals.window = globalThis;
  globals.document = documentNode;
  globals.HTMLElement = TestNode;
  globals.Element = TestNode;
  globals.Node = TestNode;
  globals.HTMLIFrameElement = class HTMLIFrameElement extends TestNode {};
  globals.navigator = { userAgent: "bun-test", onLine: true };
  globals.location = { protocol: "http:", href: "http://localhost/" };
  globals.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return documentNode;
}

const documentNode = installTestDom();

/* ---------- This tab's sessionStorage: a fake, a broken one, or blocked outright ---------- */

class FakeStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const brokenStorage = {
  getItem(): string | null {
    throw new Error("storage is broken");
  },
  setItem() {
    throw new Error("storage is full");
  },
  removeItem() {
    throw new Error("storage is broken");
  },
};

let tabStorage: FakeStorage | typeof brokenStorage | "blocked" = new FakeStorage();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  get() {
    if (tabStorage === "blocked") throw new Error("SecurityError: storage is blocked");
    return tabStorage;
  },
});

/* ---------- Backend, router, links and copy ---------- */

type NoteFixture = { _id: string; title: string; body: string };

let lang: Lang = "en";
let notes: NoteFixture[] = [];

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "convex/react": { ...(await import("convex/react")) },
  "next/navigation": { ...(await import("next/navigation")) },
  "next/link": { ...(await import("next/link")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    notes: { listRoutines: "notes.listRoutines", getSafe: "notes.getSafe", create: "notes.create" },
  },
}));
mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (ref === "users.getProfile") return { _id: "user_1" };
    if (ref === "notes.listRoutines") return notes;
    if (ref === "notes.getSafe") {
      const { noteId } = args as { noteId: string };
      return notes.find((note) => note._id === noteId) ?? null;
    }
    return undefined;
  },
  useMutation: () => async () => "note_new",
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {} }),
}));
mock.module("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { RoutinesScreen } = await import("./RoutinesScreen");
const {
  RoutineGuide,
  RUN_KEY_PREFIX,
  RUN_TTL_MS,
  readSavedRun,
  runStorageKey,
  saveRun,
  sessionRunStorage,
} = await import("./RoutineGuide");
const { finishStep, newRoutineBody, startRun, togglePause } = await import("@/lib/routines");

const t = (key: MessageKey) => translate(lang, key);

/** "New routine" makes exactly this page: the tag and an empty "1.". */
const EMPTY: NoteFixture = { _id: "routine_empty", title: "Evening", body: newRoutineBody() };
const MORNING: NoteFixture = {
  _id: "routine_morning",
  title: "Morning",
  body: "#routine\n\n1. Water\n2. Stretch\n3. Read",
};

/* ---------- Helpers ---------- */

function anchors(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map((match) => ({
    href: match[1] ?? "",
    text: (match[2] ?? "").replace(/<[^>]+>/g, ""),
  }));
}

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findButton(view: TestNode, label: string): TestNode {
  let found: TestNode | null = null;
  walk(view, (node) => {
    if (!found && node.tagName === "BUTTON" && node.textContent.includes(label)) found = node;
  });
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

function stepTitle(view: TestNode): string {
  let title = "";
  walk(view, (node) => {
    if (node.id === "rd-step-title") title = node.textContent;
  });
  return title;
}

const progress = (step: number, of: number) => `${t("rd.step")} ${step} ${t("rd.of")} ${of}`;

let root: Root | null = null;
let host: TestNode | null = null;

async function openRun(routineId: string): Promise<TestNode> {
  const node = documentNode.createElement("div");
  documentNode.body?.appendChild(node);
  host = node;
  root = createRoot(node as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(RoutineGuide, { routineId }) as ReactElement);
  });
  return node;
}

async function closeRun() {
  await act(async () => {
    root?.unmount();
  });
  host?.parentNode?.removeChild(host);
  root = null;
  host = null;
}

/** A reload: the screen goes away and comes back in the same tab. */
async function reload(routineId: string): Promise<TestNode> {
  await closeRun();
  return openRun(routineId);
}

async function press(view: TestNode, label: string) {
  await act(async () => {
    findButton(view, label).click();
  });
}

function seed(storage: FakeStorage, routineId: string, value: unknown) {
  storage.setItem(
    runStorageKey(routineId),
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

afterEach(async () => {
  await closeRun();
});

/* ---------- Screens, in English and Hebrew ---------- */

for (const language of ["en", "he"] as const) {
  describe(`/routines (${language})`, () => {
    let storage: FakeStorage;

    beforeEach(() => {
      lang = language;
      storage = new FakeStorage();
      tabStorage = storage;
      notes = [EMPTY, MORNING];
    });

    test("a routine with no steps offers Add steps, to its page, instead of Start", () => {
      const links = anchors(renderToStaticMarkup(createElement(RoutinesScreen)));
      const add = links.filter((link) => link.text.includes(t("rd.addSteps")));
      const start = links.filter((link) => link.text.includes(t("rt.start")));
      expect(add.map((link) => link.href)).toEqual([`/notes/${EMPTY._id}`]);
      expect(add[0]?.text).toContain(EMPTY.title);
      expect(start.map((link) => link.href)).toEqual([`/routines/${MORNING._id}`]);

      // The same page the run's "Edit the steps" opens.
      const guide = anchors(
        renderToStaticMarkup(createElement(RoutineGuide, { routineId: EMPTY._id }))
      );
      const edit = guide.find((link) => link.text.includes(t("rd.edit")));
      expect(edit?.href).toBe(add[0]?.href);
    });

    test("a routine with no steps is never the one that fits right now", () => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      notes = [
        { ...EMPTY, body: `#routine ${time}\n\n1. ` },
        { ...MORNING, body: MORNING.body.replace("#routine", `#routine ${time}`) },
      ];
      const html = renderToStaticMarkup(createElement(RoutinesScreen));
      expect(html.split(t("rt.fits")).length - 1).toBe(1);
      // The one main Start goes to the routine that has steps.
      const primary = [...html.matchAll(/<a [^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => tag.includes("tp-btn--primary"));
      expect(primary).toHaveLength(1);
      expect(primary[0]).toContain(`href="/routines/${MORNING._id}"`);
    });

    test("the run of a routine with no steps says so and offers to edit it", () => {
      const html = renderToStaticMarkup(createElement(RoutineGuide, { routineId: EMPTY._id }));
      expect(html).toContain(t("rd.empty.t"));
      expect(html).not.toContain(t("rd.done"));
      const edit = anchors(html).filter((link) => link.text.includes(t("rd.edit")));
      expect(edit.map((link) => link.href)).toEqual([`/notes/${EMPTY._id}`]);
    });

    test("a run keeps its place through a reload, and the place is cleared when it ends", async () => {
      let view = await openRun(MORNING._id);
      expect(view.textContent).toContain(progress(1, 3));
      expect(view.textContent).not.toContain(t("rd.resumed"));

      await press(view, t("rd.skip"));
      const key = runStorageKey(MORNING._id);
      expect(key.startsWith(RUN_KEY_PREFIX)).toBe(true);
      const raw = storage.getItem(key) ?? "";
      expect(JSON.parse(raw)).toMatchObject({
        v: 1,
        index: 1,
        statuses: ["skipped", "now", "next"],
        paused: false,
      });
      // Only the place is kept, never the steps' text.
      expect(raw).not.toContain("Stretch");

      view = await reload(MORNING._id);
      expect(view.textContent).toContain(progress(2, 3));
      expect(stepTitle(view)).toBe("Stretch");
      expect(view.textContent).toContain(t("rd.resumed"));

      await press(view, t("rd.done"));
      expect(JSON.parse(storage.getItem(key) ?? "null")).toMatchObject({ index: 2 });
      await press(view, t("rd.done"));
      expect(view.textContent).toContain(t("rd.fin.t"));
      expect(storage.getItem(key)).toBeNull();
      expect(storage.items.size).toBe(0);

      view = await reload(MORNING._id);
      expect(view.textContent).toContain(progress(1, 3));
      expect(stepTitle(view)).toBe("Water");
      expect(view.textContent).not.toContain(t("rd.resumed"));
    });

    test("Pause is kept through a reload", async () => {
      let view = await openRun(MORNING._id);
      await press(view, t("rd.done"));
      await press(view, t("rd.pause"));
      expect(JSON.parse(storage.getItem(runStorageKey(MORNING._id)) ?? "null")).toMatchObject({
        index: 1,
        paused: true,
      });

      view = await reload(MORNING._id);
      expect(view.textContent).toContain(t("rd.paused.t"));
      expect(findButton(view, t("rd.done")).disabled).toBe(true);
      await press(view, t("rd.resume"));
      expect(findButton(view, t("rd.done")).disabled).toBe(false);
      expect(view.textContent).toContain(progress(2, 3));
    });

    test("a place older than 12 hours is dropped", async () => {
      const run = finishStep(startRun(3), "done");
      seed(storage, MORNING._id, { v: 1, savedAt: Date.now() - RUN_TTL_MS - 60_000, ...run });
      const view = await openRun(MORNING._id);
      expect(view.textContent).toContain(progress(1, 3));
      expect(view.textContent).not.toContain(t("rd.resumed"));
      expect(storage.items.size).toBe(0);
    });

    test("bad JSON in storage starts the run from the top", async () => {
      seed(storage, MORNING._id, "{not json");
      const view = await openRun(MORNING._id);
      expect(view.textContent).toContain(progress(1, 3));
      expect(storage.items.size).toBe(0);
      await press(view, t("rd.skip"));
      expect(view.textContent).toContain(progress(2, 3));
    });

    test("a run still works when storage throws or is blocked", async () => {
      for (const broken of [brokenStorage, "blocked"] as const) {
        tabStorage = broken;
        const view = await openRun(MORNING._id);
        expect(view.textContent).toContain(progress(1, 3));
        await press(view, t("rd.skip"));
        await press(view, t("rd.pause"));
        expect(view.textContent).toContain(t("rd.paused.t"));
        await press(view, t("rd.resume"));
        await press(view, t("rd.done"));
        expect(view.textContent).toContain(progress(3, 3));
        await closeRun();
      }
    });
  });
}

/* ---------- The storage helper ---------- */

describe("saved run", () => {
  const NOW = Date.UTC(2026, 9, 16, 8, 0);
  const id = "routine_1";

  test("round-trips per routine id under a versioned tempo:routine-run: key", () => {
    const storage = new FakeStorage();
    const run = togglePause(finishStep(finishStep(startRun(4), "skipped"), "done"));
    saveRun(storage, id, run, NOW);
    expect(runStorageKey(id)).toBe(`${RUN_KEY_PREFIX}v1:${id}`);
    expect([...storage.items.keys()]).toEqual([runStorageKey(id)]);
    expect(readSavedRun(storage, id, 4, NOW + 1000)).toEqual(run);
    expect(readSavedRun(storage, "routine_2", 4, NOW)).toBeNull();
  });

  test("a finished run is cleared", () => {
    const storage = new FakeStorage();
    let run = startRun(2);
    saveRun(storage, id, run, NOW);
    expect(storage.items.size).toBe(1);
    run = finishStep(finishStep(run, "done"), "done");
    saveRun(storage, id, run, NOW);
    expect(storage.items.size).toBe(0);
  });

  test("expires after 12 hours", () => {
    const storage = new FakeStorage();
    const run = finishStep(startRun(3), "done");
    saveRun(storage, id, run, NOW);
    expect(readSavedRun(storage, id, 3, NOW + RUN_TTL_MS)).toEqual(run);
    expect(readSavedRun(storage, id, 3, NOW + RUN_TTL_MS + 1)).toBeNull();
    expect(storage.items.size).toBe(0);

    // A time from the future (a clock that moved) is not trusted either.
    saveRun(storage, id, run, NOW + 60_000);
    expect(readSavedRun(storage, id, 3, NOW)).toBeNull();
  });

  test("bad JSON, a wrong shape or other steps read as nothing saved, and are dropped", () => {
    const fresh = {
      v: 1,
      savedAt: NOW,
      index: 1,
      statuses: ["done", "now", "next"],
      paused: false,
    };
    const bad: unknown[] = [
      "{not json",
      "null",
      "42",
      '"text"',
      "[]",
      { ...fresh, v: 2 },
      { ...fresh, savedAt: "today" },
      { ...fresh, paused: "no" },
      { ...fresh, index: 1.5 },
      { ...fresh, index: -1 },
      { ...fresh, index: 3, statuses: ["done", "done", "done"] },
      { ...fresh, statuses: ["done", "now"] },
      { ...fresh, statuses: ["done", "now", "maybe"] },
      { ...fresh, statuses: ["next", "now", "next"] },
      { ...fresh, statuses: ["done", "now", "done"] },
      { ...fresh, statuses: "done,now,next" },
    ];
    for (const value of bad) {
      const storage = new FakeStorage();
      seed(storage, id, value);
      expect(readSavedRun(storage, id, 3, NOW)).toBeNull();
      expect(storage.items.size).toBe(0);
    }
    const storage = new FakeStorage();
    seed(storage, id, fresh);
    expect(readSavedRun(storage, id, 3, NOW)).toEqual({
      index: 1,
      statuses: ["done", "now", "next"],
      paused: false,
    });
    // The steps changed since: start again.
    expect(readSavedRun(storage, id, 4, NOW)).toBeNull();
  });

  test("storage that throws, or is blocked, never throws back", () => {
    const run = finishStep(startRun(3), "skipped");
    expect(() => saveRun(brokenStorage, id, run, NOW)).not.toThrow();
    expect(readSavedRun(brokenStorage, id, 3, NOW)).toBeNull();
    expect(readSavedRun(null, id, 3, NOW)).toBeNull();
    expect(() => saveRun(null, id, run, NOW)).not.toThrow();

    tabStorage = "blocked";
    expect(sessionRunStorage()).toBeNull();
    const storage = new FakeStorage();
    tabStorage = storage;
    expect(sessionRunStorage()).toBe(storage);
  });
});
