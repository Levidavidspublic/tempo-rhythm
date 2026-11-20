import { afterAll, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";

const realConvexReact = { ...(await import("convex/react")) };

afterAll(() => {
  mock.module("convex/react", () => realConvexReact);
});

const mutation = async () => null;
let receivedFunction: Parameters<typeof getFunctionName>[0] | undefined;

mock.module("convex/react", () => ({
  ...realConvexReact,
  useMutation: (fn: Parameters<typeof getFunctionName>[0]) => {
    receivedFunction = fn;
    return mutation;
  },
}));

const { useToggleTask } = await import("./use-toggle-task");

describe("useToggleTask", () => {
  test("uses tasks.toggleCompletion and returns its mutation unchanged", () => {
    const result = useToggleTask();

    expect(receivedFunction).toBeDefined();
    expect(getFunctionName(receivedFunction!)).toBe("tasks:toggleCompletion");
    expect(result as unknown).toBe(mutation);
  });
});
