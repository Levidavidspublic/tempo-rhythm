"use client";

import { type ReactMutation, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type CreateTimeBlock = ReactMutation<typeof api.timeBlocks.create>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseCreateTimeBlock(
  useMutationImpl: (reference: typeof api.timeBlocks.create) => CreateTimeBlock
) {
  return function useCreateTimeBlock(): CreateTimeBlock {
    return useMutationImpl(api.timeBlocks.create);
  };
}

export const useCreateTimeBlock = makeUseCreateTimeBlock(useMutation);
