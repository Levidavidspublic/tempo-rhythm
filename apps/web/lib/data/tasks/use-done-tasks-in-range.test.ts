import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { makeUseDoneTasksInRange } from "./use-done-tasks-in-range";

describe("useDoneTasksInRange", () => {
  test("passes the range to tasks:listDoneInRange and returns its result unchanged", () => {
    const args = { startMs: 100, endMs: 200 };
    const result: never[] = [];
    const useDoneTasksInRange = makeUseDoneTasksInRange((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:listDoneInRange");
      expect(receivedArgs).toBe(args);
      return result;
    });

    expect(useDoneTasksInRange(args)).toBe(result);
  });

  test("passes skip through unchanged", () => {
    expect.assertions(3);
    const useDoneTasksInRange = makeUseDoneTasksInRange((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:listDoneInRange");
      expect(receivedArgs).toBe("skip");
      return undefined;
    });

    expect(useDoneTasksInRange("skip")).toBeUndefined();
  });
});
