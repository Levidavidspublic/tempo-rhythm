import { expect, test } from "bun:test";

import type { TaskDoc } from "../firestore/task-doc";
import { planTaskEdit } from "./task-edit";

const stored: TaskDoc = {
  title: "Write report",
  description: "First draft",
  dueAt: 100,
  status: "todo",
  priority: "medium",
  energy: "low",
  projectName: "Launch",
  createdAt: 1,
  updatedAt: 2,
};

test("title change is trimmed", () => {
  expect(planTaskEdit(stored, { title: "  Ship report  " }, 10)).toEqual({
    ok: true,
    patch: { title: "Ship report", updatedAt: 10 },
    changed: ["title", "updatedAt"],
    clear: [],
  });
});

test("unchanged values give no-change", () => {
  expect(planTaskEdit(stored, { title: " Write report ", dueAt: 100 }, 10)).toEqual({
    ok: false,
    reason: "no-change",
  });
});

test("due time cleared appears in clear and not in patch", () => {
  const result = planTaskEdit(stored, { dueAt: null }, 10);
  expect(result).toEqual({
    ok: true,
    patch: { updatedAt: 10 },
    changed: ["dueAt", "updatedAt"],
    clear: ["dueAt"],
  });
  if (result.ok) expect(Object.hasOwn(result.patch, "dueAt")).toBe(false);
});

test("priority change", () => {
  expect(planTaskEdit(stored, { priority: "high" }, 10)).toEqual({
    ok: true,
    patch: { priority: "high", updatedAt: 10 },
    changed: ["priority", "updatedAt"],
    clear: [],
  });
});

test("deleted task is refused", () => {
  expect(planTaskEdit({ ...stored, deletedAt: 9 }, { title: "New title" }, 10)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("empty title is refused", () => {
  expect(planTaskEdit(stored, { title: "   " }, 10)).toEqual({
    ok: false,
    reason: "empty-title",
  });
});

test("unknown edit key is refused", () => {
  expect(planTaskEdit(stored, { status: "done" } as never, 10)).toEqual({
    ok: false,
    reason: "invalid",
  });
});

test("patch has no undefined values and changed is sorted", () => {
  const result = planTaskEdit(
    stored,
    { title: " Final report ", description: undefined, energy: "high", projectName: null },
    10
  );
  expect(result).toEqual({
    ok: true,
    patch: { title: "Final report", energy: "high", updatedAt: 10 },
    changed: ["energy", "projectName", "title", "updatedAt"],
    clear: ["projectName"],
  });
  if (result.ok) expect(Object.values(result.patch)).not.toContain(undefined);
});
