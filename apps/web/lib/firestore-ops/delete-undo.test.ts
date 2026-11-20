import { expect, test } from "bun:test";

import { planSoftDelete, undoState } from "./delete-undo";

test("a live document gets delete and undo patches with an undo deadline", () => {
  expect(planSoftDelete({}, 1_000)).toEqual({
    ok: true,
    deletePatch: { deletedAt: 1_000, updatedAt: 1_000 },
    undoPatch: { set: { updatedAt: 1_000 }, remove: ["deletedAt"] },
    undoUntil: 11_000,
  });
});

test("an already-deleted document is refused", () => {
  expect(planSoftDelete({ deletedAt: 500 }, 1_000)).toEqual({
    ok: false,
    reason: "already-deleted",
  });
});

test("an invalid time is refused", () => {
  expect(planSoftDelete({}, Number.NaN)).toEqual({
    ok: false,
    reason: "invalid-time",
  });
});

test("undo state right after deletion has 10 seconds left", () => {
  expect(undoState(1_000, 1_000)).toEqual({ canUndo: true, secondsLeft: 10 });
});

test("undo state after 9.2 seconds has 1 second left", () => {
  expect(undoState(1_000, 10_200)).toEqual({ canUndo: true, secondsLeft: 1 });
});

test("undo state after 10 seconds cannot undo", () => {
  expect(undoState(1_000, 11_000)).toEqual({ canUndo: false, secondsLeft: 0 });
});
