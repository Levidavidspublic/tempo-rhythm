"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListForRailArgs = FunctionArgs<typeof api.notes.listForRail>;
type ListForRailResult = FunctionReturnType<typeof api.notes.listForRail>;

export function makeUseRailNotes(useQueryImpl: typeof useQuery<typeof api.notes.listForRail>) {
  return function useRailNotes(args: ListForRailArgs | "skip"): ListForRailResult | undefined {
    return useQueryImpl(api.notes.listForRail, args);
  };
}

export const useRailNotes = makeUseRailNotes(useQuery);
