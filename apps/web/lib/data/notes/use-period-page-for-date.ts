"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUsePeriodPageForDate(
  useQueryImpl: typeof useQuery<typeof api.notes.getPeriodPage>
) {
  return function usePeriodPageForDate(
    args: FunctionArgs<typeof api.notes.getPeriodPage> | "skip"
  ): FunctionReturnType<typeof api.notes.getPeriodPage> | undefined {
    return useQueryImpl(api.notes.getPeriodPage, args);
  };
}

export const usePeriodPageForDate = makeUsePeriodPageForDate(useQuery);
