import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { makeUseCreateTimeBlock } from "./use-create-time-block";

test("calls useMutation once with timeBlocks.create and returns its mutation unchanged", () => {
  const markerMutation = Object.assign(async () => null as unknown as Id<"timeBlocks">, {
    withOptimisticUpdate() {
      throw new Error("Unexpected optimistic update");
    },
  });
  const calls: string[] = [];
  const useCreateTimeBlock = makeUseCreateTimeBlock((reference, ...args) => {
    calls.push(getFunctionName(reference));
    expect(args).toHaveLength(0);
    return markerMutation;
  });

  expect(useCreateTimeBlock()).toBe(markerMutation);
  expect(calls).toEqual(["timeBlocks:create"]);
});

test("TimeBlockDialog uses the create-time-block seam", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/time-block-dialog/TimeBlockDialog.tsx"),
    "utf8"
  );

  expect(source).toContain("useCreateTimeBlock()");
  expect(source).not.toContain("useMutation(api.timeBlocks.create)");
});
