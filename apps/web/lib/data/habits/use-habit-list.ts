"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseHabitList(useQueryImpl: typeof useQuery<typeof api.habits.list>) {
  return function useHabitList(args: FunctionArgs<typeof api.habits.list> | "skip") {
    return useQueryImpl(api.habits.list, args);
  };
}

export const useHabitList = makeUseHabitList(useQuery);
