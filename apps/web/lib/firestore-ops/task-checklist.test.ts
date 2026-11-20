import { expect, test } from "bun:test";
import type { TaskDoc } from "../firestore/task-doc";
import { planTaskChecklist } from "./task-checklist";

const task = (checklist?: TaskDoc["checklist"]): TaskDoc => ({
  title: "Prepare dinner",
  status: "todo",
  priority: "medium",
  createdAt: 1,
  updatedAt: 1,
  ...(checklist === undefined ? {} : { checklist }),
});

test("adds to a task with no checklist", () => {
  const result = planTaskChecklist(task(), { kind: "add", itemId: "one", text: " Chop " }, 2);
  expect(result).toEqual({
    ok: true,
    changed: true,
    checklist: [{ id: "one", text: "Chop", completed: false }],
    patch: {
      checklist: [{ id: "one", text: "Chop", completed: false }],
      updatedAt: 2,
    },
    changedFields: ["checklist", "updatedAt"],
    doneCount: 0,
    totalCount: 1,
  });
});

test("toggles an item on then off", () => {
  const stored = task([{ id: "one", text: "Chop", completed: false }]);
  const on = planTaskChecklist(stored, { kind: "toggle", itemId: "one" }, 2);
  expect(on.ok && on.checklist[0].completed).toBe(true);
  if (!on.ok) throw new Error("toggle should succeed");
  const off = planTaskChecklist(task(on.checklist), { kind: "toggle", itemId: "one" }, 3);
  expect(off.ok && off.checklist[0].completed).toBe(false);
});

test("rename trims and shortens text", () => {
  const stored = task([{ id: "one", text: "Old", completed: true }]);
  const result = planTaskChecklist(
    stored,
    { kind: "rename", itemId: "one", text: `  ${"x".repeat(205)}  ` },
    2
  );
  expect(result.ok && result.checklist[0]).toEqual({
    id: "one",
    text: "x".repeat(200),
    completed: true,
  });
});

test("rename to the same trimmed text is no change", () => {
  const stored = task([{ id: "one", text: "Chop", completed: false }]);
  const result = planTaskChecklist(stored, { kind: "rename", itemId: "one", text: " Chop " }, 2);
  expect(result.ok && result.changed).toBe(false);
  expect(result.ok && result.patch).toEqual({});
  expect(result.ok && result.changedFields).toEqual([]);
});

test("removes an item", () => {
  const stored = task([
    { id: "one", text: "Chop", completed: true },
    { id: "two", text: "Cook", completed: false },
  ]);
  const result = planTaskChecklist(stored, { kind: "remove", itemId: "one" }, 2);
  expect(result.ok && result.checklist).toEqual([
    { id: "two", text: "Cook", completed: false },
  ]);
  expect(result.ok && [result.doneCount, result.totalCount]).toEqual([0, 1]);
});

test("refuses a deleted task", () => {
  expect(planTaskChecklist({ ...task(), deletedAt: 2 }, { kind: "add", itemId: "one", text: "Chop" }, 3)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("refuses empty text", () => {
  expect(planTaskChecklist(task(), { kind: "add", itemId: "one", text: "  " }, 2)).toEqual({
    ok: false,
    reason: "empty-text",
  });
});

test("refuses an unknown item", () => {
  expect(planTaskChecklist(task(), { kind: "toggle", itemId: "missing" }, 2)).toEqual({
    ok: false,
    reason: "unknown-item",
  });
});

test("does not mutate the stored task", () => {
  const stored = task([{ id: "one", text: "Chop", completed: false }]);
  const before = structuredClone(stored);
  const result = planTaskChecklist(stored, { kind: "toggle", itemId: "one" }, 2);
  expect(stored).toEqual(before);
  expect(result.ok && result.checklist).not.toBe(stored.checklist);
  expect(result.ok && result.checklist[0]).not.toBe(stored.checklist?.[0]);
});
