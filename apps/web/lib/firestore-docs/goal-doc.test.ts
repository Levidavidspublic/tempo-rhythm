import { describe, expect, test } from "bun:test";
import {
  checkGoalDoc,
  restoreGoal,
  softDeleteGoal,
  type GoalDoc,
} from "./goal-doc";

const goal: GoalDoc = {
  title: "Ship the Firestore port",
  description: "Move goals without changing their meaning.",
  targetDate: 1_800_000_000_000,
  progressPercent: 40,
  status: "active",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_100,
};

describe("goal documents", () => {
  test("a valid goal passes", () => {
    expect(checkGoalDoc(goal)).toEqual({ ok: true, doc: goal });
  });

  test("a blank title is rejected", () => {
    expect(checkGoalDoc({ ...goal, title: "  " })).toEqual({
      ok: false,
      reason: "title must not be blank",
    });
  });

  test("progressPercent 101 is rejected", () => {
    expect(checkGoalDoc({ ...goal, progressPercent: 101 })).toEqual({
      ok: false,
      reason: "progressPercent must be between 0 and 100",
    });
  });

  test("an unknown status is rejected", () => {
    expect(checkGoalDoc({ ...goal, status: "paused" })).toEqual({
      ok: false,
      reason: "status is invalid",
    });
  });

  test("the unknown userId key is rejected", () => {
    expect(checkGoalDoc({ ...goal, userId: "user-1" })).toEqual({
      ok: false,
      reason: "unknown key: userId",
    });
  });

  test("soft delete and restore are immutable", () => {
    const original = { ...goal };
    const deleted = softDeleteGoal(original, 1_700_000_000_200);
    const deletedSnapshot = { ...deleted };
    const restored = restoreGoal(deleted, 1_700_000_000_300);

    expect(original).toEqual(goal);
    expect(deleted).toEqual(deletedSnapshot);
    expect(deleted).not.toBe(original);
    expect(restored).not.toBe(deleted);
    expect("deletedAt" in restored).toBe(false);
    expect(restored.updatedAt).toBe(1_700_000_000_300);
  });
});
