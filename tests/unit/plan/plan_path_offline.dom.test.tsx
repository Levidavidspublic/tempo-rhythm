/**
 * PlanPathScreen offline, mounted in the small TestNode DOM (tests/unit/record/testDom; there is no
 * Testing Library here). plan_offline.test.tsx covers `acceptBlock()` and the preview's markup;
 * this covers the screen's wiring: offline the OfflineNotice shows, and "Add these sessions", Undo
 * and Bring it back send nothing and say why (pp.offline.add, pp.offline.undo,
 * pp.offline.bringBack).
 *
 * The screen calls convex/react directly, and the plan screen's other reads go through planApi.ts.
 * Both, and the locale, are faithful stand-ins here (convex/react keeps every export registered
 * before this file and answers each function by its name), put back after this file.
 * components/goals/shared imports useConvexAuth, which other files' convex/react mocks leave out,
 * so, as in tests/unit/study, it is replaced outright: its useOnline is the real one's logic
 * (navigator.onLine and the window's online/offline events) and its OfflineNotice the same markup.
 * Every global is put back after this file.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { act, createElement, useEffect, useState } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { pt } from "../../../apps/web/components/calendar/planCopy";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, fireChange, installTestDom, type TestNode, useTestDom } from "../record/testDom";

const webDir = `${process.cwd()}/apps/web`;
const convexReact = Bun.resolveSync("convex/react", webDir);
const planApi = Bun.resolveSync("./components/calendar/plan/planApi", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const goalsShared = Bun.resolveSync("@/components/goals/shared", webDir);
const MOCKED = [convexReact, planApi, localeProvider];
const { getFunctionName } = (await import(Bun.resolveSync("convex/server", webDir))) as {
  getFunctionName: (ref: unknown) => string;
};

const GLOBALS = [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "HTMLIFrameElement",
  "navigator",
  "location",
  "getComputedStyle",
  "MutationObserver",
  "IS_REACT_ACT_ENVIRONMENT",
  "addEventListener",
  "removeEventListener",
] as const;
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();

const MIN = 60_000;
let previous: Record<string, Record<string, unknown>> = {};

/** The backend writes the screen makes, by Convex function name. */
const calls = {
  create: mock(
    async (_args: unknown): Promise<unknown> => ({
      planId: "studyPlans:9",
      undoUntil: Date.now() + 5 * MIN,
    }),
  ),
  undoCreate: mock(async (_args: unknown): Promise<unknown> => ({ removedTasks: 3 })),
  redoUndo: mock(async (_args: unknown): Promise<unknown> => ({ restored: 3 })),
  updateTask: mock(async (_args: unknown): Promise<unknown> => null),
  replan: mock(async (_args: unknown): Promise<unknown> => ({ undoUntil: Date.now() + 5 * MIN, moved: 1, removed: 0 })),
  undoReplan: mock(async (_args: unknown): Promise<unknown> => ({ restored: 1 })),
};
const mutations: Record<string, (args: unknown) => Promise<unknown>> = {
  "plans:createFromPreview": calls.create,
  "plans:undoCreate": calls.undoCreate,
  "plans:redoUndo": calls.redoUndo,
  "tasks:update": calls.updateTask,
};

/** No saved plans yet; reads of a plan's details are still loading. */
function queryAnswer(name: string, args: unknown): unknown {
  if (args === "skip") return undefined;
  if (name === "plans:list") return [];
  return undefined;
}

/** components/goals/shared's useOnline: the browser's flag, kept in step by its events. */
function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

function installModuleMocks() {
  mock.module(convexReact, () => ({
    ...previous[convexReact],
    useQuery: (ref: unknown, args?: unknown) => queryAnswer(getFunctionName(ref), args),
    useMutation: (ref: unknown) => {
      const name = getFunctionName(ref);
      const fn = mutations[name];
      if (!fn) throw new Error(`No stand-in for mutation ${name}`);
      return fn;
    },
  }));
  mock.module(planApi, () => ({
    ...previous[planApi],
    usePlan: () => undefined,
    useBusyTime: (span: unknown) => (span ? { events: [], tasks: [] } : { events: undefined, tasks: undefined }),
    useReplanActions: () => ({ replan: calls.replan, undoReplan: calls.undoReplan }),
  }));
  mock.module(goalsShared, () => {
    const h = createElement;
    return {
      UNDO_WINDOW_MS: 300_000,
      // Signed in (the screen's other states are tested elsewhere).
      useSignedIn: () => "ready",
      useOnline,
      OfflineNotice: ({ text }: { text: string }) =>
        h(
          "output",
          { className: "tp-notice tp-offline", "data-tone": "caution", "data-component": "StateOffline" },
          h("span", { className: "tp-notice__text" }, h("span", null, text)),
        ),
      StateLoading: ({ label }: { label: string }) =>
        h("output", { "data-component": "StateLoading", "aria-busy": "true" }, label),
      Segmented: ({
        options,
        value,
        onChange,
        labelledBy,
        render,
      }: {
        options: readonly string[];
        value: string;
        onChange: (next: string) => void;
        labelledBy: string;
        render: (option: string) => unknown;
      }) =>
        h(
          "div",
          { role: "radiogroup", "aria-labelledby": labelledBy, "data-component": "Segmented" },
          options.map((option) =>
            h(
              "button",
              {
                key: option,
                type: "button",
                role: "radio",
                "aria-checked": option === value,
                onClick: () => onChange(option),
              },
              render(option) as never,
            ),
          ),
        ),
      ScreenBoundary: ({ children }: { children?: unknown }) => children,
      StateError: ({ title }: { title: string }) => h("div", null, title),
      SignedOutState: () => h("div", { "data-component": "StateSignedOut" }),
      StateEmpty: ({ title }: { title: string }) => h("div", null, title),
      makeToast: (title: string) => ({ id: 1, title, undoUntilMs: 0 }),
      UndoToast: () => null,
    };
  });
  mock.module(localeProvider, () => ({
    ...previous[localeProvider],
    LocaleProvider: ({ children }: { children: unknown }) => children,
    useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
  }));
}

for (const key of MOCKED) previous[key] = { ...(await import(key)) };
installModuleMocks();
// The query suffix gives this file its own instance of the screen.
const { PlanPathScreen } = await import("../../../apps/web/components/calendar/plan/PlanPathScreen?plan-path-offline");

let documentNode: TestNode;
/** The browser's connection, as `navigator.onLine` and the window's online/offline events give it. */
let onLine = true;
let windowListeners = new Map<string, Set<() => void>>();

function installGlobals() {
  useTestDom(documentNode);
  const globals = globalThis as Record<string, unknown>;
  globals.navigator = {
    userAgent: "bun-test",
    get onLine() {
      return onLine;
    },
  };
  globals.addEventListener = (type: string, fn: () => void) => {
    let bucket = windowListeners.get(type);
    if (!bucket) {
      bucket = new Set();
      windowListeners.set(type, bucket);
    }
    bucket.add(fn);
  };
  globals.removeEventListener = (type: string, fn: () => void) => {
    windowListeners.get(type)?.delete(fn);
  };
}

beforeAll(() => {
  for (const key of GLOBALS) savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  documentNode = installTestDom();
  installModuleMocks();
});

afterAll(() => {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
  for (const key of GLOBALS) {
    const descriptor = savedGlobals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
});

let root: Root | null = null;
let host: TestNode | null = null;

async function mount() {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(PlanPathScreen));
  });
  return host;
}

/** The connection goes or comes back, as the browser tells the page. */
async function setOnline(next: boolean) {
  onLine = next;
  await act(async () => {
    for (const fn of [...(windowListeners.get(next ? "online" : "offline") ?? [])]) fn();
  });
}

async function click(node: TestNode | undefined) {
  if (!node) throw new Error("nothing to click");
  await act(async () => {
    node.click();
  });
}

const byAction = (view: TestNode, action: string) => findAll(view, (n) => n.getAttribute("data-action") === action)[0];
/** A form field by its name (on an input React sets it as a property, on a textarea as an attribute). */
const byName = (view: TestNode, name: string) =>
  findAll(view, (n) => (n as unknown as { name?: string }).name === name || n.getAttribute("name") === name)[0];
const offlineNotice = (view: TestNode) => findAll(view, (n) => n.getAttribute("data-component") === "StateOffline")[0];
const button = (view: TestNode, label: string) =>
  findAll(view, (n) => n.tagName === "BUTTON" && n.textContent.includes(label))[0];
const alerts = (view: TestNode) => findAll(view, (n) => n.getAttribute("role") === "alert").map((n) => n.textContent);

/** Fills the form so the preview offers a plan to add. */
async function fillForm(view: TestNode) {
  await act(async () => {
    fireChange(byName(view, "title") as TestNode, { value: "Maths exam" });
  });
  await act(async () => {
    fireChange(byName(view, "deadline") as TestNode, { value: "2026-11-06" });
  });
  await act(async () => {
    fireChange(byName(view, "topics") as TestNode, { value: "Algebra\nGeometry\nProbability" });
  });
  expect(byAction(view, "guided-accept")).toBeDefined();
}

/** Online: the plan is added, so its Undo is open on the card. */
async function added() {
  const view = await mount();
  await fillForm(view);
  await click(byAction(view, "guided-accept"));
  expect(calls.create).toHaveBeenCalledTimes(1);
  expect(byAction(view, "guided-undo")).toBeDefined();
  return view;
}

beforeEach(() => {
  installModuleMocks();
  onLine = true;
  windowListeners = new Map();
  installGlobals();
  for (const fn of Object.values(calls)) fn.mockClear();
  setSystemTime(new Date(2026, 9, 20, 9, 0));
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
  setSystemTime();
});

describe("PlanPathScreen offline, mounted", () => {
  test("online, there is no offline notice", async () => {
    const view = await mount();
    expect(offlineNotice(view)).toBeUndefined();
  });

  test("offline, the notice says the plan can be tried here but not added", async () => {
    onLine = false;
    const view = await mount();
    expect(offlineNotice(view)?.textContent).toBe(pt("en", "pp.offline"));
    // The connection comes back: the notice goes.
    await setOnline(true);
    expect(offlineNotice(view)).toBeUndefined();
  });

  test("offline, Add these sessions sends nothing and says why; back online, the words go", async () => {
    onLine = false;
    const view = await mount();
    await fillForm(view);
    await click(byAction(view, "guided-accept"));
    expect(calls.create).not.toHaveBeenCalled();
    expect(alerts(view)).toContain(pt("en", "pp.offline.add"));
    // Still a plan to add, not a card stuck on "Adding".
    expect(byAction(view, "guided-accept")?.disabled).toBe(false);
    expect(byAction(view, "guided-undo")).toBeUndefined();

    await setOnline(true);
    expect(alerts(view)).not.toContain(pt("en", "pp.offline.add"));
  });

  test("offline, Undo on the card sends nothing and says why; the plan stays added", async () => {
    const view = await added();
    await setOnline(false);
    expect(offlineNotice(view)).toBeDefined();
    await click(byAction(view, "guided-undo"));
    expect(calls.undoCreate).not.toHaveBeenCalled();
    expect(alerts(view)).toContain(pt("en", "pp.offline.undo"));
    expect(byAction(view, "guided-undo")?.disabled).toBe(false);
  });

  test("online, Undo on the card calls undoCreate once", async () => {
    const view = await added();
    await click(byAction(view, "guided-undo"));
    expect(calls.undoCreate).toHaveBeenCalledTimes(1);
    expect(calls.undoCreate.mock.calls[0]?.[0]).toEqual({ planId: "studyPlans:9" });
    expect(alerts(view)).not.toContain(pt("en", "pp.offline.undo"));
  });

  describe("Bring it back", () => {
    /** Online: Undo took a session marked done since, so the toast offers Bring it back. */
    async function undoneWithChanges() {
      calls.undoCreate.mockImplementationOnce(async () => ({
        removedTasks: 3,
        removedDone: 1,
        redoUntil: Date.now() + 5 * MIN,
      }));
      const view = await added();
      await click(byAction(view, "guided-undo"));
      expect(calls.undoCreate).toHaveBeenCalledTimes(1);
      expect(view.textContent).toContain(pt("en", "pp.g.undoneEdited"));
      return view;
    }

    test("offline, it sends nothing; the toast stays and its error line says why", async () => {
      const view = await undoneWithChanges();
      await setOnline(false);
      await click(button(view, pt("en", "pp.g.bringBack")));
      expect(calls.redoUndo).not.toHaveBeenCalled();
      expect(view.textContent).toContain(pt("en", "pp.g.undoneEdited"));
      expect(alerts(view)).toContain(pt("en", "pp.offline.bringBack"));
      expect(button(view, pt("en", "pp.g.bringBack"))?.disabled).toBe(false);
    });

    test("online, it calls redoUndo once and the toast closes", async () => {
      const view = await undoneWithChanges();
      await click(button(view, pt("en", "pp.g.bringBack")));
      expect(calls.redoUndo).toHaveBeenCalledTimes(1);
      expect(calls.redoUndo.mock.calls[0]?.[0]).toEqual({ planId: "studyPlans:9" });
      expect(view.textContent).not.toContain(pt("en", "pp.g.undoneEdited"));
    });
  });
});
