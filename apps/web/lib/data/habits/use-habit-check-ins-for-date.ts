"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Args = FunctionArgs<typeof api.habitCheckIns.listForDate>;
type Result = FunctionReturnType<typeof api.habitCheckIns.listForDate>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseHabitCheckInsForDate(
  useQueryImpl: typeof useQuery<typeof api.habitCheckIns.listForDate>
) {
  return function useHabitCheckInsForDate(args: Args | "skip"): Result | undefined {
    return useQueryImpl(api.habitCheckIns.listForDate, args);
  };
}

export const useHabitCheckInsForDate = makeUseHabitCheckInsForDate(useQuery);
