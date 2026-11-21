import { expect, test } from "bun:test";
import type { Id } from "@/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { makeUseCreateRepeatCfg } from "./use-create-repeat-cfg";

function fakeMutation() {
  return Object.assign(async () => "repeat-config" as Id<"taskRepeatCfgs">, {
    withOptimisticUpdate() {
      throw new Error("Unexpected optimistic update");
    },
  });
}

test("passes tasks.createRepeatCfg to useMutation", () => {
  const names: string[] = [];
  const useCreateRepeatCfg = makeUseCreateRepeatCfg((reference) => {
    names.push(getFunctionName(reference));
    return fakeMutation();
  });

  useCreateRepeatCfg();

  expect(names).toEqual(["tasks:createRepeatCfg"]);
});

test("returns the mutation from useMutation unchanged", () => {
  const mutation = fakeMutation();
  const useCreateRepeatCfg = makeUseCreateRepeatCfg(() => mutation);

  expect(useCreateRepeatCfg()).toBe(mutation);
});
