"use client";

import { api } from "@/convex/_generated/api";
import { type ReactMutation, useMutation } from "convex/react";

type RenameProject = ReactMutation<typeof api.tasks.renameProject>;

/** Step A seam; step B adds Firebase by changing only this file. */
export function makeUseRenameProject(
  useMutationImpl: (reference: typeof api.tasks.renameProject) => RenameProject
) {
  return function useRenameProject(): RenameProject {
    return useMutationImpl(api.tasks.renameProject);
  };
}

export const useRenameProject = makeUseRenameProject(useMutation);
