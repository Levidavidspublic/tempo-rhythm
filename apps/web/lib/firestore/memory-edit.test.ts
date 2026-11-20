import { expect, test } from "bun:test";
import { MEMORY_CONTENT_MAX, planMemoryEdit, planMemoryForget } from "./memory-edit";

const memory = {
  content: "Prefers quiet mornings",
  sector: "semantic",
  salience: 0.8,
  decayRate: 0.1,
  lastAccessed: 100,
  accessCount: 2,
  metadata: { source: "person" },
  createdAt: 50,
  updatedAt: 100,
};

test("edit returns the patch and changed fields without mutating the input", () => {
  const stored = structuredClone(memory);
  const before = structuredClone(stored);

  expect(planMemoryEdit(stored, "Likes calm mornings", 200)).toEqual({
    ok: true,
    kind: "update",
    patch: { content: "Likes calm mornings", updatedAt: 200 },
    changedFields: ["content", "updatedAt"],
  });
  expect(stored).toEqual(before);
});

test("edit trims text", () => {
  expect(planMemoryEdit(memory, "  Likes tea  \n", 200)).toEqual({
    ok: true,
    kind: "update",
    patch: { content: "Likes tea", updatedAt: 200 },
    changedFields: ["content", "updatedAt"],
  });
});

test("unchanged text gives no-change", () => {
  expect(planMemoryEdit(memory, ` ${memory.content} `, 200)).toEqual({
    ok: true,
    kind: "no-change",
  });
});

test("empty or non-string text is refused", () => {
  expect(planMemoryEdit(memory, " \n ", 200)).toEqual({ ok: false, reason: "empty" });
  expect(planMemoryEdit(memory, null, 200)).toEqual({ ok: false, reason: "empty" });
});

test("text over 2000 characters is refused", () => {
  expect(planMemoryEdit(memory, "x".repeat(MEMORY_CONTENT_MAX + 1), 200)).toEqual({
    ok: false,
    reason: "too-long",
  });
});

test("deleted memory is refused for edit", () => {
  expect(planMemoryEdit({ ...memory, deletedAt: 150 }, "New text", 200)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("forget returns the soft-delete patch without mutating the input", () => {
  const stored = structuredClone(memory);
  const before = structuredClone(stored);

  expect(planMemoryForget(stored, 200)).toEqual({
    ok: true,
    patch: { deletedAt: 200, updatedAt: 200 },
  });
  expect(stored).toEqual(before);
});

test("forget refuses already deleted, invalid memories, and invalid timestamps", () => {
  const deleted = { ...memory, deletedAt: 150 };
  const before = structuredClone(deleted);

  expect(planMemoryForget(deleted, 200)).toEqual({ ok: false, reason: "deleted" });
  expect(planMemoryForget({ content: "incomplete" }, 200)).toEqual({
    ok: false,
    reason: "invalid-memory",
  });
  expect(planMemoryForget(memory, 0)).toEqual({ ok: false, reason: "invalid-now" });
  expect(planMemoryEdit(memory, "Changed", Number.NaN)).toEqual({
    ok: false,
    reason: "invalid-now",
  });
  expect(deleted).toEqual(before);
});
