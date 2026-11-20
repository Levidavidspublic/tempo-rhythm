"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListDoneInRangeArgs = FunctionArgs<typeof api.tasks.listDoneInRange>;
type ListDoneInRangeResult = FunctionReturnType<typeof api.tasks.listDoneInRange>;

/** Reads the tasks completed in a time range without exposing the screen to the backend call. */
export function useDoneTasksInRange(
  args: ListDoneInRangeArgs | "skip"
): ListDoneInRangeResult | undefined {
  return useQuery(api.tasks.listDoneInRange, args);
}
