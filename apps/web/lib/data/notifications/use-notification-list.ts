"use client";

import { useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type Args = FunctionArgs<typeof api.notifications.list>;
type Result = FunctionReturnType<typeof api.notifications.list>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseNotificationList(useQueryImpl: typeof useQuery<typeof api.notifications.list>) {
  return function useNotificationList(args: Args | "skip"): Result | undefined {
    return useQueryImpl(api.notifications.list, args);
  };
}

export const useNotificationList = makeUseNotificationList(useQuery);
