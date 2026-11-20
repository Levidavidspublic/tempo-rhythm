import { expect, test } from "bun:test";
import { parseTaskRepeatDoc, type TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";
import { planRepeatSkipDate } from "./task-repeat-skip";

const rule: TaskRepeatDoc = {
  repeatCycle: "DAILY",
  repeatEvery: 1,
  weekdays: [],
  deletedInstanceDates: [],
  skipOverdue: false,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
  createdAt: 100,
  updatedAt: 100,
};

test("plans the first skipped date", () => {
  expect(planRepeatSkipDate(rule, "2026-11-20", 200)).toEqual({
    ok: true,
    alreadySkipped: false,
    patch: { deletedInstanceDates: ["2026-11-20"], updatedAt: 200 },
    changedFields: ["deletedInstanceDates", "updatedAt"],
  });
});

test("keeps the skipped-date list sorted on a second skip", () => {
  const stored = { ...rule, deletedInstanceDates: ["2026-11-20"] };
  const result = planRepeatSkipDate(stored, "2026-11-02", 201);

  expect(result).toMatchObject({
    ok: true,
    alreadySkipped: false,
    patch: { deletedInstanceDates: ["2026-11-02", "2026-11-20"], updatedAt: 201 },
  });
});

test("returns a calm answer when the date is already skipped", () => {
  const stored = { ...rule, deletedInstanceDates: ["2026-11-20"] };
  expect(planRepeatSkipDate(stored, "2026-11-20", 202)).toEqual({
    ok: true,
    alreadySkipped: true,
  });
});

test("refuses a bad calendar date", () => {
  expect(planRepeatSkipDate(rule, "2026-13-01", 200)).toEqual({
    ok: false,
    reason: "bad-date",
  });
});

test("refuses a deleted repeat rule", () => {
  expect(planRepeatSkipDate({ ...rule, deletedAt: 150 }, "2026-11-20", 200)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("does not mutate the stored rule and produces a parseable patched rule", () => {
  const stored = { ...rule, isPaused: true, deletedInstanceDates: ["2026-11-20"] };
  const snapshot = structuredClone(stored);
  const result = planRepeatSkipDate(stored, "2026-11-02", 203);

  expect(stored).toEqual(snapshot);
  expect(result.ok).toBe(true);
  if (!result.ok || result.alreadySkipped) throw new Error("expected a new skip plan");
  expect(result.patch.deletedInstanceDates).not.toBe(stored.deletedInstanceDates);
  expect(parseTaskRepeatDoc({ ...stored, ...result.patch })).toEqual({
    ...stored,
    ...result.patch,
  });
});
