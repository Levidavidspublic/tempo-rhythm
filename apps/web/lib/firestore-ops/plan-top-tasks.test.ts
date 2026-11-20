import { describe, expect, test } from "bun:test";
import type { TaskStatus } from "../firestore/task-doc";
import { pickPlanTopTasks } from "./plan-top-tasks";

type Row = {
  id: string;
  status: TaskStatus;
  title: string;
  deletedAt?: number;
};

const row = (id: string, status: TaskStatus = "todo", deletedAt?: number): Row => ({
  id,
  status,
  title: `Task ${id}`,
  ...(deletedAt === undefined ? {} : { deletedAt }),
});

describe("pickPlanTopTasks", () => {
  test("returns three tasks in plan order regardless of row order", () => {
    const result = pickPlanTopTasks(["a", "b", "c"], [row("c"), row("a"), row("b")]);

    expect(result).toEqual({
      tasks: [row("a"), row("b"), row("c")],
      doneCount: 0,
      droppedCount: 0,
    });
  });

  test("drops and counts missing, deleted, and cancelled tasks", () => {
    const result = pickPlanTopTasks(
      ["missing", "deleted", "cancelled", "active"],
      [row("active"), row("deleted", "todo", 123), row("cancelled", "cancelled")]
    );

    expect(result).toEqual({ tasks: [row("active")], doneCount: 0, droppedCount: 3 });
  });

  test("keeps done tasks and counts them", () => {
    const done = row("done", "done");

    expect(pickPlanTopTasks(["done", "todo"], [row("todo"), done])).toEqual({
      tasks: [done, row("todo")],
      doneCount: 1,
      droppedCount: 0,
    });
  });

  test("shows a repeated id only once", () => {
    expect(pickPlanTopTasks(["a", "a", "b"], [row("a"), row("b")]).tasks).toEqual([
      row("a"),
      row("b"),
    ]);
  });

  test("keeps at most three tasks", () => {
    const rows = [row("a"), row("b"), row("c"), row("d")];

    expect(pickPlanTopTasks(["a", "b", "c", "d"], rows).tasks).toEqual(rows.slice(0, 3));
  });

  test("returns empty counts and tasks for an empty plan", () => {
    expect(pickPlanTopTasks([], [row("a")])).toEqual({
      tasks: [],
      doneCount: 0,
      droppedCount: 0,
    });
  });

  test("does not change either input array", () => {
    const taskIds = ["b", "a"] as const;
    const rows = [row("a"), row("b")];
    const taskIdsBefore: typeof taskIds = ["b", "a"];
    const rowsBefore = structuredClone(rows);

    pickPlanTopTasks(taskIds, rows);

    expect(taskIds).toEqual(taskIdsBefore);
    expect(rows).toEqual(rowsBefore);
  });
});
