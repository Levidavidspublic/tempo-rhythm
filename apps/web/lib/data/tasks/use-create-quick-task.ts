"use client";

import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type CreateQuickTaskArgs = FunctionArgs<typeof api.tasks.createQuick>;
type CreateQuickTaskResult = FunctionReturnType<typeof api.tasks.createQuick>;
type CreateQuickTask = (args: CreateQuickTaskArgs) => Promise<CreateQuickTaskResult>;

export function makeUseCreateQuickTask(
  useMutationImpl: (reference: typeof api.tasks.createQuick) => CreateQuickTask
) {
  return function useCreateQuickTask(): CreateQuickTask {
    return useMutationImpl(api.tasks.createQuick);
  };
}

export const useCreateQuickTask = makeUseCreateQuickTask(useMutation);
