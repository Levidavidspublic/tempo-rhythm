"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Args = FunctionArgs<typeof api.dayPlans.getForDate>;
type Result = FunctionReturnType<typeof api.dayPlans.getForDate>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseDayPlanForDate(useQueryImpl: typeof useQuery<typeof api.dayPlans.getForDate>) {
  return function useDayPlanForDate(args: Args | "skip"): Result | undefined {
    return useQueryImpl(api.dayPlans.getForDate, args);
  };
}

export const useDayPlanForDate = makeUseDayPlanForDate(useQuery);
