import { sleep } from "bun";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { getE2eRowStore } from "@/lib/insforge/e2e-row-store";
import { createLiveRows } from "@/lib/insforge/use-live-rows";
import rowsFixture from "./use-task-list.rows.json";
import { makeUseInsforgeTaskList, makeUseTaskList } from "./use-task-list";

describe("useTaskList", () => {
  test("passes the same args to tasks:list and returns its result unchanged", () => {
    expect.assertions(3);
    const args = {};
    const tasks: never[] = [];
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe(args);
      return tasks;
    });

    expect(useTaskList(args)).toBe(tasks);
  });

  test("passes skip to tasks:list and leaves the result undefined", () => {
    expect.assertions(3);
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useTaskList("skip")).toBeUndefined();
  });

  test("leaves a loading query result undefined", () => {
    const useTaskList = makeUseTaskList(() => undefined);

    expect(useTaskList({})).toBeUndefined();
  });

  test("lets query failures reach the screen's error boundary", () => {
    const error = new Error("Task list query failed");
    const useTaskList = makeUseTaskList(() => {
      throw error;
    });

    expect(() => useTaskList({})).toThrow(error);
  });

  test("ProjectsScreen keeps its auth gate when calling useTaskList", async () => {
    const source = await readFile(
      new URL("../../../components/projects/ProjectsScreen.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('import { useTaskList } from "@/lib/data/tasks/use-task-list";');
    expect(source).toContain('useTaskList(signedIn === "ready" ? {} : "skip")');
    expect(source).not.toContain("api.tasks.list");
  });
});

describe("InsForge task list", () => {
  const uid = rowsFixture.base["user_id"];
  const bypassName = "NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS";
  let originalBypass: string | undefined;
  let originalWindow: PropertyDescriptor | undefined;
  let store: NonNullable<ReturnType<typeof getE2eRowStore>>;

  beforeEach(() => {
    originalBypass = process.env[bypassName];
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    process.env[bypassName] = "1";
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    const fixture = getE2eRowStore();
    if (!fixture) throw new Error("Expected a fixture row store");
    store = fixture;
  });

  afterEach(() => {
    store?.reset();
    if (originalBypass === undefined) Reflect.deleteProperty(process.env, bypassName);
    else process.env[bypassName] = originalBypass;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  function task(sequence: number, fields?: Exclude<keyof typeof rowsFixture, "base">) {
    return {
      table: "tasks",
      row: {
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
        ...rowsFixture.base,
        ...Object.fromEntries([
          ["created_at", sequence],
          ["updated_at", sequence],
        ]),
        ...(fields ? rowsFixture[fields] : undefined),
      },
    };
  }

  type Args = Parameters<ReturnType<typeof makeUseInsforgeTaskList>>[0];

  function openRead(args: Args, owner: string | null = uid) {
    type Rows = ReturnType<Parameters<typeof makeUseInsforgeTaskList>[0]>;
    let rows: Rows;
    let live: ReturnType<typeof createLiveRows> | undefined;
    let failedReadKey: string | undefined;
    const failed = Promise.withResolvers<void>();
    const readTaskSnapshot = makeUseInsforgeTaskList(
      (options) => {
        live ??= createLiveRows<NonNullable<Rows>[number]>({
          ...options,
          debounceMs: 0,
          onRows: (snapshot) => {
            rows = snapshot;
          },
        });
        return rows;
      },
      () => [
        failedReadKey,
        (key) => {
          failedReadKey = key;
          failed.resolve();
        },
      ]
    );
    return {
      render: () => readTaskSnapshot(args, owner ?? undefined),
      failed: failed.promise,
      stop: () => live?.stop(),
    };
  }

  async function read(args: Args, owner: string | null = uid) {
    const request = openRead(args, owner);
    try {
      const first = request.render();
      await sleep(0);
      return { first, result: request.render() };
    } finally {
      request.stop();
    }
  }

  test("returns undefined while loading and an empty array after an empty read", async () => {
    expect(await read({})).toEqual({ first: undefined, result: [] });
  });

  test("throws during render if the initial read fails instead of returning empty or loading", async () => {
    const select = spyOn(store, "select").mockImplementationOnce(() => {
      throw new Error("Initial read failed");
    });
    const request = openRead({});
    try {
      expect(request.render()).toBeUndefined();
      await request.failed;
      expect(request.render).toThrow("Unable to load InsForge tasks");
    } finally {
      request.stop();
      select.mockRestore();
    }
    expect(await read({})).toEqual({ first: undefined, result: [] });
  });

  test("throws during render if a realtime refresh fails instead of returning stale rows", async () => {
    const initial = task(1);
    store.reset([initial]);
    const request = openRead({});
    const select = spyOn(store, "select");
    try {
      expect(request.render()).toBeUndefined();
      await sleep(0);
      expect(request.render()?.map(({ _id }) => String(_id))).toEqual([initial.row.id]);
      select.mockImplementationOnce(() => {
        throw new Error("Refresh read failed");
      });
      store.mutate(
        { table: "tasks", uid },
        { type: "update", id: initial.row.id, patch: { status: "done" } }
      );
      await request.failed;
      expect(request.render).toThrow("Unable to load InsForge tasks");
    } finally {
      request.stop();
      select.mockRestore();
    }
  });

  test("does not read the fixture store when skipped or when no owner is signed in", async () => {
    store.reset([task(1)]);
    const select = spyOn(store, "select");
    try {
      const notLoaded = { first: undefined, result: undefined };
      expect(await read("skip")).toEqual(notLoaded);
      expect(await read({}, null)).toEqual(notLoaded);
      expect(select).not.toHaveBeenCalled();
    } finally {
      select.mockRestore();
    }
  });

  test("returns only live owner rows, newest updates first, in the task list shape", async () => {
    const older = task(3);
    const newest = task(1, "newest");
    store.reset([older, task(2, "otherOwner"), newest, task(4, "deleted")]);

    const { result } = await read({});
    expect(result?.map(({ _id }) => String(_id))).toEqual([newest.row.id, older.row.id]);
    expect<unknown>(result?.[0]).toEqual({
      _id: newest.row.id,
      _creationTime: 1,
      userId: uid,
      title: "Kitchen reset",
      description: "Empty the dishwasher",
      status: "done",
      priority: "high",
      energy: "low",
      timeEstimate: 0,
      flexibility: "elastic",
      timeSpentOnDay: { "2026-11-26": 15 },
      repeatCfgId: "00000000-0000-4000-9000-000000000001",
      parentTaskId: older.row.id,
      projectId: "house",
      projectName: "Home",
      dueAt: 20,
      completedAt: 7,
      checklist: [{ id: "1", text: "Plates", completed: true }],
      createdAt: 1,
      updatedAt: 8,
    });
    expect(result?.[1]?.energy).toBeUndefined();
  });

  test("matches the same combined filters, including default energy and half-open due times", async () => {
    const title = task(1, "windowStart");
    const description = task(2, "matchingDescription");
    store.reset([
      title,
      description,
      task(3, "done"),
      task(4, "otherProject"),
      task(5, "lowPriority"),
      task(6, "highEnergy"),
      task(7, "otherTitle"),
      task(8, "beforeWindow"),
      task(9, "windowEnd"),
      task(10, "undated"),
    ]);
    const { result } = await read({
      status: "todo",
      projectId: " house ",
      priority: "high",
      energy: "medium",
      search: "  Kitchen ",
      dueFrom: 10,
      dueTo: 21,
    });
    expect(result?.map(({ _id }) => String(_id))).toEqual([description.row.id, title.row.id]);
  });

  test("includes cancelled tasks in a due window; ignores a missing window endpoint", async () => {
    const cancelled = task(1, "cancelled");
    const undated = task(2, "undated");
    store.reset([cancelled, undated]);
    expect((await read({ dueFrom: 0, dueTo: 30 })).result?.map(({ _id }) => String(_id))).toEqual([
      cancelled.row.id,
    ]);
    const { result } = await read({ dueFrom: 90, search: " ", projectId: " " });
    expect(result?.map(({ _id }) => String(_id))).toEqual([undated.row.id, cancelled.row.id]);
  });
});
