"use client";

import { useConvex } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";

export type CrisisGuardResult = {
  isCrisis: boolean;
};

export function useCrisisGuard() {
  const convex = useConvex();

  const guard = useCallback(
    async (text: string): Promise<CrisisGuardResult> => {
      try {
        const result = await convex.query(api.crisis.check, { text });
        return { isCrisis: result.isCrisis };
      } catch {
        return { isCrisis: false };
      }
    },
    [convex],
  );

  return { guard };
}
