import { describe, expect, test } from "bun:test";
import { type FunctionReturnType, getFunctionName } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { makeUseTaskList } from "./use-task-list";

describe("useTaskList", () => {
  test("calls tasks:list with the provided arguments and returns its result unchanged", () => {
    expect.assertions(3);
    const args = {};
    const result: FunctionReturnType<typeof api.tasks.list> = [];
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe(args);
      return result;
    });

    expect(useTaskList(args)).toBe(result);
  });

  test("passes skip through unchanged", () => {
    expect.assertions(3);
    const result: FunctionReturnType<typeof api.tasks.list> = [];
    const useTaskList = makeUseTaskList((reference, receivedArgs) => {
      expect(getFunctionName(reference)).toBe("tasks:list");
      expect(receivedArgs).toBe("skip");
      return result;
    });

    expect(useTaskList("skip")).toBe(result);
  });
});
