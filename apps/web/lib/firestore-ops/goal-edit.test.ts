import { expect, test } from "bun:test";
import type { GoalDoc } from "../firestore-docs/goal-doc";
import { planGoalEdit } from "./goal-edit";

const storedGoal = (overrides: Partial<GoalDoc> = {}): GoalDoc => ({
  title: "Learn piano",
  description: "Practice every day",
  targetDate: 2_000,
  progressPercent: 25,
  status: "active",
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
});

test("title change gives a title and updatedAt patch", () => {
  expect(planGoalEdit(storedGoal(), { title: "  Learn guitar  " }, 300)).toEqual({
    kind: "patch",
    patch: { title: "Learn guitar", updatedAt: 300 },
    fields: ["title", "updatedAt"],
    clearFields: [],
  });
});

test("a 200-character title is cut to 120 characters", () => {
  const plan = planGoalEdit(storedGoal(), { title: "x".repeat(200) }, 300);
  expect(plan.kind).toBe("patch");
  if (plan.kind === "patch") expect(plan.patch.title).toHaveLength(120);
});

test("an empty title is refused", () => {
  expect(planGoalEdit(storedGoal(), { title: "   " }, 300)).toEqual({
    kind: "refused",
    reason: "title must not be empty",
  });
});

test("a deleted goal is refused", () => {
  expect(planGoalEdit(storedGoal({ deletedAt: 250 }), { title: "New" }, 300)).toEqual({
    kind: "refused",
    reason: "goal is deleted",
  });
});

test("an archived goal is refused", () => {
  expect(planGoalEdit(storedGoal({ status: "archived" }), { title: "New" }, 300)).toEqual({
    kind: "refused",
    reason: "goal is archived",
  });
});

test("clearing targetDate lists it without putting undefined in the patch", () => {
  const plan = planGoalEdit(storedGoal(), { targetDate: null }, 300);
  expect(plan).toEqual({
    kind: "patch",
    patch: { updatedAt: 300 },
    fields: ["targetDate", "updatedAt"],
    clearFields: ["targetDate"],
  });
  if (plan.kind === "patch") expect(Object.values(plan.patch)).not.toContain(undefined);
});

test("the same values give unchanged", () => {
  expect(
    planGoalEdit(
      storedGoal(),
      { title: "Learn piano", description: "Practice every day", targetDate: 2_000 },
      300,
    ),
  ).toEqual({ kind: "unchanged" });
});

test("the stored object is not mutated", () => {
  const stored = storedGoal();
  const before = structuredClone(stored);
  planGoalEdit(stored, { description: "", targetDate: null }, 300);
  expect(stored).toEqual(before);
});
