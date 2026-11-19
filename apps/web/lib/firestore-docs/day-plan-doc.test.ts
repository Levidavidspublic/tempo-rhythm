import { describe, expect, test } from "bun:test";
import { checkDayPlanDoc, dayPlanDocId, type DayPlanDoc } from "./day-plan-doc";

const draft: DayPlanDoc = {
  localDate: "2026-11-19",
  intention: "Finish the important work",
  topTaskIds: ["task-1", "task-2", "task-3"],
  energy: "medium",
  status: "draft",
  createdAt: 1,
  updatedAt: 2,
};

describe("day plan documents", () => {
  test("valid draft passes", () => {
    expect(checkDayPlanDoc(draft)).toEqual({ ok: true, doc: draft });
  });

  test("four top tasks are rejected", () => {
    expect(
      checkDayPlanDoc({ ...draft, topTaskIds: ["a", "b", "c", "d"] }),
    ).toEqual({
      ok: false,
      reason: "topTaskIds has more than 3 tasks",
    });
  });

  test("a duplicate task id is rejected", () => {
    expect(checkDayPlanDoc({ ...draft, topTaskIds: ["a", "a"] })).toEqual({
      ok: false,
      reason: "topTaskIds contains a duplicate id",
    });
  });

  test("committed without committedAt is rejected", () => {
    expect(checkDayPlanDoc({ ...draft, status: "committed" })).toEqual({
      ok: false,
      reason: "committed status requires committedAt",
    });
  });

  test("unknown userId key is rejected", () => {
    expect(checkDayPlanDoc({ ...draft, userId: "user-1" })).toEqual({
      ok: false,
      reason: "unknown key: userId",
    });
  });

  test("the local date is the document id", () => {
    expect(dayPlanDocId("2026-11-19")).toBe("2026-11-19");
  });
});
