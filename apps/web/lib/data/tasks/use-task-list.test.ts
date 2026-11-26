import { sleep } from "bun";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { readFile } from "node:fs/promises";
import { getE2eRowStore } from "@/lib/insforge/e2e-row-store";
import { createLiveRows } from "@/lib/insforge/use-live-rows";
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
  const uid = "a187aeb4-2a0d-471f-8f01-04e8805d683d";
  const otherUid = "8278b666-98bb-4631-aea5-489f17c4154d";
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

  function task(sequence: number, fields: Record<string, unknown> = {}) {
    return {
      table: "tasks",
      row: {
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
        user_id: uid,
        title: "Kitchen reset",
        status: "todo",
        priority: "high",
        project_id: "house",
        due_at: 20,
        created_at: sequence,
        updated_at: sequence,
        deleted_at: null,
        ...fields,
      },
    };
  }

  async function read(
    args: Parameters<ReturnType<typeof makeUseInsforgeTaskList>>[0],
    owner: string | null = uid
  ) {
    type Rows = ReturnType<Parameters<typeof makeUseInsforgeTaskList>[0]>;
    let rows: Rows;
    let live: ReturnType<typeof createLiveRows> | undefined;
    const readTaskSnapshot = makeUseInsforgeTaskList((options) => {
      live ??= createLiveRows<NonNullable<Rows>[number]>({
        ...options,
        onRows: (snapshot) => {
          rows = snapshot;
        },
      });
      return rows;
    });

    try {
      const first = readTaskSnapshot(args, owner ?? undefined);
      await sleep(0);
      return { first, result: readTaskSnapshot(args, owner ?? undefined) };
    } finally {
      live?.stop();
    }
  }

  test("returns undefined while loading and an empty array after an empty read", async () => {
    expect(await read({})).toEqual({ first: undefined, result: [] });
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
    const newest = task(1, {
      updated_at: 8,
      description: "Empty the dishwasher",
      status: "done",
      energy: "low",
      time_estimate: 0,
      flexibility: "elastic",
      time_spent_on_day: { "2026-11-26": 15 },
      repeat_cfg_id: "00000000-0000-4000-9000-000000000001",
      parent_task_id: older.row.id,
      project_name: "Home",
      completed_at: 7,
      checklist: [{ id: "1", text: "Plates", completed: true }],
      legacy_convex_id: "not-the-task-id",
    });
    store.reset([
      older,
      task(2, { user_id: otherUid, updated_at: 9 }),
      newest,
      task(4, { deleted_at: 6 }),
    ]);

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
    const title = task(1, { energy: null, due_at: 10 });
    const description = task(2, {
      title: "Wash the dishes",
      description: "KITCHEN reset",
      energy: "medium",
    });
    store.reset([
      title,
      description,
      task(3, { status: "done" }),
      task(4, { project_id: "office" }),
      task(5, { priority: "low" }),
      task(6, { energy: "high" }),
      task(7, { title: "Wash the dishes" }),
      task(8, { due_at: 9 }),
      task(9, { due_at: 21 }),
      task(10, { due_at: null }),
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
    const cancelled = task(1, { status: "cancelled" });
    const undated = task(2, { due_at: null });
    store.reset([cancelled, undated]);
    expect((await read({ dueFrom: 0, dueTo: 30 })).result?.map(({ _id }) => String(_id))).toEqual([
      cancelled.row.id,
    ]);
    const { result } = await read({ dueFrom: 90, search: " ", projectId: " " });
    expect(result?.map(({ _id }) => String(_id))).toEqual([undated.row.id, cancelled.row.id]);
  });
});
