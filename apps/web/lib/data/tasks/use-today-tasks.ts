"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListTodayArgs = FunctionArgs<typeof api.tasks.listToday>;
type ListTodayResult = FunctionReturnType<typeof api.tasks.listToday>;

export function useTodayTasks(args: ListTodayArgs | "skip"): ListTodayResult | undefined {
  return useQuery(api.tasks.listToday, args);
}
