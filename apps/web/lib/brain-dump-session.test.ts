import { afterEach, describe, expect, test } from "bun:test";
import {
  BRAIN_DUMP_SESSION_KEY,
  BRAIN_DUMP_SESSION_TTL_MS,
  BRAIN_DUMP_SESSION_VERSION,
  type BrainDumpSession,
  clearBrainDumpSession,
  isFinished,
  type KeptPlan,
  loadBrainDumpSession,
  type SessionStore,
  saveBrainDumpSession,
  tabSessionStore,
} from "./brain-dump-session";

const T0 = Date.UTC(2026, 9, 16, 9, 0);

const plan: KeptPlan = {
  summary: "Three things, one is urgent.",
  priorities: [
    { title: "Reply to Dana", reason: "She is waiting", urgency: "now" },
    { title: "Groceries", reason: "This week", urgency: "soon" },
    { title: "Learn the cello", reason: "Someday", urgency: "later" },
  ],
};

const sorted: BrainDumpSession = {
  draft: "dana, groceries, cello",
  plan,
  accepted: [0],
  rejected: [2],
};

/** A Map-backed store; `fail` makes the named calls throw like blocked or full storage. */
function fakeStore(fail: Partial<Record<keyof SessionStore, boolean>> = {}) {
  const data = new Map<string, string>();
  const store: SessionStore = {
    getItem: (key) => {
      if (fail.getItem) throw new Error("SecurityError");
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (fail.setItem) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
    removeItem: (key) => {
      if (fail.removeItem) throw new Error("SecurityError");
      data.delete(key);
    },
  };
  return { store, data };
}

describe("save and load", () => {
  test("round trip: the dump, the plan and the choices come back", () => {
    const { store } = fakeStore();
    expect(saveBrainDumpSession(store, sorted, T0)).toBe(true);
    expect(loadBrainDumpSession(store, T0 + 60_000)).toEqual(sorted);
  });

  test("a dump typed but not sorted yet comes back on its own", () => {
    const { store } = fakeStore();
    const typed = { draft: "call mom\npay rent", plan: null, accepted: [], rejected: [] };
    saveBrainDumpSession(store, typed, T0);
    expect(loadBrainDumpSession(store, T0)).toEqual(typed);
  });

  test("stores a version tag and the save time, and only under one sessionStorage key", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    expect([...data.keys()]).toEqual([BRAIN_DUMP_SESSION_KEY]);
    const stored = JSON.parse(data.get(BRAIN_DUMP_SESSION_KEY) ?? "{}");
    expect(stored.v).toBe(BRAIN_DUMP_SESSION_VERSION);
    expect(stored.savedAt).toBe(T0);
  });

  test("the saved copy does not change when the screen's arrays do", () => {
    const { store } = fakeStore();
    const accepted = [1];
    saveBrainDumpSession(store, { ...sorted, accepted }, T0);
    accepted.push(0);
    expect(loadBrainDumpSession(store, T0)?.accepted).toEqual([1]);
  });

  test("a later save replaces the earlier one", () => {
    const { store } = fakeStore();
    saveBrainDumpSession(store, { ...sorted, accepted: [] }, T0);
    saveBrainDumpSession(store, { ...sorted, accepted: [0, 1] }, T0 + 1000);
    expect(loadBrainDumpSession(store, T0 + 2000)?.accepted).toEqual([0, 1]);
  });

  test("nothing kept reads as null", () => {
    expect(loadBrainDumpSession(fakeStore().store, T0)).toBeNull();
  });
});

describe("expiry", () => {
  test("kept for just under 2 hours after the last save, then dropped", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    expect(loadBrainDumpSession(store, T0 + BRAIN_DUMP_SESSION_TTL_MS - 1)).toEqual(sorted);
    expect(loadBrainDumpSession(store, T0 + BRAIN_DUMP_SESSION_TTL_MS)).toBeNull();
    expect(data.has(BRAIN_DUMP_SESSION_KEY)).toBe(false);
  });

  test("each save starts the 2 hours again", () => {
    const { store } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    saveBrainDumpSession(store, sorted, T0 + 90 * 60_000);
    expect(loadBrainDumpSession(store, T0 + BRAIN_DUMP_SESSION_TTL_MS + 60_000)).toEqual(sorted);
  });

  test("a save time that isn't a number is dropped", () => {
    const { store, data } = fakeStore();
    data.set(
      BRAIN_DUMP_SESSION_KEY,
      JSON.stringify({ v: BRAIN_DUMP_SESSION_VERSION, savedAt: "now", draft: "x" })
    );
    expect(loadBrainDumpSession(store, T0)).toBeNull();
  });
});

describe("version mismatch", () => {
  test("a dump kept by another version is dropped and removed", () => {
    const { store, data } = fakeStore();
    data.set(
      BRAIN_DUMP_SESSION_KEY,
      JSON.stringify({
        v: BRAIN_DUMP_SESSION_VERSION + 1,
        savedAt: T0,
        draft: "x",
        plan: null,
        accepted: [],
        rejected: [],
      })
    );
    expect(loadBrainDumpSession(store, T0)).toBeNull();
    expect(data.has(BRAIN_DUMP_SESSION_KEY)).toBe(false);
  });

  test("no version tag at all is dropped", () => {
    const { store, data } = fakeStore();
    data.set(BRAIN_DUMP_SESSION_KEY, JSON.stringify({ savedAt: T0, draft: "x", plan: null }));
    expect(loadBrainDumpSession(store, T0)).toBeNull();
  });
});

describe("bad JSON", () => {
  test.each([
    "{not json",
    "",
    "42",
    "null",
    "[]",
    '"text"',
  ])("%p reads as nothing kept, and is removed", (raw) => {
    const { store, data } = fakeStore();
    data.set(BRAIN_DUMP_SESSION_KEY, raw);
    expect(loadBrainDumpSession(store, T0)).toBeNull();
    expect(data.has(BRAIN_DUMP_SESSION_KEY)).toBe(false);
  });

  test("a damaged plan still gives back the typed dump, without choices", () => {
    const { store, data } = fakeStore();
    const damaged = {
      summary: "x",
      priorities: [{ title: "Reply", reason: "Soon", urgency: "whenever" }],
    };
    data.set(
      BRAIN_DUMP_SESSION_KEY,
      JSON.stringify({
        v: BRAIN_DUMP_SESSION_VERSION,
        savedAt: T0,
        draft: "reply",
        plan: damaged,
        accepted: [0],
        rejected: [],
      })
    );
    expect(loadBrainDumpSession(store, T0)).toEqual({
      draft: "reply",
      plan: null,
      accepted: [],
      rejected: [],
    });
  });

  test("a draft that isn't text is dropped", () => {
    const { store, data } = fakeStore();
    data.set(
      BRAIN_DUMP_SESSION_KEY,
      JSON.stringify({ v: BRAIN_DUMP_SESSION_VERSION, savedAt: T0, draft: 7, plan })
    );
    expect(loadBrainDumpSession(store, T0)).toBeNull();
  });

  test("choices outside the plan, repeated or not whole numbers are dropped; set aside wins", () => {
    const { store, data } = fakeStore();
    data.set(
      BRAIN_DUMP_SESSION_KEY,
      JSON.stringify({
        v: BRAIN_DUMP_SESSION_VERSION,
        savedAt: T0,
        draft: "d",
        plan,
        accepted: [0, 0, 1, 3, -1, 1.5, "2"],
        rejected: [1, 9],
      })
    );
    expect(loadBrainDumpSession(store, T0)).toEqual({
      draft: "d",
      plan,
      accepted: [0],
      rejected: [1],
    });
  });
});

describe("storage that throws", () => {
  test("blocked reads give nothing kept", () => {
    expect(loadBrainDumpSession(fakeStore({ getItem: true }).store, T0)).toBeNull();
  });

  test("a full quota or blocked write reports false instead of throwing", () => {
    expect(saveBrainDumpSession(fakeStore({ setItem: true }).store, sorted, T0)).toBe(false);
  });

  test("a blocked remove reports false instead of throwing", () => {
    const { store } = fakeStore({ removeItem: true });
    expect(clearBrainDumpSession(store)).toBe(false);
    expect(
      saveBrainDumpSession(store, { draft: "", plan: null, accepted: [], rejected: [] }, T0)
    ).toBe(false);
  });

  test("bad JSON with a blocked remove still reads as nothing kept", () => {
    const { store, data } = fakeStore({ removeItem: true });
    data.set(BRAIN_DUMP_SESSION_KEY, "{oops");
    expect(loadBrainDumpSession(store, T0)).toBeNull();
  });

  test("no storage at all (server render, blocked site data)", () => {
    expect(loadBrainDumpSession(null, T0)).toBeNull();
    expect(saveBrainDumpSession(null, sorted, T0)).toBe(false);
    expect(clearBrainDumpSession(null)).toBe(false);
  });
});

describe("tabSessionStore", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  afterEach(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });

  test("is null without a window, and when reaching sessionStorage throws", () => {
    Reflect.deleteProperty(globalThis, "window");
    expect(tabSessionStore()).toBeNull();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get sessionStorage(): Storage {
          throw new Error("SecurityError");
        },
      },
    });
    expect(tabSessionStore()).toBeNull();
  });

  test("is the tab's sessionStorage when there is one", () => {
    const { store } = fakeStore();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { sessionStorage: store },
    });
    expect(tabSessionStore()).toBe(store);
  });
});

describe("clear", () => {
  test("forgets the kept dump", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    expect(clearBrainDumpSession(store)).toBe(true);
    expect(data.size).toBe(0);
    expect(loadBrainDumpSession(store, T0)).toBeNull();
  });

  test("an empty form (after Add accepted or Clear) clears what was kept", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    saveBrainDumpSession(store, { draft: "", plan: null, accepted: [], rejected: [] }, T0 + 1000);
    expect(data.size).toBe(0);
  });

  test("blank space alone is nothing to keep", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, { draft: "  \n ", plan: null, accepted: [], rejected: [] }, T0);
    expect(data.size).toBe(0);
  });

  test("setting every line aside finishes the plan and clears it", () => {
    const { store, data } = fakeStore();
    saveBrainDumpSession(store, sorted, T0);
    saveBrainDumpSession(store, { ...sorted, accepted: [], rejected: [2, 0, 1] }, T0 + 1000);
    expect(data.size).toBe(0);
  });
});

describe("isFinished", () => {
  test("open until every line is set aside; accepted lines aren't added until Add accepted", () => {
    expect(isFinished(sorted)).toBe(false);
    expect(isFinished({ ...sorted, accepted: [0, 1], rejected: [2] })).toBe(false);
    expect(isFinished({ ...sorted, accepted: [], rejected: [0, 1, 2] })).toBe(true);
    // A plan with no lines is still something to look at.
    expect(
      isFinished({
        draft: "x",
        plan: { summary: "Nothing to do", priorities: [] },
        accepted: [],
        rejected: [],
      })
    ).toBe(false);
    expect(isFinished({ draft: "", plan: null, accepted: [], rejected: [] })).toBe(true);
  });
});
