import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseGoalList } from "./use-goal-list";

describe("useGoalList", () => {
  test("passes the args to goals:list and returns its result unchanged", () => {
    const args = {};
    const result: never[] = [];
    const useGoalList = makeUseGoalList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("goals:list");
      expect(receivedArgs).toBe(args);
      return result;
    });

    expect(useGoalList(args)).toBe(result);
  });

  test("passes skip through and returns undefined", () => {
    const useGoalList = makeUseGoalList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("goals:list");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useGoalList("skip")).toBeUndefined();
  });
});
