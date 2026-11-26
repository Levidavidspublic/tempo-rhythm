import { build } from "bun";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { isInsforgeE2eMode } from "./e2e-mode";
import { getE2eRowStore } from "./e2e-row-store";

const tasks = { table: "tasks", uid: "fixture-owner" };
const otherTasks = { ...tasks, uid: "other-owner" };
const notes = { ...tasks, table: "notes" };
const ownerColumn = "user_id";
const deletedColumn = "deleted_at";
const task = {
  id: "row-1",
  [ownerColumn]: tasks.uid,
  title: "First task",
  rank: 2,
  [deletedColumn]: null,
};
const bypassFlagName = "NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS";

function setEnv(name: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

function getStore() {
  const store = getE2eRowStore();
  if (!store) throw new Error("Expected the fixture store in the test browser");
  return store;
}

describe("InsForge E2E row store", () => {
  let bypassFlag: string | undefined;
  let nodeEnv: string | undefined;
  let windowProperty: PropertyDescriptor | undefined;
  let store: ReturnType<typeof getStore>;

  beforeEach(() => {
    bypassFlag = process.env[bypassFlagName];
    nodeEnv = process.env.NODE_ENV;
    windowProperty = Object.getOwnPropertyDescriptor(globalThis, "window");
    setEnv("NODE_ENV", "test");
    setEnv(bypassFlagName, "1");
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    store = getStore();
  });

  afterEach(() => {
    store.reset();
    setEnv("NODE_ENV", nodeEnv);
    setEnv(bypassFlagName, bypassFlag);
    if (windowProperty) Object.defineProperty(globalThis, "window", windowProperty);
    else Reflect.deleteProperty(globalThis, "window");
  });

  test.each(["development", "test"])("enables one browser store in %s with the flag", (mode) => {
    setEnv("NODE_ENV", mode);

    expect(isInsforgeE2eMode()).toBe(true);
    expect(getStore()).toBe(getStore());
  });

  test.each([
    ["unset", undefined],
    ["0", "0"],
    ["true", "true"],
  ])("ignores non-opt-in flag %s", (_label, flag) => {
    setEnv(bypassFlagName, flag);

    expect(isInsforgeE2eMode()).toBe(false);
    expect(getE2eRowStore()).toBeNull();
  });

  test("never exposes the store in production, even after initialization", () => {
    getStore().reset([{ table: tasks.table, row: task }]);
    setEnv("NODE_ENV", "production");

    expect(isInsforgeE2eMode()).toBe(false);
    expect(getE2eRowStore()).toBeNull();
  });

  test("does not expose the store during server rendering", () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: undefined });

    expect(getE2eRowStore()).toBeNull();
  });

  test("bootstraps fixtures and selects filtered rows in order per table and owner", () => {
    const later = { ...task, id: "row-2", rank: 10 };
    const deleted = { ...task, id: "row-3", [deletedColumn]: 20 };
    const otherOwner = { ...task, [ownerColumn]: otherTasks.uid };
    const note = { ...task, title: "First note" };
    store.reset([
      { table: tasks.table, row: later },
      { table: tasks.table, row: deleted },
      { table: tasks.table, row: task },
      { table: tasks.table, row: otherOwner },
      { table: notes.table, row: note },
    ]);

    expect(
      store.select(tasks, { filters: [[deletedColumn, null]], order: { column: "rank" } })
    ).toEqual([task, later]);
    expect(
      store.select(tasks, {
        filters: [[deletedColumn, null]],
        order: { column: "rank", ascending: false },
      })
    ).toEqual([later, task]);
    expect(store.select(otherTasks)).toEqual([otherOwner]);
    expect(store.select(notes)).toEqual([note]);
  });

  test("publishes successful writes to the matching scope, never reads or empty updates", () => {
    const onTasks = mock(() => store.select(tasks));
    const onOther = mock(() => {});
    const stop = store.subscribe(tasks, onTasks);
    const stopOther = store.subscribe(otherTasks, onOther);
    const stopNotes = store.subscribe(notes, onOther);
    try {
      expect(store.select(tasks)).toEqual([]);
      expect(onTasks).not.toHaveBeenCalled();

      store.mutate(tasks, { type: "insert", row: task });
      store.mutate(tasks, { type: "update", id: task.id, patch: { [deletedColumn]: 5 } });
      store.mutate(tasks, { type: "update", id: task.id, patch: {} });
      expect(onTasks).toHaveBeenCalledTimes(2);
      expect(onTasks).toHaveLastReturnedWith([{ ...task, [deletedColumn]: 5 }]);
      expect(onOther).not.toHaveBeenCalled();

      stop();
      store.mutate(tasks, { type: "update", id: task.id, patch: { [deletedColumn]: null } });
      expect(onTasks).toHaveBeenCalledTimes(2);
      expect(store.select(tasks)).toEqual([task]);
    } finally {
      stop();
      stopOther();
      stopNotes();
    }
  });

  test.each(["mutate", "reset"] as const)("isolates failing subscribers during %s", (operation) => {
    const report = spyOn(console, "error").mockImplementation(() => {});
    const onTask = mock(() => store.select(tasks));
    const onNote = mock(() => store.select(notes));
    const stops = [
      store.subscribe(tasks, () => {
        throw new Error("Fixture subscriber failed");
      }),
      store.subscribe(tasks, onTask),
      store.subscribe(notes, onNote),
    ];
    try {
      if (operation === "mutate") {
        store.mutate(tasks, { type: "insert", row: task });
        expect(onNote).not.toHaveBeenCalled();
      } else {
        store.reset([
          { table: tasks.table, row: task },
          { table: notes.table, row: task },
        ]);
        expect(onNote).toHaveBeenCalledTimes(1);
        expect(onNote).toHaveLastReturnedWith([task]);
      }
      expect(onTask).toHaveBeenCalledTimes(1);
      expect(onTask).toHaveLastReturnedWith([task]);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report).toHaveBeenCalledWith(
        "[insforge-e2e-row-store] Subscriber notification failed"
      );
    } finally {
      for (const stop of stops) stop();
      report.mockRestore();
    }
  });

  test("rejects invalid writes and a bad bootstrap without changing rows or notifying", () => {
    store.reset([{ table: tasks.table, row: task }]);
    const onChange = mock(() => {});
    const stop = store.subscribe(tasks, onChange);
    try {
      expect(() => store.mutate(tasks, { type: "insert", row: task })).toThrow("Duplicate");
      expect(() => store.mutate(otherTasks, { type: "insert", row: task })).toThrow("identity");
      expect(() => store.mutate(otherTasks, { type: "update", id: task.id, patch: {} })).toThrow(
        "not found"
      );
      expect(() =>
        store.mutate(tasks, {
          type: "update",
          id: task.id,
          patch: { [ownerColumn]: otherTasks.uid },
        })
      ).toThrow("identity");
      expect(() => store.select({ ...tasks, uid: "" })).toThrow("table and owner");
      expect(() =>
        store.reset([
          { table: notes.table, row: task },
          { table: notes.table, row: task },
        ])
      ).toThrow("Duplicate");
      expect(store.select(tasks)).toEqual([task]);
      expect(store.select(notes)).toEqual([]);
      expect(onChange).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });

  test("only notifies affected scopes when resetting or clearing fixtures", () => {
    store.reset([{ table: tasks.table, row: task }]);
    const onTask = mock(() => {});
    const onNote = mock(() => {});
    const onOther = mock(() => {});
    const stops = [
      store.subscribe(tasks, onTask),
      store.subscribe(notes, onNote),
      store.subscribe(otherTasks, onOther),
    ];
    try {
      store.reset([{ table: notes.table, row: task }]);
      expect(store.select(tasks)).toEqual([]);
      expect(store.select(notes)).toEqual([task]);
      expect(onTask).toHaveBeenCalledTimes(1);
      expect(onNote).toHaveBeenCalledTimes(1);

      store.reset();
      store.reset();
      expect(store.select(notes)).toEqual([]);
      expect(onTask).toHaveBeenCalledTimes(1);
      expect(onNote).toHaveBeenCalledTimes(2);
      expect(onOther).not.toHaveBeenCalled();
    } finally {
      for (const stop of stops) stop();
    }
  });

  test("does not share mutable row data or make network requests", () => {
    const fetch = spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("The fixture store must not fetch")
    );
    try {
      const checklist = ["first"];
      store.mutate(tasks, { type: "insert", row: { ...task, checklist } });
      checklist.push("outside");
      const reread = store.select(tasks);
      (reread[0].checklist as string[]).push("from snapshot");
      expect(store.select(tasks)).toEqual([{ ...task, checklist: ["first"] }]);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  test("has no runtime dependency on the InsForge SDK in the browser bundle", async () => {
    const result = await build({
      entrypoints: [new URL("./e2e-row-store.ts", import.meta.url).pathname],
      target: "browser",
      plugins: [
        {
          name: "no-insforge-sdk",
          setup(builder) {
            builder.onResolve({ filter: /^@insforge\/sdk(?:\/|$)/ }, () => {
              throw new Error("The fixture store must not import the InsForge SDK");
            });
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
