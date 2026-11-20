"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type TaskListArgs = FunctionArgs<typeof api.tasks.list>;
type TaskListResult = FunctionReturnType<typeof api.tasks.list> | undefined;

export function useTaskList(args: TaskListArgs | "skip"): TaskListResult {
  return useQuery(api.tasks.list, args);
}
