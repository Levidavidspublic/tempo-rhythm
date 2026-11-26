import { describe, expect, test } from "bun:test";
import { checkedHabitIds, localDateKey } from "./checkedState";

describe("localDateKey", () => {
  test("uses the local calendar day just before and after midnight", () => {
    const beforeMidnight = new Date(2025, 11, 31, 23, 59, 59, 999);
    const afterMidnight = new Date(2026, 0, 1, 0, 0, 0, 0);

    expect(localDateKey(beforeMidnight)).toBe("2025-12-31");
    expect(localDateKey(afterMidnight)).toBe("2026-01-01");
  });
});

describe("checkedHabitIds", () => {
  test("returns an empty set for an empty list", () => {
    expect(checkedHabitIds([]).size).toBe(0);
  });

  test("collapses duplicate habit ids", () => {
    const ids = checkedHabitIds([
      { habitId: "habit-a" },
      { habitId: "habit-a" },
      { habitId: "habit-b" },
    ]);

    expect(ids.size).toBe(2);
    expect(ids.has("habit-a")).toBe(true);
    expect(ids.has("habit-b")).toBe(true);
  });
});
