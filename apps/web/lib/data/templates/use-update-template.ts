"use client";

import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

type UpdateTemplate = (
  args: FunctionArgs<typeof api.templates.update>
) => Promise<FunctionReturnType<typeof api.templates.update>>;

export function makeUseUpdateTemplate(
  useMutationImpl: (reference: typeof api.templates.update) => UpdateTemplate
) {
  return function useUpdateTemplate(): UpdateTemplate {
    return useMutationImpl(api.templates.update);
  };
}

export const useUpdateTemplate = makeUseUpdateTemplate(useMutation);
