import { describe, expect, mock, test } from "bun:test";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

const calls: Array<{ functionName: string; args: unknown }> = [];
const result: FunctionReturnType<typeof api.tasks.list> = [];

mock.module("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    calls.push({ functionName: getFunctionName(reference), args });
    return result;
  },
}));

const { useTaskList } = await import("./use-task-list");

describe("useTaskList", () => {
  test("calls tasks:list with the provided arguments and returns its result unchanged", () => {
    calls.length = 0;

    expect(useTaskList({})).toBe(result);
    expect(calls).toEqual([{ functionName: "tasks:list", args: {} }]);
  });

  test("passes skip through unchanged", () => {
    calls.length = 0;

    expect(useTaskList("skip")).toBe(result);
    expect(calls).toEqual([{ functionName: "tasks:list", args: "skip" }]);
  });
});
