"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type TemplateListArgs = FunctionArgs<typeof api.templates.list>;
type TemplateListResult = FunctionReturnType<typeof api.templates.list>;

export function makeUseTemplateList(useQueryImpl: typeof useQuery<typeof api.templates.list>) {
  return function useTemplateList(args: TemplateListArgs | "skip"): TemplateListResult | undefined {
    return useQueryImpl(api.templates.list, args);
  };
}

export const useTemplateList = makeUseTemplateList(useQuery);
