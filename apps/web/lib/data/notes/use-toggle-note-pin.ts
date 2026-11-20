"use client";

import { type ReactMutation, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type ToggleNotePin = ReactMutation<typeof api.notes.togglePin>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseToggleNotePin(
  useMutationImpl: (reference: typeof api.notes.togglePin) => ToggleNotePin
) {
  return function useToggleNotePin(): ToggleNotePin {
    return useMutationImpl(api.notes.togglePin);
  };
}

export const useToggleNotePin = makeUseToggleNotePin(useMutation);
