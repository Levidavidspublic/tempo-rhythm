import { afterAll, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// bun's mock.module is process-wide. Load the real modules first and restore them after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

const mutationCalls: unknown[] = [];
const marker = async () => "created";

mock.module("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    mutationCalls.push(mutation);
    return marker;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { create: "tasks.create" } },
}));

const { useCreateTask } = await import("./use-create-task");

test("useCreateTask calls useMutation with tasks.create and returns its value", () => {
  mutationCalls.length = 0;

  expect(useCreateTask() as unknown).toBe(marker);
  expect(mutationCalls).toEqual(["tasks.create"]);
});

test("TaskViewsScreen creates tasks through useCreateTask", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/tasks/TaskViewsScreen.tsx"),
    "utf8"
  );

  expect(source).toContain("useCreateTask()");
  expect(source).not.toContain("useMutation(api.tasks.create)");
});
