"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type TaskListArgs = FunctionArgs<typeof api.tasks.list>;
type TaskListResult = FunctionReturnType<typeof api.tasks.list> | undefined;

export function makeUseTaskList(
  useQueryImpl: typeof useQuery<typeof api.tasks.list>
) {
  return function useTaskList(args: TaskListArgs | "skip"): TaskListResult {
    return useQueryImpl(api.tasks.list, args);
  };
}

export const useTaskList = makeUseTaskList(useQuery);
