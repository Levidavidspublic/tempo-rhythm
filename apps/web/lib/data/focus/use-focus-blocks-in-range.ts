"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseFocusBlocksInRange(
  useQueryImpl: typeof useQuery<typeof api.focusBlocks.listInRange>
) {
  return function useFocusBlocksInRange(
    args: FunctionArgs<typeof api.focusBlocks.listInRange> | "skip"
  ) {
    return useQueryImpl(api.focusBlocks.listInRange, args);
  };
}

export const useFocusBlocksInRange = makeUseFocusBlocksInRange(useQuery);
