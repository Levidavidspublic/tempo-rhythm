import { describe, expect, test } from "bun:test";
import { pickGoalsForList, type GoalListRow } from "./goals-list";

describe("pickGoalsForList", () => {
  test("deleted goals are left out", () => {
    const result = pickGoalsForList([
      { id: "active", status: "active", updatedAt: 1 },
      { id: "deleted", status: "completed", updatedAt: 2, deletedAt: 3 },
    ] satisfies GoalListRow[]);

    expect(result.active.map((goal) => goal.id)).toEqual(["active"]);
    expect(result.completed).toEqual([]);
  });

  test("archived goals are left out", () => {
    const result = pickGoalsForList([
      { id: "archived", status: "archived", updatedAt: 2 },
      { id: "completed", status: "completed", updatedAt: 1 },
    ] satisfies GoalListRow[]);

    expect(result.active).toEqual([]);
    expect(result.completed.map((goal) => goal.id)).toEqual(["completed"]);
  });

  test("active goals sort nearest target date first", () => {
    const result = pickGoalsForList([
      { id: "later", status: "active", targetDate: 300, updatedAt: 1 },
      { id: "nearest", status: "active", targetDate: 100, updatedAt: 1 },
      { id: "middle", status: "active", targetDate: 200, updatedAt: 1 },
    ] satisfies GoalListRow[]);

    expect(result.active.map((goal) => goal.id)).toEqual(["nearest", "middle", "later"]);
  });

  test("undated active goals come last and tie-break by id", () => {
    const result = pickGoalsForList([
      { id: "z-undated", status: "active", updatedAt: 1 },
      { id: "dated-b", status: "active", targetDate: 100, updatedAt: 1 },
      { id: "invalid-date", status: "active", targetDate: Number.NaN, updatedAt: 1 },
      { id: "dated-a", status: "active", targetDate: 100, updatedAt: 1 },
    ] satisfies GoalListRow[]);

    expect(result.active.map((goal) => goal.id)).toEqual([
      "dated-a",
      "dated-b",
      "invalid-date",
      "z-undated",
    ]);
  });

  test("completed goals sort newest update first", () => {
    const result = pickGoalsForList([
      { id: "older", status: "completed", updatedAt: 100 },
      { id: "newer-b", status: "completed", updatedAt: 200 },
      { id: "newer-a", status: "completed", updatedAt: 200 },
    ] satisfies GoalListRow[]);

    expect(result.completed.map((goal) => goal.id)).toEqual(["newer-a", "newer-b", "older"]);
  });

  test("the input array is not mutated and the counts match", () => {
    const rows = [
      { id: "completed", status: "completed", updatedAt: 3 },
      { id: "active-later", status: "active", targetDate: 2, updatedAt: 2 },
      { id: "active-sooner", status: "active", targetDate: 1, updatedAt: 1 },
    ] satisfies GoalListRow[];
    const originalOrder = rows.map((goal) => goal.id);

    const result = pickGoalsForList(rows);

    expect(rows.map((goal) => goal.id)).toEqual(originalOrder);
    expect(result.active).not.toBe(rows);
    expect(result.activeCount).toBe(result.active.length);
    expect(result.completedCount).toBe(result.completed.length);
    expect(result).toMatchObject({ activeCount: 2, completedCount: 1 });
  });
});
