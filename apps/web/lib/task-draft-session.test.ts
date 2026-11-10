import { afterEach, describe, expect, test } from "bun:test";
import {
  clearTaskDraft,
  loadTaskDraft,
  type SessionStore,
  saveTaskDraft,
  TASK_DRAFT_KEY,
  TASK_DRAFT_TTL_MS,
  TASK_DRAFT_VERSION,
  type TaskDraft,
  tabSessionStore,
} from "./task-draft-session";

const T0 = Date.UTC(2026, 9, 16, 9, 0);
const INBOX = "inbox";
const TODAY = "today";

const typed: TaskDraft = {
  title: "Call the dentist",
  projectName: "Health",
  priority: "high",
  energy: "low",
  dueToday: false,
  dueDate: "2026-10-20",
  repeat: "weekly",
  checklistText: "Find the card\nAsk about Friday",
};

const empty: TaskDraft = {
  title: "",
  projectName: "",
  priority: "medium",
  energy: "medium",
  dueToday: false,
  dueDate: "",
  repeat: "none",
  checklistText: "",
};

/** Put a raw kept value in the store, as an older or damaged write would have left it. */
function putRaw(data: Map<string, string>, value: Record<string, unknown>) {
  data.set(
    TASK_DRAFT_KEY,
    JSON.stringify({ v: TASK_DRAFT_VERSION, savedAt: T0, scope: INBOX, draft: typed, ...value })
  );
}

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
  test("round trip: the title and every other field come back", () => {
    const { store } = fakeStore();
    expect(saveTaskDraft(store, INBOX, typed, T0)).toBe(true);
    expect(loadTaskDraft(store, INBOX, T0 + 60_000)).toEqual(typed);
  });

  test("a Hebrew title with spaces around it comes back exactly as typed", () => {
    const { store } = fakeStore();
    const hebrew = { ...empty, title: "  להתקשר לרופא שיניים " };
    saveTaskDraft(store, INBOX, hebrew, T0);
    expect(loadTaskDraft(store, INBOX, T0)).toEqual(hebrew);
  });

  test("stores a version tag, the save time and the view, under one sessionStorage key", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect([...data.keys()]).toEqual([TASK_DRAFT_KEY]);
    expect(TASK_DRAFT_KEY).toBe("tempo:tasks:draft");
    const stored = JSON.parse(data.get(TASK_DRAFT_KEY) ?? "{}");
    expect(stored.v).toBe(TASK_DRAFT_VERSION);
    expect(stored.savedAt).toBe(T0);
    expect(stored.scope).toBe(INBOX);
  });

  test("stores only the form's own fields", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, { ...typed, extra: "not a field" } as TaskDraft, T0);
    const stored = JSON.parse(data.get(TASK_DRAFT_KEY) ?? "{}");
    expect(Object.keys(stored.draft).sort()).toEqual(Object.keys(typed).sort());
  });

  test("a later save replaces the earlier one", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, INBOX, { ...typed, title: "Call" }, T0);
    saveTaskDraft(store, INBOX, typed, T0 + 1000);
    expect(loadTaskDraft(store, INBOX, T0 + 2000)?.title).toBe(typed.title);
  });

  test("nothing kept reads as null", () => {
    expect(loadTaskDraft(fakeStore().store, INBOX, T0)).toBeNull();
  });

  test("no store (server render, blocked storage) keeps and reads nothing", () => {
    expect(saveTaskDraft(null, INBOX, typed, T0)).toBe(false);
    expect(loadTaskDraft(null, INBOX, T0)).toBeNull();
    expect(clearTaskDraft(null, INBOX)).toBe(false);
  });
});

describe("one view's draft", () => {
  test("comes back only in the view it was typed in, and stays for it", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect(loadTaskDraft(store, TODAY, T0)).toBeNull();
    expect(data.has(TASK_DRAFT_KEY)).toBe(true);
    expect(loadTaskDraft(store, INBOX, T0)).toEqual(typed);
  });

  test("a project's draft is its own", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, "project:home-reset", typed, T0);
    expect(loadTaskDraft(store, "project:garden", T0)).toBeNull();
    expect(loadTaskDraft(store, "project:home-reset", T0)).toEqual(typed);
  });

  test("typing in another view replaces it: one draft per tab", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    saveTaskDraft(store, TODAY, { ...empty, title: "Water plants", dueToday: true }, T0 + 1000);
    expect(loadTaskDraft(store, INBOX, T0 + 2000)).toBeNull();
    expect(loadTaskDraft(store, TODAY, T0 + 2000)?.title).toBe("Water plants");
  });
});

describe("expiry", () => {
  test("kept for just under 2 hours after the last save, then dropped", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect(loadTaskDraft(store, INBOX, T0 + TASK_DRAFT_TTL_MS - 1)).toEqual(typed);
    expect(loadTaskDraft(store, INBOX, T0 + TASK_DRAFT_TTL_MS)).toBeNull();
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });

  test("the 2 hours count from the last save", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    saveTaskDraft(store, INBOX, typed, T0 + 90 * 60_000);
    expect(loadTaskDraft(store, INBOX, T0 + TASK_DRAFT_TTL_MS + 60_000)).toEqual(typed);
  });

  test("an expired draft from another view is dropped too", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, TODAY, typed, T0);
    expect(loadTaskDraft(store, INBOX, T0 + TASK_DRAFT_TTL_MS)).toBeNull();
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });
});

describe("bad data reads as nothing kept", () => {
  test("bad JSON is null and is dropped", () => {
    const { store, data } = fakeStore();
    data.set(TASK_DRAFT_KEY, "{not json");
    expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });

  test("JSON that isn't a kept draft is null", () => {
    for (const raw of ["null", "42", '"text"', "[]", "{}"]) {
      const { store, data } = fakeStore();
      data.set(TASK_DRAFT_KEY, raw);
      expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
    }
  });

  test("another version, a bad save time, no view or no title is null", () => {
    const cases: Record<string, unknown>[] = [
      { v: TASK_DRAFT_VERSION + 1 },
      { v: undefined },
      { savedAt: "yesterday" },
      { savedAt: Number.NaN },
      { scope: 7 },
      { draft: null },
      { draft: { ...typed, title: 12 } },
      { draft: { ...typed, title: "   " } },
    ];
    for (const value of cases) {
      const { store, data } = fakeStore();
      putRaw(data, value);
      expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
      expect(data.has(TASK_DRAFT_KEY)).toBe(false);
    }
  });

  test("a damaged field is left out; the title still comes back", () => {
    const { store, data } = fakeStore();
    putRaw(data, {
      draft: {
        title: "Pay rent",
        projectName: 3,
        priority: "urgent",
        energy: "high",
        dueToday: "yes",
        dueDate: "2026-10-20",
        repeat: "hourly",
        checklistText: ["a"],
      },
    });
    expect(loadTaskDraft(store, INBOX, T0)).toEqual({ title: "Pay rent", energy: "high" });
  });

  test("a due date that isn't a date is left out with Show on Today", () => {
    const { store, data } = fakeStore();
    putRaw(data, { draft: { ...typed, dueDate: "next friday" } });
    const kept = loadTaskDraft(store, INBOX, T0);
    expect(kept?.title).toBe(typed.title);
    expect(kept && "dueDate" in kept).toBe(false);
    expect(kept && "dueToday" in kept).toBe(false);
  });

  test("Show on Today wins over a stray due date", () => {
    const { store, data } = fakeStore();
    putRaw(data, { draft: { ...typed, dueToday: true, dueDate: "2026-10-20" } });
    const kept = loadTaskDraft(store, INBOX, T0);
    expect(kept?.dueToday).toBe(true);
    expect(kept?.dueDate).toBe("");
  });
});

describe("storage that throws", () => {
  test("reading that throws is nothing kept", () => {
    const { store } = fakeStore({ getItem: true });
    expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
  });

  test("writing that throws (a full quota) reports false and doesn't throw", () => {
    const { store } = fakeStore({ setItem: true });
    expect(saveTaskDraft(store, INBOX, typed, T0)).toBe(false);
    expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
  });

  test("removing that throws still reads a damaged draft as nothing kept", () => {
    const { store, data } = fakeStore({ removeItem: true });
    data.set(TASK_DRAFT_KEY, "{not json");
    expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
    expect(clearTaskDraft(store, INBOX)).toBe(false);
  });

  test("clearing with reads that throw reports false", () => {
    const { store } = fakeStore({ getItem: true });
    expect(clearTaskDraft(store, INBOX)).toBe(false);
  });
});

describe("clear", () => {
  test("forgets this view's draft, as after the task is added", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect(clearTaskDraft(store, INBOX)).toBe(true);
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
    expect(loadTaskDraft(store, INBOX, T0)).toBeNull();
  });

  test("leaves a draft typed in another view", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect(clearTaskDraft(store, TODAY)).toBe(true);
    expect(loadTaskDraft(store, INBOX, T0)).toEqual(typed);
  });

  test("with nothing kept is fine", () => {
    expect(clearTaskDraft(fakeStore().store, INBOX)).toBe(true);
  });

  test("drops a damaged value it can't tell the view of", () => {
    const { store, data } = fakeStore();
    data.set(TASK_DRAFT_KEY, "{not json");
    expect(clearTaskDraft(store, TODAY)).toBe(true);
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });
});

describe("an emptied title", () => {
  test("clears the kept draft", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    expect(saveTaskDraft(store, INBOX, { ...typed, title: "" }, T0 + 1000)).toBe(true);
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
    expect(loadTaskDraft(store, INBOX, T0 + 2000)).toBeNull();
  });

  test("only spaces counts as empty", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    saveTaskDraft(store, INBOX, { ...typed, title: "   " }, T0 + 1000);
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });

  test("other fields without a title are not kept", () => {
    const { store, data } = fakeStore();
    saveTaskDraft(store, INBOX, { ...empty, checklistText: "one\ntwo" }, T0);
    expect(data.has(TASK_DRAFT_KEY)).toBe(false);
  });

  test("an empty form in another view leaves this view's draft", () => {
    const { store } = fakeStore();
    saveTaskDraft(store, INBOX, typed, T0);
    saveTaskDraft(store, TODAY, empty, T0 + 1000);
    expect(loadTaskDraft(store, INBOX, T0 + 2000)).toEqual(typed);
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
