import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseHabitList } from "./use-habit-list";

describe("useHabitList", () => {
  test("passes the args to habits:list and returns its result unchanged", () => {
    const args = {};
    const result: never[] = [];
    const useHabitList = makeUseHabitList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("habits:list");
      expect(receivedArgs).toBe(args);
      return result;
    });

    expect(useHabitList(args)).toBe(result);
  });

  test("passes skip through and returns undefined", () => {
    const useHabitList = makeUseHabitList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("habits:list");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useHabitList("skip")).toBeUndefined();
  });
});
