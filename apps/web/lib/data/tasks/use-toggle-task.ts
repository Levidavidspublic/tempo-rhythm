"use client";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type ToggleTask = (
  args: FunctionArgs<typeof api.tasks.toggleCompletion>
) => Promise<FunctionReturnType<typeof api.tasks.toggleCompletion>>;

export function makeUseToggleTask(
  useMutationImpl: (reference: typeof api.tasks.toggleCompletion) => ToggleTask
) {
  return function useToggleTask(): ToggleTask {
    return useMutationImpl(api.tasks.toggleCompletion);
  };
}

export const useToggleTask = makeUseToggleTask(useMutation);
