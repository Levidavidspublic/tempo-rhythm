import { afterAll, describe, expect, mock, test } from "bun:test";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

const realConvexReact = { ...(await import("convex/react")) };
afterAll(() => {
  mock.module("convex/react", () => realConvexReact);
});

let mutationReference: Parameters<typeof getFunctionName>[0] | undefined;
const createQuick = async () =>
  "created-task" as FunctionReturnType<typeof api.tasks.createQuick>;

mock.module("convex/react", () => ({
  ...realConvexReact,
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    mutationReference = reference;
    return createQuick;
  },
}));

const { useCreateQuickTask } = await import("./use-create-quick-task");

describe("useCreateQuickTask", () => {
  test("binds tasks.createQuick and returns its mutation unchanged", () => {
    const mutation = useCreateQuickTask();

    expect(mutationReference).toBeDefined();
    expect(getFunctionName(mutationReference!)).toBe("tasks:createQuick");
    expect(mutation).toBe(createQuick);
  });
});
