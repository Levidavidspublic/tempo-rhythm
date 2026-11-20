import { expect, test } from "bun:test";

import type { SubtaskRow } from "./subtasks";
import { pickSubtasks } from "./subtasks";

function row(id: string, overrides: Partial<SubtaskRow> = {}): SubtaskRow {
  return {
    id,
    status: "todo",
    createdAt: 1,
    parentTaskId: "parent",
    ...overrides,
  };
}

test("picks only the requested parent's direct subtasks", () => {
  const child = row("child");
  const result = pickSubtasks(
    [child, row("other", { parentTaskId: "another" }), row("parent")],
    "parent"
  );

  expect(result.subtasks).toEqual([child]);
  expect(result.totalCount).toBe(1);
});

test("sorts oldest first with the id tie-break", () => {
  const result = pickSubtasks([row("later", { createdAt: 2 }), row("b"), row("a")], "parent");

  expect(result.subtasks.map(({ id }) => id)).toEqual(["a", "b", "later"]);
});

test("leaves deleted subtasks out", () => {
  const result = pickSubtasks([row("live"), row("deleted", { deletedAt: 2 })], "parent");

  expect(result.subtasks.map(({ id }) => id)).toEqual(["live"]);
  expect(result.totalCount).toBe(1);
});

test("counts done, open, and cancelled subtasks", () => {
  const result = pickSubtasks(
    [
      row("todo"),
      row("active", { status: "in_progress" }),
      row("done", { status: "done" }),
      row("cancelled", { status: "cancelled" }),
    ],
    "parent"
  );

  expect(result).toMatchObject({
    doneCount: 1,
    openCount: 2,
    cancelledCount: 1,
    totalCount: 4,
  });
});

test("returns the empty answer for an empty or slashed parent id", () => {
  const emptyAnswer = {
    subtasks: [],
    doneCount: 0,
    openCount: 0,
    cancelledCount: 0,
    totalCount: 0,
  };

  expect(pickSubtasks([row("child")], "")).toEqual(emptyAnswer);
  expect(pickSubtasks([row("child")], "parents/parent")).toEqual(emptyAnswer);
});

test("does not mutate the input list or its rows", () => {
  const first = row("first", { createdAt: 2 });
  const second = row("second", { createdAt: 1 });
  const tasks = [first, second];

  const result = pickSubtasks(tasks, "parent");

  expect(tasks).toEqual([first, second]);
  expect(result.subtasks).not.toBe(tasks);
  expect(result.subtasks[0]).toBe(second);
  expect(result.subtasks[1]).toBe(first);
});
