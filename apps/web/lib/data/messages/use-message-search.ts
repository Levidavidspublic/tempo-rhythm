"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseMessageSearch(useQueryImpl: typeof useQuery<typeof api.messages.searchMine>) {
  return function useMessageSearch(args: FunctionArgs<typeof api.messages.searchMine> | "skip") {
    return useQueryImpl(api.messages.searchMine, args);
  };
}

export const useMessageSearch = makeUseMessageSearch(useQuery);
