"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListPeriodPagesArgs = FunctionArgs<typeof api.notes.listPeriodPages>;
type ListPeriodPagesResult = FunctionReturnType<typeof api.notes.listPeriodPages>;

export function makeUsePeriodPages(useQueryImpl: typeof useQuery<typeof api.notes.listPeriodPages>) {
  return function usePeriodPages(
    args: ListPeriodPagesArgs | "skip"
  ): ListPeriodPagesResult | undefined {
    return useQueryImpl(api.notes.listPeriodPages, args);
  };
}

export const usePeriodPages = makeUsePeriodPages(useQuery);
