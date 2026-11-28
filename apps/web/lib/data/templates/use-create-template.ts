"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type CreateTemplate = ReactMutation<typeof api.templates.create>;

export function makeUseCreateTemplate(
  useMutationImpl: (reference: typeof api.templates.create) => CreateTemplate
) {
  return function useCreateTemplate(): CreateTemplate {
    return useMutationImpl(api.templates.create);
  };
}

export const useCreateTemplate = makeUseCreateTemplate(useMutation);
