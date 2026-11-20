import { describe, expect, test } from "bun:test";
import type { TaskStatus } from "../firestore/task-doc";
import { pickCarryOver, pickTasksDueInRange } from "./today-tasks";

type Row = {
  id: string;
  status: TaskStatus;
  dueAt?: number;
  deletedAt?: number;
  title?: string;
};

const row = (id: string, dueAt?: number, status: TaskStatus = "todo"): Row => ({
  id,
  status,
  dueAt,
});

describe("pickTasksDueInRange", () => {
  test("keeps rows inside the day and sorts by due time, then id", () => {
    const rows = [row("z", 20), row("b", 10), row("a", 10), row("late", 30)];
    expect(pickTasksDueInRange(rows, 10, 30).map(({ id }) => id)).toEqual(["a", "b", "z"]);
  });

  test("uses an inclusive lower edge and exclusive upper edge", () => {
    const rows = [row("before", 9), row("start", 10), row("end", 20)];
    expect(pickTasksDueInRange(rows, 10, 20).map(({ id }) => id)).toEqual(["start"]);
  });

  test("drops deleted, cancelled, and undated rows", () => {
    const deleted = { ...row("deleted", 10), deletedAt: 0 };
    const cancelled = row("cancelled", 12, "cancelled");
    expect(
      pickTasksDueInRange([deleted, row("undated"), cancelled, row("kept", 11)], 10, 20)
    ).toEqual([row("kept", 11)]);
  });

  test("returns an empty list for an upside-down or non-finite range", () => {
    const rows = [row("task", 10)];
    expect(pickTasksDueInRange(rows, 20, 10)).toEqual([]);
    expect(pickTasksDueInRange(rows, Number.NaN, 20)).toEqual([]);
  });
});

describe("pickCarryOver", () => {
  test("keeps only todo and in-progress rows due before the cut-off", () => {
    const rows = [
      row("later", 20),
      row("progress", 8, "in_progress"),
      row("todo", 5),
      row("done", 4, "done"),
      row("cancelled", 3, "cancelled"),
      row("negative", -1),
      { ...row("deleted", 2), deletedAt: 1 },
    ];
    expect(pickCarryOver(rows, 20).map(({ id }) => id)).toEqual(["todo", "progress"]);
  });

  test("stops at max after sorting", () => {
    const rows = [row("c", 3), row("b", 2), row("a", 1)];
    expect(pickCarryOver(rows, 10, 2).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  test("does not change the input array", () => {
    const rows = [row("later", 2), row("earlier", 1)];
    const snapshot = structuredClone(rows);
    pickTasksDueInRange(rows, 0, 10);
    pickCarryOver(rows, 10);
    expect(rows).toEqual(snapshot);
  });
});
