"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseCoachSettings(useQueryImpl: typeof useQuery<typeof api.coach.getSettings>) {
  return function useCoachSettings(args: FunctionArgs<typeof api.coach.getSettings> | "skip") {
    return useQueryImpl(api.coach.getSettings, args);
  };
}

export const useCoachSettings = makeUseCoachSettings(useQuery);
