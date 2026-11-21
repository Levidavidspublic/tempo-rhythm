"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseGoalList(useQueryImpl: typeof useQuery<typeof api.goals.list>) {
  return function useGoalList(args: FunctionArgs<typeof api.goals.list> | "skip") {
    return useQueryImpl(api.goals.list, args);
  };
}

export const useGoalList = makeUseGoalList(useQuery);
