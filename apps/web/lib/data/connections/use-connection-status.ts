"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "@/convex/_generated/api";

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseConnectionStatus(
  useQueryImpl: typeof useQuery<typeof api.connections.status>
) {
  return function useConnectionStatus(args: FunctionArgs<typeof api.connections.status> | "skip") {
    return useQueryImpl(api.connections.status, args);
  };
}

export const useConnectionStatus = makeUseConnectionStatus(useQuery);
