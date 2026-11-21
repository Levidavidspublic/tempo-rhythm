import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseTasksDueInRange } from "./use-tasks-due-in-range";

describe("useTasksDueInRange", () => {
  test("passes the range to tasks:listDueInRange and returns its result unchanged", () => {
    const args = { startMs: 100, endMs: 200 };
    const result: never[] = [];
    const useTasksDueInRange = makeUseTasksDueInRange((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:listDueInRange");
      expect(receivedArgs).toBe(args);
      return result;
    });

    expect(useTasksDueInRange(args)).toBe(result);
  });

  test("passes skip through unchanged and returns undefined", () => {
    expect.assertions(3);
    const useTasksDueInRange = makeUseTasksDueInRange((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:listDueInRange");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useTasksDueInRange("skip")).toBeUndefined();
  });
});
