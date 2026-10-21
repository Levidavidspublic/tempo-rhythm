import { describe, expect, test } from "bun:test";
import { pickNextBlocks, planProgress } from "./nextBlocks";

type Status = "planned" | "done" | "skipped";

function block(id: string, startMinute: number, durationMinutes: number, status: Status = "planned") {
  return { id, startMinute, durationMinutes, status };
}

describe("pickNextBlocks", () => {
  test("includes the in-progress block and orders by start", () => {
    const blocks = [block("c", 780, 30), block("a", 540, 60), block("b", 600, 30)];
    expect(pickNextBlocks(blocks, 560).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  test("excludes done and skipped blocks, even when in progress", () => {
    const blocks = [block("a", 540, 60, "done"), block("b", 560, 30, "skipped"), block("c", 600, 30)];
    expect(pickNextBlocks(blocks, 570).map((b) => b.id)).toEqual(["c"]);
  });

  test("leaves out planned blocks that already ended", () => {
    const blocks = [block("past", 480, 30), block("edge", 500, 10), block("next", 600, 30)];
    expect(pickNextBlocks(blocks, 510).map((b) => b.id)).toEqual(["next"]);
  });

  test("respects the limit (default 3)", () => {
    const blocks = [0, 1, 2, 3, 4].map((i) => block(`b${i}`, 600 + i * 60, 30));
    expect(pickNextBlocks(blocks, 0)).toHaveLength(3);
    expect(pickNextBlocks(blocks, 0, 2).map((b) => b.id)).toEqual(["b0", "b1"]);
  });

  test("does not mutate its input", () => {
    const blocks = [block("b", 700, 30), block("a", 600, 30)];
    pickNextBlocks(blocks, 0);
    expect(blocks.map((b) => b.id)).toEqual(["b", "a"]);
  });

  test("returns an empty list when nothing is left", () => {
    expect(pickNextBlocks([], 100)).toEqual([]);
    expect(pickNextBlocks([block("a", 60, 30, "done")], 100)).toEqual([]);
  });
});

describe("planProgress", () => {
  test("counts done top tasks", () => {
    expect(
      planProgress([{ status: "done" }, { status: "todo" }, { status: "in_progress" }])
    ).toEqual({ done: 1, total: 3 });
  });

  test("handles no tasks", () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0 });
  });
});
