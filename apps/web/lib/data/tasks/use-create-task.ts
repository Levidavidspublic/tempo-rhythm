"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Step A seam: FB-105b adds Firebase by changing only this file.
export function useCreateTask() {
  return useMutation(api.tasks.create);
}
