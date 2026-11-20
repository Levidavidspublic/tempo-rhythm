import { describe, expect, test } from "bun:test";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { makeUseToggleTask } from "./use-toggle-task";

describe("useToggleTask", () => {
  test("uses tasks.toggleCompletion and returns its mutation unchanged", () => {
    const toggleCompletion = async ({ taskId }: { taskId: Id<"tasks"> }) => ({
      taskId,
      status: "done" as const,
    });
    const useToggleTask = makeUseToggleTask((reference, ...args) => {
      expect(getFunctionName(reference)).toBe("tasks:toggleCompletion");
      expect(args).toHaveLength(0);
      return toggleCompletion;
    });

    expect(useToggleTask()).toBe(toggleCompletion);
  });
});
