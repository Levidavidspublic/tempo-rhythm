import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

const mutationCalls: unknown[] = [];
const markerMutation = async () => ({ undoUntilMs: 123 });

mock.module("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    mutationCalls.push(mutation);
    return markerMutation;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { remove: "tasks.remove" } },
}));

const { api } = await import("@/convex/_generated/api");
const { useRemoveTask } = await import("./use-remove-task");

beforeEach(() => {
  mutationCalls.length = 0;
});

describe("useRemoveTask", () => {
  test("uses tasks.remove and returns the mutation function", () => {
    expect(useRemoveTask() as unknown).toBe(markerMutation);
    expect(mutationCalls).toEqual([api.tasks.remove]);
  });

  test("ChecklistBoard deletes through the hook", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../../components/tasks-checklists/ChecklistBoard.tsx"),
      "utf8",
    );
    expect(source).toContain("useRemoveTask()");
    expect(source).not.toContain("useMutation(api.tasks.remove)");
  });
});
