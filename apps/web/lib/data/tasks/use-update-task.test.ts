import { afterAll, beforeEach, expect, mock, test } from "bun:test";
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

const useMutationCalls: unknown[] = [];
const markerMutation = async () => null;

mock.module("convex/react", () => ({
  useMutation: (mutation: unknown) => {
    useMutationCalls.push(mutation);
    return markerMutation;
  },
}));
mock.module("@/convex/_generated/api", () => ({
  api: { tasks: { update: "tasks.update" } },
}));

const { useUpdateTask } = await import("./use-update-task");

beforeEach(() => {
  useMutationCalls.length = 0;
});

test("calls useMutation once with tasks.update and returns its mutation unchanged", () => {
  const mutation: unknown = useUpdateTask();
  expect(mutation).toBe(markerMutation);
  expect(useMutationCalls).toEqual(["tasks.update"]);
});

test("TodayEnergyRecommendations uses the update-task seam", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/today/TodayEnergyRecommendations.tsx"),
    "utf8",
  );

  expect(source).toContain("useUpdateTask()");
  expect(source).not.toContain("useMutation(api.tasks.update)");
});
