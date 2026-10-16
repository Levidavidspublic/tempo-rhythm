"use client";

import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
