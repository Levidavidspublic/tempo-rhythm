import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { makeUseCreateQuickTask } from "./use-create-quick-task";

describe("useCreateQuickTask", () => {
  test("binds tasks.createQuick and returns its mutation unchanged", () => {
    const createQuick = async () => "created-task" as Id<"tasks">;
    const useCreateQuickTask = makeUseCreateQuickTask((reference, ...args) => {
      expect(getFunctionName(reference)).toBe("tasks:createQuick");
      expect(args).toHaveLength(0);
      return createQuick;
    });

    expect(useCreateQuickTask()).toBe(createQuick);
  });
});
