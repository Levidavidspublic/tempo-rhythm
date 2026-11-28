"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseNoteTitleSearch(
  useQueryImpl: typeof useQuery<typeof api.notes.searchTitles>
) {
  return function useNoteTitleSearch(
    args: FunctionArgs<typeof api.notes.searchTitles> | "skip"
  ): FunctionReturnType<typeof api.notes.searchTitles> | undefined {
    return useQueryImpl(api.notes.searchTitles, args);
  };
}

export const useNoteTitleSearch = makeUseNoteTitleSearch(useQuery);
