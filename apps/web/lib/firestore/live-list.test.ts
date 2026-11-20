import { expect, test } from "bun:test";
import { applyLiveChanges, emptyLiveList } from "./live-list";

type Row = {
  name: string;
  createdAt: number;
  deletedAt?: number;
};

test("adds, modifies, and removes documents while preserving default order", () => {
  const added = applyLiveChanges(emptyLiveList<Row>(), [
    { type: "added", id: "later", data: { name: "Later", createdAt: 20 } },
    { type: "added", id: "b", data: { name: "B", createdAt: 10 } },
    { type: "added", id: "a", data: { name: "A", createdAt: 10 } },
  ]);

  expect(added.items.map((item) => item.id)).toEqual(["a", "b", "later"]);

  const changed = applyLiveChanges(added, [
    { type: "modified", id: "later", data: { name: "Now first", createdAt: 5 } },
    { type: "removed", id: "b" },
  ]);

  expect(changed.items).toEqual([
    { id: "later", data: { name: "Now first", createdAt: 5 } },
    { id: "a", data: { name: "A", createdAt: 10 } },
  ]);
  expect(changed.byId.b).toBeUndefined();
});

test("hides soft-deleted documents without dropping them and restores them", () => {
  const deleted = applyLiveChanges(emptyLiveList<Row>(), [
    { type: "added", id: "kept", data: { name: "Hidden", createdAt: 1, deletedAt: 2 } },
  ]);

  expect(deleted.items).toEqual([]);
  expect(deleted.byId.kept).toEqual({ name: "Hidden", createdAt: 1, deletedAt: 2 });

  const restored = applyLiveChanges(deleted, [
    { type: "modified", id: "kept", data: { name: "Visible", createdAt: 1 } },
  ]);
  expect(restored.items).toEqual([{ id: "kept", data: { name: "Visible", createdAt: 1 } }]);
});

test("accepts a custom item comparator", () => {
  const list = applyLiveChanges(
    emptyLiveList<Row>(),
    [
      { type: "added", id: "a", data: { name: "Alpha", createdAt: 1 } },
      { type: "added", id: "z", data: { name: "Zulu", createdAt: 2 } },
    ],
    (left, right) => right.data.name.localeCompare(left.data.name)
  );

  expect(list.items.map((item) => item.id)).toEqual(["z", "a"]);
});

test("ignores invalid changes and reuses the list for no-op batches", () => {
  const list = applyLiveChanges(emptyLiveList<Row>(), [
    { type: "added", id: "valid", data: { name: "Valid", createdAt: 1 } },
  ]);
  const ignored = applyLiveChanges(list, [
    { type: "added", id: "", data: { name: "No id", createdAt: 2 } },
    { type: "added", id: "missing" },
    { type: "modified", id: "valid" },
  ]);

  expect(applyLiveChanges(list, [])).toBe(list);
  expect(ignored).toBe(list);
  expect(applyLiveChanges(list, [{ type: "removed", id: "absent" }])).toBe(list);
  expect(applyLiveChanges(list, [{ type: "modified", id: "valid", data: list.byId.valid }])).toBe(
    list
  );
});

test("does not mutate its input list or documents", () => {
  const originalData = { name: "Original", createdAt: 1 };
  const original = applyLiveChanges(emptyLiveList<Row>(), [
    { type: "added", id: "original", data: originalData },
  ]);
  const before = structuredClone(original);

  applyLiveChanges(original, [
    { type: "modified", id: "original", data: { name: "Changed", createdAt: 2 } },
    { type: "added", id: "new", data: { name: "New", createdAt: 3 } },
  ]);

  expect(original).toEqual(before);
  expect(original.byId.original).toBe(originalData);
});
