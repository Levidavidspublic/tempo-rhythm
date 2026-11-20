"use client";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type ToggleTask = (
  args: FunctionArgs<typeof api.tasks.toggleCompletion>
) => Promise<FunctionReturnType<typeof api.tasks.toggleCompletion>>;

export function useToggleTask(): ToggleTask {
  return useMutation(api.tasks.toggleCompletion);
}
