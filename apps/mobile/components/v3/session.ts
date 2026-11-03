/**
 * Session hooks for the v3 mobile screens: who is signed in, whether the app is online, and the
 * phone's local date (it rolls over at midnight and when the app comes back to the front).
 */
import { useConvexAuth, useConvexConnectionState, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "@/convex/_generated/api";
import { localDayBounds, localIsoDate } from "@/lib/v3/dates";
import { initials, isOffline } from "@/lib/v3/display";

/**
 * Most Convex functions call requireUser, which needs the users row; `users.getProfile` is null
 * until it exists. Queries wait for `ready` (the web does the same).
 */
export function useTempoSession() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const name = profile?.greetingName && profile.greetingName !== "there" ? profile.greetingName : "";
  return {
    isAuthenticated,
    isLoading: isLoading || (isAuthenticated && profile === undefined),
    ready: isAuthenticated && !!profile,
    profile: profile ?? null,
    /** First name or nickname the coach uses; empty when there is none. */
    name,
    fullName: profile?.fullName?.trim() || name,
    initials: initials(profile?.fullName || name),
  };
}

export function useOffline(): boolean {
  const state = useConvexConnectionState();
  return isOffline(state);
}

/** Today's local date and its [start, end) bounds; refreshes each minute and on resume. */
export function useToday(): { iso: string; startMs: number; endMs: number } {
  const [iso, setIso] = useState(() => localIsoDate(new Date()));
  useEffect(() => {
    const check = () => setIso(localIsoDate(new Date()));
    const timer = setInterval(check, 60_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return { iso, ...localDayBounds(iso) };
}

/** A clock that ticks every `ms` while `active`. */
export function useNow(ms = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms, active]);
  return now;
}
