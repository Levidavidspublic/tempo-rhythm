import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { makeUseSaveReviewedMemories } from "./use-save-reviewed-memories";

test("calls useMutation once with memoryImport.saveReviewed and returns its mutation unchanged", () => {
  const markerMutation = Object.assign(async () => ({ added: 0, skipped: 0, memoryIds: [] }), {
    withOptimisticUpdate() {
      throw new Error("Unexpected optimistic update");
    },
  });
  const calls: string[] = [];
  const useSaveReviewedMemories = makeUseSaveReviewedMemories((reference) => {
    calls.push(getFunctionName(reference));
    return markerMutation;
  });

  expect(useSaveReviewedMemories()).toBe(markerMutation);
  expect(calls).toEqual(["memoryImport:saveReviewed"]);
});

test("MemoryImportScreen uses the save-reviewed-memories hook", () => {
  const source = readFileSync(
    join(import.meta.dir, "../../../components/memory/MemoryImportScreen.tsx"),
    "utf8"
  );

  expect(source).toContain(
    'import { useSaveReviewedMemories } from "@/lib/data/memory-import/use-save-reviewed-memories";'
  );
  expect(source).toContain("const saveReviewed = useSaveReviewedMemories();");
  expect(source).not.toContain("api.memoryImport.saveReviewed");
});
