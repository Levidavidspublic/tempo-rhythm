"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Args = FunctionArgs<typeof api.templates.proposeForPage>;
type Result = FunctionReturnType<typeof api.templates.proposeForPage>;

export function makeUseTemplateProposal(
  useQueryImpl: typeof useQuery<typeof api.templates.proposeForPage>
) {
  return function useTemplateProposal(args: Args | "skip"): Result | undefined {
    return useQueryImpl(api.templates.proposeForPage, args);
  };
}

export const useTemplateProposal = makeUseTemplateProposal(useQuery);
