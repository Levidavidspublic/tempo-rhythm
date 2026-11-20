"use client";

import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

type CreateQuickTaskArgs = FunctionArgs<typeof api.tasks.createQuick>;
type CreateQuickTaskResult = FunctionReturnType<typeof api.tasks.createQuick>;

export function useCreateQuickTask(): (
  args: CreateQuickTaskArgs
) => Promise<CreateQuickTaskResult> {
  return useMutation(api.tasks.createQuick);
}
