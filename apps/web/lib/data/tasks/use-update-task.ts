"use client";

import { type ReactMutation, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type UpdateTask = ReactMutation<typeof api.tasks.update>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseUpdateTask(
  useMutationImpl: (reference: typeof api.tasks.update) => UpdateTask
) {
  return function useUpdateTask(): UpdateTask {
    return useMutationImpl(api.tasks.update);
  };
}

export const useUpdateTask = makeUseUpdateTask(useMutation);
