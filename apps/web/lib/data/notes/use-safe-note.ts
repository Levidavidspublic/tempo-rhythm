"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type GetSafeArgs = FunctionArgs<typeof api.notes.getSafe>;
type GetSafeResult = FunctionReturnType<typeof api.notes.getSafe>;

export function makeUseSafeNote(useQueryImpl: typeof useQuery<typeof api.notes.getSafe>) {
  return function useSafeNote(args: GetSafeArgs | "skip"): GetSafeResult | undefined {
    return useQueryImpl(api.notes.getSafe, args);
  };
}

export function useSafeNote(args: GetSafeArgs | "skip"): GetSafeResult | undefined {
  return useQuery(api.notes.getSafe, args);
}
