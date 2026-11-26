import { describe, expect, test } from "bun:test";
import { parseTaskRepeatDoc } from "../firestore-docs/task-repeat-doc";
import { planRepeatPause } from "./task-repeat-pause";

const rule = parseTaskRepeatDoc({
  repeatCycle: "WEEKLY",
  repeatEvery: 1,
  weekdays: [1, 3],
  deletedInstanceDates: [],
  skipOverdue: false,
  waitForCompletion: false,
  repeatFromCompletionDate: false,
  isPaused: false,
  createdAt: 100,
  updatedAt: 100,
});

describe("planRepeatPause", () => {
  test("pauses an active rule", () => {
    const before = structuredClone(rule);

    expect(planRepeatPause(rule, "pause", 200)).toEqual({
      ok: true,
      changed: true,
      isPaused: true,
      patch: { isPaused: true, updatedAt: 200 },
      changedFields: ["isPaused", "updatedAt"],
    });
    expect(rule).toEqual(before);
  });

  test("resumes a paused rule", () => {
    expect(planRepeatPause({ ...rule, isPaused: true }, "resume", 300)).toEqual({
      ok: true,
      changed: true,
      isPaused: false,
      patch: { isPaused: false, updatedAt: 300 },
      changedFields: ["isPaused", "updatedAt"],
    });
  });

  test("does not change an already paused rule", () => {
    expect(planRepeatPause({ ...rule, isPaused: true }, "pause", 400)).toEqual({
      ok: true,
      changed: false,
      isPaused: true,
      patch: {},
      changedFields: [],
    });
  });

  test("refuses a deleted rule", () => {
    expect(planRepeatPause({ ...rule, deletedAt: 150 }, "pause", 200)).toEqual({
      ok: false,
      reason: "deleted",
    });
  });

  test("refuses a NaN time", () => {
    expect(planRepeatPause(rule, "pause", Number.NaN)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  });

  test("refuses an unknown want", () => {
    expect(planRepeatPause(rule, "stop" as "pause", 200)).toEqual({
      ok: false,
      reason: "bad-want",
    });
  });
});
