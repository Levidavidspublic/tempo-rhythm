import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Id } from "@/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { makeUseCreateTask } from "./use-create-task";

test("useCreateTask uses tasks.create and returns its mutation unchanged", () => {
  const createTask = Object.assign(async () => "created" as Id<"tasks">, {
    withOptimisticUpdate: () => {
      throw new Error("Unexpected optimistic update");
    },
  });
  const mutationCalls: unknown[][] = [];
  const useCreateTask = makeUseCreateTask((reference, ...args) => {
    mutationCalls.push([getFunctionName(reference), ...args]);
    return createTask;
  });

  expect(useCreateTask()).toBe(createTask);
  expect(mutationCalls).toEqual([["tasks:create"]]);
});

test("TaskViewsScreen creates tasks through useCreateTask", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/tasks/TaskViewsScreen.tsx"),
    "utf8"
  );

  expect(source).toContain("useCreateTask()");
  expect(source).not.toContain("useMutation(api.tasks.create)");
});
