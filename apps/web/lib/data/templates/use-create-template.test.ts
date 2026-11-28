import { expect, test } from "bun:test";
import type { Id } from "@/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { makeUseCreateTemplate } from "./use-create-template";

const createTemplate = Object.assign(async () => "template-id" as Id<"templates">, {
  withOptimisticUpdate() {
    throw new Error("Unexpected optimistic update");
  },
});

test("useCreateTemplate calls the mutation hook once with templates.create", () => {
  const mutationCalls: unknown[][] = [];
  const useCreateTemplate = makeUseCreateTemplate((reference, ...args) => {
    mutationCalls.push([getFunctionName(reference), ...args]);
    return createTemplate;
  });

  useCreateTemplate();

  expect(mutationCalls).toEqual([["templates:create"]]);
});

test("useCreateTemplate returns the mutation unchanged", () => {
  const useCreateTemplate = makeUseCreateTemplate(() => createTemplate);

  expect(useCreateTemplate()).toBe(createTemplate);
});
