import { describe, expect, test } from "bun:test";
import type { GoalDoc } from "../firestore-docs/goal-doc";
import { planGoalProgress } from "./goal-progress";

const now = 1_700_000_000_200;
const goal: GoalDoc = {
  title: "Ship the Firestore port",
  progressPercent: 40,
  status: "active",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_100,
};

describe("planGoalProgress", () => {
  test("40 to 60 changes progress and update time only", () => {
    const original = { ...goal };

    expect(planGoalProgress(goal, 60, now)).toEqual({
      kind: "patch",
      patch: { progressPercent: 60, updatedAt: now },
      fields: ["progressPercent", "updatedAt"],
    });
    expect(goal).toEqual(original);
  });

  test("60 to 100 completes an active goal", () => {
    expect(planGoalProgress({ ...goal, progressPercent: 60 }, 100, now)).toEqual({
      kind: "patch",
      patch: { progressPercent: 100, updatedAt: now, status: "completed" },
      fields: ["progressPercent", "status", "updatedAt"],
    });
  });

  test("moving a completed goal to 80 makes it active", () => {
    expect(
      planGoalProgress({ ...goal, progressPercent: 100, status: "completed" }, 80, now)
    ).toEqual({
      kind: "patch",
      patch: { progressPercent: 80, updatedAt: now, status: "active" },
      fields: ["progressPercent", "status", "updatedAt"],
    });
  });

  test("progress is rounded and clamped", () => {
    expect(planGoalProgress(goal, 140, now)).toMatchObject({
      kind: "patch",
      patch: { progressPercent: 100 },
    });
    expect(planGoalProgress(goal, 59.6, now)).toEqual({
      kind: "patch",
      patch: { progressPercent: 60, updatedAt: now },
      fields: ["progressPercent", "updatedAt"],
    });
  });

  test("the same percent is unchanged", () => {
    expect(planGoalProgress(goal, 40, now)).toEqual({ kind: "unchanged" });
  });

  test("deleted, archived, and non-finite progress are refused", () => {
    expect(planGoalProgress({ ...goal, deletedAt: now }, 60, now)).toEqual({
      kind: "refused",
      reason: "goal is deleted",
    });
    expect(planGoalProgress({ ...goal, status: "archived" }, 60, now)).toEqual({
      kind: "refused",
      reason: "goal is archived",
    });
    expect(planGoalProgress(goal, Number.NaN, now)).toEqual({
      kind: "refused",
      reason: "percent must be a number",
    });
  });
});
