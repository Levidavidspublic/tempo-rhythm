"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Step A seam: the Firebase half comes in step B and changes only this file.
export function useRestoreTask() {
  return useMutation(api.tasks.restore);
}
