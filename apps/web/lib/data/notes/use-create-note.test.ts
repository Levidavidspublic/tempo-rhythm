import { expect, test } from "bun:test";
import type { Id } from "@/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { makeUseCreateNote } from "./use-create-note";

function fakeCreateNote() {
  return Object.assign(async () => "created" as Id<"notes">, {
    withOptimisticUpdate: () => {
      throw new Error("Unexpected optimistic update");
    },
  });
}

test("useCreateNote calls the mutation hook once with notes.create", () => {
  const mutationCalls: unknown[][] = [];
  const useCreateNote = makeUseCreateNote((reference, ...args) => {
    mutationCalls.push([getFunctionName(reference), ...args]);
    return fakeCreateNote();
  });

  useCreateNote();

  expect(mutationCalls).toEqual([["notes:create"]]);
});

test("useCreateNote returns the mutation unchanged", () => {
  const createNote = fakeCreateNote();
  const useCreateNote = makeUseCreateNote(() => createNote);

  expect(useCreateNote()).toBe(createNote);
});
