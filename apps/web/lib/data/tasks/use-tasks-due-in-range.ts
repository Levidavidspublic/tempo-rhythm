"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListDueInRangeArgs = FunctionArgs<typeof api.tasks.listDueInRange>;
type ListDueInRangeResult = FunctionReturnType<typeof api.tasks.listDueInRange>;

export function makeUseTasksDueInRange(
  useQueryImpl: typeof useQuery<typeof api.tasks.listDueInRange>
) {
  return function useTasksDueInRange(
    args: ListDueInRangeArgs | "skip"
  ): ListDueInRangeResult | undefined {
    return useQueryImpl(api.tasks.listDueInRange, args);
  };
}

/** Reads tasks due in a time range without exposing the screen to the backend call. */
export const useTasksDueInRange = makeUseTasksDueInRange(useQuery);
