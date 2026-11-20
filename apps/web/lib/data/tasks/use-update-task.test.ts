import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { makeUseUpdateTask } from "./use-update-task";

test("calls useMutation once with tasks.update and returns its mutation unchanged", () => {
  const markerMutation = Object.assign(async ({ taskId }: { taskId: Id<"tasks"> }) => taskId, {
    withOptimisticUpdate() {
      throw new Error("Unexpected optimistic update");
    },
  });
  const calls: string[] = [];
  const useUpdateTask = makeUseUpdateTask((reference, ...args) => {
    calls.push(getFunctionName(reference));
    expect(args).toHaveLength(0);
    return markerMutation;
  });

  expect(useUpdateTask()).toBe(markerMutation);
  expect(calls).toEqual(["tasks:update"]);
});

test("TodayEnergyRecommendations uses the update-task seam", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/today/TodayEnergyRecommendations.tsx"),
    "utf8"
  );

  expect(source).toContain("useUpdateTask()");
  expect(source).not.toContain("useMutation(api.tasks.update)");
});
