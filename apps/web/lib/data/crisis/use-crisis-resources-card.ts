"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseCrisisResourcesCard(
  useQueryImpl: typeof useQuery<typeof api.crisis.resourcesCard>
) {
  return function useCrisisResourcesCard(args: FunctionArgs<typeof api.crisis.resourcesCard> | "skip") {
    return useQueryImpl(api.crisis.resourcesCard, args);
  };
}

export const useCrisisResourcesCard = makeUseCrisisResourcesCard(useQuery);
