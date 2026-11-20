"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type CreateTask = ReactMutation<typeof api.tasks.create>;

// Step A seam: FB-105b adds Firebase by changing only this file.
export function makeUseCreateTask(
  useMutationImpl: (reference: typeof api.tasks.create) => CreateTask
) {
  return function useCreateTask(): CreateTask {
    return useMutationImpl(api.tasks.create);
  };
}

export const useCreateTask = makeUseCreateTask(function useCreateTaskMutation(reference) {
  return useMutation(reference);
});
