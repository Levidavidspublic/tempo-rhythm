/**
 * Signing out clears this tab's kept brain dump and task draft: lib/tab-state.ts and the
 * watcher that components/providers/providers.tsx renders inside the Convex auth provider.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type AuthSnapshot,
  clearTabState,
  isTabStateKey,
  TAB_STATE_PREFIXES,
  tabAuthStep,
  tabStateStore,
  useClearTabStateOnSignOut,
} from "./tab-state";

/** A sessionStorage stand-in that can be told to throw. */
class FakeStore {
  items = new Map<string, string>();
  throwOnLength = false;
  throwOnKeyAt: number | null = null;
  refuseRemove = new Set<string>();
  removed: string[] = [];

  constructor(entries: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(entries)) this.items.set(key, value);
  }
  get length() {
    if (this.throwOnLength) throw new Error("SecurityError");
    return this.items.size;
  }
  key(index: number) {
    if (this.throwOnKeyAt === index) throw new Error("SecurityError");
    return [...this.items.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    if (this.refuseRemove.has(key)) throw new Error("SecurityError");
    this.removed.push(key);
    this.items.delete(key);
  }
  keys() {
    return [...this.items.keys()];
  }
}

const KEPT = {
  "tempo:brain-dump:session": '{"v":1}',
  "tempo:brain-dump:saved-pages:v1": "[]",
  "tempo:tasks:draft": '{"title":"x"}',
};
const OTHERS = {
  "tempo:task-views-core:v1": "{}",
  "tempo:calendar-events:e2e:v1": "[]",
  "tempo:brain-dumpx": "1",
  "tempo-theme": "dark",
  "x:tempo:tasks:draft": "1",
};

describe("clearTabState", () => {
  test("removes every key with a tab-state prefix and nothing else", () => {
    const store = new FakeStore({ ...OTHERS, ...KEPT });
    expect(clearTabState(store)).toBe(3);
    expect(store.keys().sort()).toEqual(Object.keys(OTHERS).sort());
  });

  test("removes neighbouring prefixed keys without skipping any", () => {
    const store = new FakeStore({ ...KEPT, "tempo:tasks:other": "1", "tempo:brain-dump:x": "1" });
    expect(clearTabState(store)).toBe(5);
    expect(store.keys()).toEqual([]);
  });

  test("the prefixes are the brain dump's and the task draft's", () => {
    expect([...TAB_STATE_PREFIXES]).toEqual(["tempo:brain-dump:", "tempo:tasks:"]);
    expect(isTabStateKey("tempo:tasks:draft")).toBe(true);
    expect(isTabStateKey("tempo:task-views-core:v1")).toBe(false);
  });

  test("no storage, or storage that throws, is ignored", () => {
    expect(clearTabState(null)).toBe(0);

    const blocked = new FakeStore(KEPT);
    blocked.throwOnLength = true;
    expect(() => clearTabState(blocked)).not.toThrow();
    expect(clearTabState(blocked)).toBe(0);

    // key() gives up part way: what was listed before it did still goes.
    const partial = new FakeStore({ ...KEPT, ...OTHERS });
    partial.throwOnKeyAt = 2;
    expect(clearTabState(partial)).toBe(2);
    expect(partial.removed).toEqual([
      "tempo:brain-dump:session",
      "tempo:brain-dump:saved-pages:v1",
    ]);

    // One key that won't go doesn't stop the others.
    const stubborn = new FakeStore(KEPT);
    stubborn.refuseRemove.add("tempo:brain-dump:session");
    expect(clearTabState(stubborn)).toBe(2);
    expect(stubborn.keys()).toEqual(["tempo:brain-dump:session"]);
  });
});

const LOADING: AuthSnapshot = { isLoading: true, isAuthenticated: false };
const SIGNED_IN: AuthSnapshot = { isLoading: false, isAuthenticated: true };
const SIGNED_OUT: AuthSnapshot = { isLoading: false, isAuthenticated: false };

/** How many clears a page that starts fresh makes over these auth answers. */
function clears(answers: AuthSnapshot[]): number {
  let wasSignedIn = false;
  let count = 0;
  for (const auth of answers) {
    const step = tabAuthStep(wasSignedIn, auth);
    wasSignedIn = step.wasSignedIn;
    if (step.clear) count += 1;
  }
  return count;
}

describe("tabAuthStep", () => {
  test("clears once on signed in to signed out", () => {
    expect(clears([LOADING, SIGNED_IN, SIGNED_OUT])).toBe(1);
    // Convex can pass through loading on the way out.
    expect(clears([LOADING, SIGNED_IN, LOADING, SIGNED_OUT])).toBe(1);
    // The same signed-out answer again (a re-render, a Strict Mode re-run) doesn't clear again.
    expect(clears([SIGNED_IN, SIGNED_OUT, SIGNED_OUT, LOADING, SIGNED_OUT])).toBe(1);
  });

  test("never on a first load, or for a visitor who was never signed in", () => {
    expect(clears([LOADING])).toBe(0);
    expect(clears([LOADING, SIGNED_OUT])).toBe(0);
    expect(clears([SIGNED_OUT, LOADING, SIGNED_OUT])).toBe(0);
  });

  test("a session that is renewed (signed in, loading, signed in) is not a sign-out", () => {
    expect(clears([LOADING, SIGNED_IN, LOADING, SIGNED_IN])).toBe(0);
  });

  test("each sign-out clears: signed in again, then out again", () => {
    expect(clears([SIGNED_IN, SIGNED_OUT, SIGNED_IN, SIGNED_OUT])).toBe(2);
  });
});

// The watcher, rendered by React (in Strict Mode, which runs each effect twice on mount) through
// a run of useConvexAuth() answers, against this tab's sessionStorage.
const globals = globalThis as Record<string, unknown>;
const GLOBAL_KEYS = ["window", "sessionStorage", "IS_REACT_ACT_ENVIRONMENT"];
let previousGlobals: Record<string, PropertyDescriptor | undefined> = {};
let tab = new FakeStore();

beforeAll(() => {
  previousGlobals = {};
  for (const key of GLOBAL_KEYS) {
    previousGlobals[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  }
  // react-dom/client reads window.event; the watcher reads window.sessionStorage.
  if (globals.window === undefined) globals.window = globalThis;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get: () => tab });
  globals.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  for (const key of GLOBAL_KEYS) {
    const descriptor = previousGlobals[key];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globals[key];
  }
});

/** A container with no DOM behind it: the tree under test renders no elements. */
function container() {
  // React looks up the focused element around each commit; there is none here.
  const defaultView = { document: { activeElement: null }, HTMLIFrameElement: class {} };
  const ownerDocument = {
    nodeType: 9,
    defaultView,
    addEventListener() {},
    removeEventListener() {},
  };
  return {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    ownerDocument,
    firstChild: null,
    textContent: "",
    addEventListener() {},
    removeEventListener() {},
  };
}

function Watcher({ auth }: { auth: AuthSnapshot }) {
  useClearTabStateOnSignOut(auth);
  return null;
}

/** Render the watcher through these answers, one render each; returns the keys left. */
async function watch(answers: AuthSnapshot[]): Promise<string[]> {
  const root: Root = createRoot(container() as unknown as HTMLElement);
  try {
    for (const auth of answers) {
      await act(async () => {
        root.render(createElement(StrictMode, null, createElement(Watcher, { auth })));
      });
    }
  } finally {
    await act(async () => root.unmount());
  }
  return tab.keys().sort();
}

const ALL = Object.keys({ ...KEPT, ...OTHERS }).sort();
const LEFT_AFTER_CLEAR = Object.keys(OTHERS).sort();

describe("useClearTabStateOnSignOut", () => {
  beforeEach(() => {
    tab = new FakeStore({ ...KEPT, ...OTHERS });
  });

  test("reads this tab's sessionStorage", () => {
    expect(tabStateStore()).toBe(tab);
  });

  test("signed in, then signed out: this tab's brain dump and task draft are cleared", async () => {
    expect(await watch([LOADING, SIGNED_IN, SIGNED_OUT])).toEqual(LEFT_AFTER_CLEAR);
    expect(tab.removed.sort()).toEqual(Object.keys(KEPT).sort());
  });

  test("signed out through loading, then signed out again: cleared once", async () => {
    const answers = [SIGNED_IN, LOADING, SIGNED_OUT, SIGNED_OUT, LOADING, SIGNED_OUT];
    expect(await watch(answers)).toEqual(LEFT_AFTER_CLEAR);
    expect(tab.removed).toHaveLength(Object.keys(KEPT).length);
  });

  test("a first load that ends signed out keeps everything", async () => {
    expect(await watch([LOADING, SIGNED_OUT])).toEqual(ALL);
    expect(await watch([SIGNED_OUT])).toEqual(ALL);
    expect(tab.removed).toEqual([]);
  });

  test("a renewed session (signed in, loading, signed in) keeps everything", async () => {
    expect(await watch([LOADING, SIGNED_IN, LOADING, SIGNED_IN])).toEqual(ALL);
  });

  test("blocked storage doesn't break the sign-out", async () => {
    tab.throwOnLength = true;
    expect(await watch([SIGNED_IN, SIGNED_OUT])).toEqual(ALL);
  });
});

// providers.tsx is read, not rendered: bun's module mocks are process-wide, and an earlier test
// file (tests/unit/releaseOnboardingGate.test.tsx) leaves convex/react mocked without
// useConvexAuth, so a module importing it can't load later in the same `bun run test`.
describe("Providers", () => {
  test("renders the watcher, fed by useConvexAuth(), inside the Convex auth provider", () => {
    const source = readFileSync(
      new URL("../components/providers/providers.tsx", import.meta.url),
      "utf8"
    );
    expect(source).toMatch(
      /<ConvexAuthNextjsProvider client=\{convex\}>\s*<ClearTabStateOnSignOut \/>\s*\{children\}\s*<\/ConvexAuthNextjsProvider>/
    );
    expect(source).toMatch(
      /function ClearTabStateOnSignOut\(\) \{\s*useClearTabStateOnSignOut\(useConvexAuth\(\)\);\s*return null;\s*\}/
    );
    expect(source).toContain('import { ConvexReactClient, useConvexAuth } from "convex/react";');
    expect(source).toContain('import { useClearTabStateOnSignOut } from "@/lib/tab-state";');
  });
});
