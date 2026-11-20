"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListDoneInRangeArgs = FunctionArgs<typeof api.tasks.listDoneInRange>;
type ListDoneInRangeResult = FunctionReturnType<typeof api.tasks.listDoneInRange>;

export function makeUseDoneTasksInRange(
  useQueryImpl: typeof useQuery<typeof api.tasks.listDoneInRange>
) {
  return function useDoneTasksInRange(
    args: ListDoneInRangeArgs | "skip"
  ): ListDoneInRangeResult | undefined {
    return useQueryImpl(api.tasks.listDoneInRange, args);
  };
}

/** Reads the tasks completed in a time range without exposing the screen to the backend call. */
export const useDoneTasksInRange = makeUseDoneTasksInRange(useQuery);
