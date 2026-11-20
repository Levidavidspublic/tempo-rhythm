"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type RemoveTask = ReactMutation<typeof api.tasks.remove>;

// Step A seam: the Firebase half comes in step B and changes only this file.
export function makeUseRemoveTask(
  useMutationImpl: (reference: typeof api.tasks.remove) => RemoveTask
) {
  return function useRemoveTask(): RemoveTask {
    return useMutationImpl(api.tasks.remove);
  };
}

export const useRemoveTask = makeUseRemoveTask(useMutation);
