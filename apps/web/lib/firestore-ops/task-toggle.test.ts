import { describe, expect, test } from "bun:test";
import type { TaskDoc } from "../firestore/task-doc";
import { planTaskToggle } from "./task-toggle";

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

describe("planTaskToggle", () => {
  test("plans a todo task as done", () => {
    expect(planTaskToggle(task(), NOW)).toEqual({
      ok: true,
      status: "done",
      patch: { status: "done", completedAt: NOW, updatedAt: NOW },
      changedFields: ["status", "completedAt", "updatedAt"],
      clearFields: [],
    });
  });

  test("plans an in-progress task as done", () => {
    expect(planTaskToggle(task({ status: "in_progress" }), NOW)).toEqual({
      ok: true,
      status: "done",
      patch: { status: "done", completedAt: NOW, updatedAt: NOW },
      changedFields: ["status", "completedAt", "updatedAt"],
      clearFields: [],
    });
  });

  test("plans a done task as todo and clears completedAt", () => {
    expect(planTaskToggle(task({ status: "done", completedAt: 300 }), NOW)).toEqual({
      ok: true,
      status: "todo",
      patch: { status: "todo", updatedAt: NOW },
      changedFields: ["status", "completedAt", "updatedAt"],
      clearFields: ["completedAt"],
    });
  });

  test("refuses a deleted task", () => {
    expect(planTaskToggle(task({ deletedAt: 0 }), NOW)).toEqual({ ok: false, reason: "deleted" });
  });

  test("refuses a non-finite time", () => {
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(planTaskToggle(task(), now)).toEqual({ ok: false, reason: "bad-time" });
    }
  });

  test("does not change the input or put undefined in the patch", () => {
    const input = task({ description: "Bring account number" });
    const before = structuredClone(input);
    const result = planTaskToggle(input, NOW);

    expect(input).toEqual(before);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.values(result.patch)).not.toContain(undefined);
  });
});
