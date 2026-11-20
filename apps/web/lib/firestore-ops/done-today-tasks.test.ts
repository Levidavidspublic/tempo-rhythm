import { describe, expect, test } from "bun:test";

import { pickTasksDoneInRange, type DoneTaskRow } from "./done-today-tasks";

describe("pickTasksDoneInRange", () => {
  test("returns a task completed inside the window", () => {
    const task: DoneTaskRow = { id: "inside", status: "done", completedAt: 150 };

    expect(pickTasksDoneInRange([task], 100, 200)).toEqual({ tasks: [task], count: 1 });
  });

  test("keeps the start boundary and leaves out the end boundary", () => {
    const atStart: DoneTaskRow = { id: "start", status: "done", completedAt: 100 };
    const atEnd: DoneTaskRow = { id: "end", status: "done", completedAt: 200 };

    expect(pickTasksDoneInRange([atEnd, atStart], 100, 200)).toEqual({
      tasks: [atStart],
      count: 1,
    });
  });

  test("leaves out deleted tasks", () => {
    const deleted: DoneTaskRow = {
      id: "deleted",
      status: "done",
      completedAt: 150,
      deletedAt: 175,
    };

    expect(pickTasksDoneInRange([deleted], 100, 200)).toEqual({ tasks: [], count: 0 });
  });

  test("leaves out unfinished tasks and tasks without a completion time", () => {
    const rows: DoneTaskRow[] = [
      { id: "todo", status: "todo", completedAt: 150 },
      { id: "missing", status: "done" },
      { id: "invalid", status: "done", completedAt: Number.NaN },
    ];

    expect(pickTasksDoneInRange(rows, 100, 200)).toEqual({ tasks: [], count: 0 });
  });

  test("sorts newest first and uses id as the tie-breaker without mutating input", () => {
    const rows: DoneTaskRow[] = [
      { id: "b", status: "done", completedAt: 150 },
      { id: "older", status: "done", completedAt: 125 },
      { id: "a", status: "done", completedAt: 150 },
      { id: "newest", status: "done", completedAt: 175 },
    ];
    const originalOrder = [...rows];

    const result = pickTasksDoneInRange(rows, 100, 200);

    expect(result.tasks.map((task) => task.id)).toEqual(["newest", "a", "b", "older"]);
    expect(result.count).toBe(4);
    expect(rows).toEqual(originalOrder);
    expect(result.tasks).not.toBe(rows);
  });

  test("returns an empty result for a bad window", () => {
    const task: DoneTaskRow = { id: "done", status: "done", completedAt: 150 };

    expect(pickTasksDoneInRange([task], Number.NaN, 200)).toEqual({ tasks: [], count: 0 });
    expect(pickTasksDoneInRange([task], 100, Number.POSITIVE_INFINITY)).toEqual({
      tasks: [],
      count: 0,
    });
    expect(pickTasksDoneInRange([task], 200, 100)).toEqual({ tasks: [], count: 0 });
  });
});
