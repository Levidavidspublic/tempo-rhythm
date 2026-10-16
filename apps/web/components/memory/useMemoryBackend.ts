"use client";

import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SERVER_ROW_LIMIT } from "./memorySearch";

/**
 * Every Convex call "What Tempo remembers" makes, in one hook, so the screen reads as view code
 * and its render tests can stand in for the backend. memory.list calls requireUser, so it waits
 * for the users row (getProfile) first.
 */
export function useMemoryBackend(limit: number) {
  const convex = useConvex();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const memories = useQuery(api.memory.list, isAuthenticated && profile ? { limit } : "skip");
  const remember = useMutation(api.memory.remember);
  const update = useMutation(api.memory.update);
  const forget = useMutation(api.memory.forget);
  const restore = useMutation(api.memory.restore);
  const forgetAll = useMutation(api.memory.forgetAll);
  const restoreAll = useMutation(api.memory.restoreAll);
  const exportAll = () => convex.query(api.memory.exportAll, {});
  return {
    isAuthLoading,
    isAuthenticated,
    profile,
    memories,
    remember,
    update,
    forget,
    restore,
    forgetAll,
    restoreAll,
    exportAll,
  };
}

/**
 * memory.recall for one word, over every live memory (not just the 200 the list holds).
 * An empty needle skips the query. Undefined while skipped or still on its way.
 */
export function useMemoryRecall(needle: string) {
  return useQuery(api.memory.recall, needle ? { query: needle, limit: SERVER_ROW_LIMIT } : "skip");
}
