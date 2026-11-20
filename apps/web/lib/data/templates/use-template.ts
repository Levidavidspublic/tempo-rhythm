"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export function makeUseTemplate(useQueryImpl: typeof useQuery<typeof api.templates.get>) {
  return function useTemplate(
    args: FunctionArgs<typeof api.templates.get> | "skip"
  ): FunctionReturnType<typeof api.templates.get> | undefined {
    return useQueryImpl(api.templates.get, args);
  };
}

export const useTemplate = makeUseTemplate(useQuery);
