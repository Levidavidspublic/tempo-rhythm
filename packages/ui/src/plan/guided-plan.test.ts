import { describe, expect, test } from "bun:test";
import {
  cleanSteps,
  formatStepClock,
  type GuidedStep,
  groupSteps,
  guidedEditReducer,
  guidedStepBlock,
  guidedStepSpecs,
  restack,
  stepError,
  summarizeGuidedPlan,
  validateGuidedPlan,
} from "./guided-plan";
import { formatUndoLeft } from "./useUndoCountdown";

const W1 = { groupId: "2026-10-12", groupLabel: "Week of 12 Oct" };
const W2 = { groupId: "2026-10-19", groupLabel: "Week of 19 Oct" };

const steps: GuidedStep[] = [
  { id: "a", title: "Learn: Algebra", minutes: 45, kind: "learn", date: "2026-10-16", startMinute: 1020, ...W1 },
  { id: "b", title: "Learn: Geometry", minutes: 45, kind: "learn", date: "2026-10-16", startMinute: 1065, ...W1 },
  { id: "c", title: "Review: Algebra", minutes: 30, kind: "review", date: "2026-10-19", startMinute: 1020, ...W2 },
  { id: "d", title: "Practice test", minutes: 60, kind: "practice", date: "2026-10-20", startMinute: 1020, ...W2 },
];

const ids = (list: readonly GuidedStep[]) => list.map((s) => s.id);

describe("guidedEditReducer", () => {
  test("rename and setMinutes change one step; times on that day follow the new length", () => {
    const renamed = guidedEditReducer(steps, { type: "rename", id: "a", title: "Algebra basics" });
    expect(renamed[0]?.title).toBe("Algebra basics");
    expect(renamed[1]).toEqual(steps[1] as GuidedStep);

    const longer = guidedEditReducer(steps, { type: "setMinutes", id: "a", minutes: 60 });
    expect(longer[0]?.minutes).toBe(60);
    expect(longer[1]?.startMinute).toBe(1020 + 60);
    // Another date keeps its own start.
    expect(longer[2]?.startMinute).toBe(1020);
  });

  test("move swaps contents and keeps each slot (date, time, week) where it was", () => {
    const moved = guidedEditReducer(steps, { type: "move", id: "c", by: -1 });
    expect(ids(moved)).toEqual(["a", "c", "b", "d"]);
    // c takes b's slot: Friday, right after a, in week 1.
    expect(moved[1]).toMatchObject({ id: "c", date: "2026-10-16", startMinute: 1065, groupId: W1.groupId });
    // b drops into c's slot in week 2.
    expect(moved[2]).toMatchObject({ id: "b", date: "2026-10-19", startMinute: 1020, groupId: W2.groupId });
  });

  test("moves past either end, unknown ids and removing the unknown change nothing", () => {
    expect(ids(guidedEditReducer(steps, { type: "move", id: "a", by: -1 }))).toEqual(ids(steps));
    expect(ids(guidedEditReducer(steps, { type: "move", id: "d", by: 1 }))).toEqual(ids(steps));
    expect(ids(guidedEditReducer(steps, { type: "move", id: "zz", by: 1 }))).toEqual(ids(steps));
    expect(ids(guidedEditReducer(steps, { type: "remove", id: "zz" }))).toEqual(ids(steps));
  });

  test("remove drops a step and the rest of that day moves up to the day's start", () => {
    const removed = guidedEditReducer(steps, { type: "remove", id: "a" });
    expect(ids(removed)).toEqual(["b", "c", "d"]);
    expect(removed[0]?.startMinute).toBe(1020);
    // Removing the last step of a day leaves the next day alone.
    expect(guidedEditReducer(steps, { type: "remove", id: "b" })[1]?.startMinute).toBe(1020);
    // The first left on a day keeps its slot's time; only followers restack.
    const restacked = restack([steps[0] as GuidedStep, { ...(steps[1] as GuidedStep), startMinute: 5 }]);
    expect(restacked[1]?.startMinute).toBe(1065);
  });

  test("restack never passes 23:59 and ignores half-typed lengths", () => {
    const late = restack([
      { id: "x", title: "x", minutes: 200, kind: "task", date: "2026-10-16", startMinute: 1380 },
      { id: "y", title: "y", minutes: 10, kind: "task", date: "2026-10-16", startMinute: 0 },
    ]);
    expect(late[1]?.startMinute).toBe(1439);
    const nan = restack([
      { id: "x", title: "x", minutes: Number.NaN, kind: "task", date: "2026-10-16", startMinute: 600 },
      { id: "y", title: "y", minutes: 10, kind: "task", date: "2026-10-16", startMinute: 0 },
    ]);
    expect(nan[1]?.startMinute).toBe(600);
  });
});

describe("validation", () => {
  test("names must not be blank or too long, lengths stay in 1 to 720 whole minutes", () => {
    const base = steps[0] as GuidedStep;
    expect(stepError(base)).toBeNull();
    expect(stepError({ ...base, title: "   " })).toBe("titleEmpty");
    expect(stepError({ ...base, title: "x".repeat(201) })).toBe("titleLong");
    for (const minutes of [Number.NaN, 0, -5, 721, 12.5]) {
      expect(stepError({ ...base, minutes })).toBe("minutesRange");
    }
    const result = validateGuidedPlan([{ ...base, title: "" }, steps[1] as GuidedStep]);
    expect(result).toEqual({ ok: false, errors: { a: "titleEmpty" }, tooFew: false });
    expect(validateGuidedPlan([])).toEqual({ ok: false, errors: {}, tooFew: true });
    expect(validateGuidedPlan(steps).ok).toBe(true);
  });

  test("cleanSteps trims titles for Accept", () => {
    expect(cleanSteps([{ ...(steps[0] as GuidedStep), title: "  Algebra  " }])[0]?.title).toBe("Algebra");
  });
});

describe("grouping and summary", () => {
  test("neighbouring steps with one group id form one group, in order", () => {
    const groups = groupSteps(steps);
    expect(groups.map((g) => [g.id, g.label, ids(g.steps)])).toEqual([
      [W1.groupId, W1.groupLabel, ["a", "b"]],
      [W2.groupId, W2.groupLabel, ["c", "d"]],
    ]);
    const plain = groupSteps(steps.map(({ groupId: _g, groupLabel: _l, ...s }) => s));
    expect(plain).toHaveLength(1);
    expect(plain[0]?.label).toBeNull();
  });

  test("summary counts steps, distinct days and the time in hours and minutes", () => {
    expect(summarizeGuidedPlan(steps)).toEqual({ steps: 4, days: 3, totalMinutes: 180, hours: 3, minutes: 0 });
    expect(summarizeGuidedPlan([{ ...(steps[0] as GuidedStep), minutes: Number.NaN }])).toMatchObject({
      totalMinutes: 0,
      days: 1,
    });
  });

  test("clock and undo countdown formats", () => {
    expect(formatStepClock(1020)).toBe("17:00");
    expect(formatStepClock(65)).toBe("01:05");
    expect(formatUndoLeft(5 * 60_000)).toBe("5:00");
    expect(formatUndoLeft(61_000)).toBe("1:01");
    expect(formatUndoLeft(-10)).toBe("0:00");
  });
});

describe("json-render bridge", () => {
  test("each step becomes a display-only TaskBlock; To do / Doing / Done map to later / now / done", () => {
    const specs = guidedStepSpecs(steps, { a: "done", b: "doing" });
    const elements = specs.map((spec) => spec.elements[spec.root]);
    expect(elements.map((e) => e?.type)).toEqual(["TaskBlock", "TaskBlock", "TaskBlock", "TaskBlock"]);
    expect(elements.map((e) => (e?.props as { status: string }).status)).toEqual([
      "done",
      "now",
      "later",
      "later",
    ]);
    expect(elements.map((e) => (e?.props as { durationMin: number }).durationMin)).toEqual([45, 45, 30, 60]);
    for (const e of elements) expect(e && "on" in e).toBe(false);
    expect(JSON.stringify(specs)).not.toContain("blk_");
  });

  test("a half-typed step still draws as a TaskBlock", () => {
    const block = guidedStepBlock({ id: "z", title: "", minutes: Number.NaN, kind: "task" }, 0, "todo");
    expect(block.data.durationMin).toBe(1);
    const [spec] = guidedStepSpecs([{ id: "z", title: "", minutes: 0, kind: "task" }]);
    expect(spec?.elements[spec.root]?.type).toBe("TaskBlock");
  });
});
