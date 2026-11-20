import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";

const realConvexReact = { ...(await import("convex/react")) };
afterAll(() => mock.module("convex/react", () => realConvexReact));

const calls: Array<[unknown, unknown]> = [];
const result: never[] = [];
mock.module("convex/react", () => ({
  ...realConvexReact,
  useQuery: (query: unknown, args: unknown) => {
    calls.push([query, args]);
    return result;
  },
}));

const { useDoneTasksInRange } = await import("./use-done-tasks-in-range");

describe("useDoneTasksInRange", () => {
  beforeEach(() => calls.splice(0));

  test("passes the range to tasks:listDoneInRange and returns its result unchanged", () => {
    const args = { startMs: 100, endMs: 200 };

    expect(useDoneTasksInRange(args)).toBe(result);
    expect(getFunctionName(calls[0]?.[0] as Parameters<typeof getFunctionName>[0])).toBe(
      "tasks:listDoneInRange",
    );
    expect(calls[0]?.[1]).toBe(args);
  });

  test("passes skip through unchanged", () => {
    useDoneTasksInRange("skip");

    expect(calls[0]?.[1]).toBe("skip");
  });
});
