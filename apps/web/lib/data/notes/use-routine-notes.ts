"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListRoutinesArgs = FunctionArgs<typeof api.notes.listRoutines>;
type ListRoutinesResult = FunctionReturnType<typeof api.notes.listRoutines>;

export function makeUseRoutineNotes(
  useQueryImpl: typeof useQuery<typeof api.notes.listRoutines>
) {
  return function useRoutineNotes(
    args: ListRoutinesArgs | "skip"
  ): ListRoutinesResult | undefined {
    return useQueryImpl(api.notes.listRoutines, args);
  };
}

export const useRoutineNotes = makeUseRoutineNotes(useQuery);
