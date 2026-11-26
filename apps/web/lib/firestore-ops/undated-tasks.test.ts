import { describe, expect, test } from "bun:test";

import { pickUndatedTasks, type UndatedTaskRow } from "./undated-tasks";

function task(overrides: Partial<UndatedTaskRow> = {}): UndatedTaskRow {
  return {
    id: "task",
    status: "todo",
    priority: "medium",
    createdAt: 1,
    ...overrides,
  };
}

describe("pickUndatedTasks", () => {
  test("leaves out a task with a due time", () => {
    const result = pickUndatedTasks([task({ id: "due", dueAt: 100 }), task({ id: "open" })]);

    expect(result).toEqual({ tasks: [task({ id: "open" })], count: 1 });
  });

  test("leaves out deleted, done, and cancelled tasks", () => {
    const open = task({ id: "open" });
    const result = pickUndatedTasks([
      open,
      task({ id: "deleted", deletedAt: 100 }),
      task({ id: "done", status: "done" }),
      task({ id: "cancelled", status: "cancelled" }),
    ]);

    expect(result).toEqual({ tasks: [open], count: 1 });
  });

  test("sorts high priority before medium and low", () => {
    const result = pickUndatedTasks([
      task({ id: "low", priority: "low" }),
      task({ id: "high", priority: "high" }),
      task({ id: "medium", priority: "medium" }),
    ]);

    expect(result.tasks.map(({ id }) => id)).toEqual(["high", "medium", "low"]);
  });

  test("sorts newest first within one priority and uses id as the tie-break", () => {
    const result = pickUndatedTasks([
      task({ id: "older", createdAt: 1 }),
      task({ id: "new-b", createdAt: 2 }),
      task({ id: "new-a", createdAt: 2 }),
    ]);

    expect(result.tasks.map(({ id }) => id)).toEqual(["new-a", "new-b", "older"]);
  });

  test("max cuts the list while count keeps the full number", () => {
    const result = pickUndatedTasks(
      [task({ id: "one" }), task({ id: "two" }), task({ id: "three" })],
      2.9
    );

    expect(result.tasks).toHaveLength(2);
    expect(result.count).toBe(3);
  });

  test("a bad max gives an empty list and count zero", () => {
    for (const max of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      expect(pickUndatedTasks([task()], max)).toEqual({ tasks: [], count: 0 });
    }
  });
});
