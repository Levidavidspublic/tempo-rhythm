"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseNoteList(useQueryImpl: typeof useQuery<typeof api.notes.list>) {
  return function useNoteList(
    args: FunctionArgs<typeof api.notes.list> | "skip"
  ): FunctionReturnType<typeof api.notes.list> | undefined {
    return useQueryImpl(api.notes.list, args);
  };
}

export const useNoteList = makeUseNoteList(useQuery);
