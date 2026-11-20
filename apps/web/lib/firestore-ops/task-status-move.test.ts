import { expect, test } from "bun:test";
import type { TaskDoc } from "../firestore/task-doc";
import { planTaskStatusMove } from "./task-status-move";

const NOW = 1_800_000_000_000;

function task(overrides: Partial<TaskDoc> = {}): TaskDoc {
  return {
    title: "Call the bank",
    status: "todo",
    priority: "medium",
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

test("plans a todo task as in progress without mutating it", () => {
  const input = task();
  const before = structuredClone(input);

  expect(planTaskStatusMove(input, "in_progress", NOW)).toEqual({
    ok: true,
    changed: true,
    status: "in_progress",
    patch: { status: "in_progress", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
    clearFields: [],
  });
  expect(input).toEqual(before);
});

test("plans an in-progress task as cancelled", () => {
  expect(planTaskStatusMove(task({ status: "in_progress" }), "cancelled", NOW)).toEqual({
    ok: true,
    changed: true,
    status: "cancelled",
    patch: { status: "cancelled", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
    clearFields: [],
  });
});

test("plans a done task as todo and clears completedAt", () => {
  const result = planTaskStatusMove(task({ status: "done", completedAt: 300 }), "todo", NOW);

  expect(result).toEqual({
    ok: true,
    changed: true,
    status: "todo",
    patch: { status: "todo", updatedAt: NOW },
    changedFields: ["status", "completedAt", "updatedAt"],
    clearFields: ["completedAt"],
  });
  if (result.ok) expect(Object.values(result.patch)).not.toContain(undefined);
});

test("returns no change when the status is already set", () => {
  expect(planTaskStatusMove(task(), "todo", NOW)).toEqual({
    ok: true,
    changed: false,
    status: "todo",
    patch: {},
    changedFields: [],
    clearFields: [],
  });
});

test("refuses a deleted task", () => {
  expect(planTaskStatusMove(task({ deletedAt: 0 }), "cancelled", NOW)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("refuses done and unknown wanted statuses", () => {
  expect(planTaskStatusMove(task(), "done" as "todo", NOW)).toEqual({
    ok: false,
    reason: "bad-status",
  });
  expect(planTaskStatusMove(task(), "unknown" as "todo", NOW)).toEqual({
    ok: false,
    reason: "bad-status",
  });
});

test("refuses a non-finite time", () => {
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(planTaskStatusMove(task(), "in_progress", now)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  }
});
