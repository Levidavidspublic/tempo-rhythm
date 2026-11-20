"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type CreateNote = ReactMutation<typeof api.notes.create>;

export function makeUseCreateNote(
  useMutationImpl: (reference: typeof api.notes.create) => CreateNote
) {
  return function useCreateNote(): CreateNote {
    return useMutationImpl(api.notes.create);
  };
}

export const useCreateNote = makeUseCreateNote(useMutation);
