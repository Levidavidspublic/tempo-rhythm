import { describe, expect, test } from "bun:test";
import { pruneTopTasks, toggleTopTask, toLocalDateKey } from "./dayPlanDraft";

describe("toLocalDateKey", () => {
  test("formats local YYYY-MM-DD with zero padding", () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 9, 0))).toBe("2026-01-05");
  });

  test("stays on the local day just before and after midnight", () => {
    expect(toLocalDateKey(new Date(2026, 9, 5, 23, 59, 59, 999))).toBe("2026-10-05");
    expect(toLocalDateKey(new Date(2026, 9, 6, 0, 0, 0, 0))).toBe("2026-10-06");
  });
});

describe("toggleTopTask", () => {
  test("adds up to 3 ids and refuses a 4th", () => {
    let ids: string[] = [];
    for (const id of ["a", "b", "c", "d"]) ids = toggleTopTask(ids, id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  test("toggles an existing id off, freeing a slot", () => {
    const off = toggleTopTask(["a", "b", "c"], "b");
    expect(off).toEqual(["a", "c"]);
    expect(toggleTopTask(off, "d")).toEqual(["a", "c", "d"]);
  });

  test("does not mutate its input", () => {
    const input = ["a"];
    toggleTopTask(input, "b");
    expect(input).toEqual(["a"]);
  });
});

describe("pruneTopTasks", () => {
  test("drops picks that are no longer listed so they free their slot", () => {
    const kept = pruneTopTasks(["a", "b", "c"], new Set(["a", "c", "d"]));
    expect(kept).toEqual(["a", "c"]);
    expect(toggleTopTask(kept, "d")).toEqual(["a", "c", "d"]);
  });

  test("keeps order and does not mutate its input", () => {
    const input = ["c", "a"];
    expect(pruneTopTasks(input, new Set(["a", "c"]))).toEqual(["c", "a"]);
    expect(input).toEqual(["c", "a"]);
  });
});
