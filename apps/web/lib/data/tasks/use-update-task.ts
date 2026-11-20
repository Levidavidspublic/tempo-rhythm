"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/** Step A seam; step B adds Firebase by changing only this file. */
export function useUpdateTask() {
  return useMutation(api.tasks.update);
}
