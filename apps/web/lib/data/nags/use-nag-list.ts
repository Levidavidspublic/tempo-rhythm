"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type ListArgs = FunctionArgs<typeof api.nags.list>;
type ListResult = FunctionReturnType<typeof api.nags.list>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseNagList(useQueryImpl: typeof useQuery<typeof api.nags.list>) {
  return function useNagList(args: ListArgs | "skip"): ListResult | undefined {
    return useQueryImpl(api.nags.list, args);
  };
}

export const useNagList = makeUseNagList(useQuery);
