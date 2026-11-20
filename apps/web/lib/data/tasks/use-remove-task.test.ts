import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { makeUseRemoveTask } from "./use-remove-task";

describe("useRemoveTask", () => {
  test("uses tasks.remove and returns its mutation unchanged", () => {
    const removeTask = Object.assign(async () => ({ success: true, undoUntilMs: 123 }), {
      withOptimisticUpdate() {
        throw new Error("Unexpected optimistic update");
      },
    });
    let mutationCalls = 0;
    const useRemoveTask = makeUseRemoveTask((reference, ...args) => {
      mutationCalls += 1;
      expect(getFunctionName(reference)).toBe("tasks:remove");
      expect(args).toHaveLength(0);
      return removeTask;
    });

    expect(useRemoveTask()).toBe(removeTask);
    expect(mutationCalls).toBe(1);
  });

  test("ChecklistBoard deletes through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/tasks-checklists/ChecklistBoard.tsx"),
      "utf8"
    );
    expect(source).toContain("useRemoveTask()");
    expect(source).not.toContain("useMutation(api.tasks.remove)");
  });
});
