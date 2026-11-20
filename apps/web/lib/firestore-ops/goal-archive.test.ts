import { expect, test } from "bun:test";
import type { GoalDoc } from "../firestore-docs/goal-doc";
import { planGoalArchive } from "./goal-archive";

const NOW = 2_000;

function goal(overrides: Partial<GoalDoc> = {}): GoalDoc {
  return {
    title: "Ship the feature",
    progressPercent: 40,
    status: "active",
    createdAt: 1_000,
    updatedAt: 1_500,
    ...overrides,
  };
}

test("archives an active goal", () => {
  expect(planGoalArchive(goal(), "archive", NOW)).toEqual({
    ok: true,
    changed: true,
    status: "archived",
    patch: { status: "archived", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
  });
});

test("archives a completed goal", () => {
  expect(
    planGoalArchive(goal({ status: "completed", progressPercent: 100 }), "archive", NOW)
  ).toEqual({
    ok: true,
    changed: true,
    status: "archived",
    patch: { status: "archived", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
  });
});

test("does not change an already archived goal", () => {
  expect(planGoalArchive(goal({ status: "archived" }), "archive", NOW)).toEqual({
    ok: true,
    changed: false,
    status: "archived",
    patch: {},
    changedFields: [],
  });
});

test("restores a goal at 40 percent as active", () => {
  expect(planGoalArchive(goal({ status: "archived" }), "restore", NOW)).toEqual({
    ok: true,
    changed: true,
    status: "active",
    patch: { status: "active", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
  });
});

test("restores a goal at 100 percent as completed", () => {
  expect(
    planGoalArchive(goal({ status: "archived", progressPercent: 100 }), "restore", NOW)
  ).toEqual({
    ok: true,
    changed: true,
    status: "completed",
    patch: { status: "completed", updatedAt: NOW },
    changedFields: ["status", "updatedAt"],
  });
});

test("does not change a goal that is not archived when restoring", () => {
  expect(planGoalArchive(goal({ status: "completed" }), "restore", NOW)).toEqual({
    ok: true,
    changed: false,
    status: "completed",
    patch: {},
    changedFields: [],
  });
});

test("refuses deleted goals, bad times, and bad actions", () => {
  expect(planGoalArchive(goal({ deletedAt: 1_900 }), "archive", NOW)).toEqual({
    ok: false,
    reason: "deleted",
  });
  expect(planGoalArchive(goal(), "archive", Number.NaN)).toEqual({
    ok: false,
    reason: "bad-time",
  });
  expect(planGoalArchive(goal(), "invalid" as "archive", NOW)).toEqual({
    ok: false,
    reason: "bad-action",
  });
});
