"use client";

import { type ReactMutation, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type SaveReviewed = ReactMutation<typeof api.memoryImport.saveReviewed>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseSaveReviewedMemories(
  useMutationImpl: (reference: typeof api.memoryImport.saveReviewed) => SaveReviewed
) {
  return function useSaveReviewedMemories(): SaveReviewed {
    return useMutationImpl(api.memoryImport.saveReviewed);
  };
}

export const useSaveReviewedMemories = makeUseSaveReviewedMemories(useMutation);
