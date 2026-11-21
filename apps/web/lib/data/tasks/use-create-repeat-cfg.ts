"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type CreateRepeatCfg = ReactMutation<typeof api.tasks.createRepeatCfg>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseCreateRepeatCfg(
  useMutationImpl: (reference: typeof api.tasks.createRepeatCfg) => CreateRepeatCfg
) {
  return function useCreateRepeatCfg(): CreateRepeatCfg {
    return useMutationImpl(api.tasks.createRepeatCfg);
  };
}

export const useCreateRepeatCfg = makeUseCreateRepeatCfg(useMutation);
