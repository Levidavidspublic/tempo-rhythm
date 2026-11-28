import { describe, expect, test } from "bun:test";
import { focusMinutes, formatClock, type NextUpTask, nextUpReason, pickNextUp } from "./next-up";

const task = (id: string, over: Partial<NextUpTask> = {}): NextUpTask => ({
  _id: id,
  title: `Task ${id}`,
  status: "todo",
  priority: "medium",
  ...over,
});

describe("pickNextUp", () => {
  test("started first, then important, then the earliest due; done and cancelled never", () => {
    const tasks = [
      task("done", { status: "done", priority: "high" }),
      task("late", { dueAt: 900 }),
      task("early", { dueAt: 100 }),
      task("high", { priority: "high", dueAt: 950 }),
      task("started", { status: "in_progress", priority: "low" }),
      task("gone", { status: "cancelled" }),
    ];
    expect(pickNextUp(tasks, new Set())?._id).toBe("started");
    expect(pickNextUp(tasks, new Set(["started"]))?._id).toBe("high");
    expect(pickNextUp(tasks, new Set(["started", "high"]))?._id).toBe("early");
  });

  test("skipped tasks still show once everything else was skipped; nothing open gives null", () => {
    expect(pickNextUp([task("a")], new Set(["a"]))?._id).toBe("a");
    expect(pickNextUp([task("a", { status: "done" })], new Set())).toBeNull();
  });
});

describe("card details", () => {
  test("reason line", () => {
    expect(nextUpReason(task("a", { status: "in_progress" }))).toBe("next.why.started");
    expect(nextUpReason(task("a", { priority: "high" }))).toBe("next.why.high");
    expect(nextUpReason(task("a"))).toBe("next.why.due");
  });

  test("focus minutes come from the estimate (ms), kept between 5 and 90; 25 otherwise", () => {
    const min = 60_000;
    expect(focusMinutes(task("a"))).toBe(25);
    expect(focusMinutes(task("a", { timeEstimate: 40 * min }))).toBe(40);
    expect(focusMinutes(task("a", { timeEstimate: 2 * min }))).toBe(5);
    expect(focusMinutes(task("a", { timeEstimate: 600 * min }))).toBe(90);
    expect(focusMinutes(task("a", { timeEstimate: 0 }))).toBe(25);
  });

  test("clock", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(61_001)).toBe("01:02");
    expect(formatClock(-5)).toBe("00:00");
  });
});
