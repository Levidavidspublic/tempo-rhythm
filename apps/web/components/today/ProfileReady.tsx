"use client";

import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";

// Dev-only Playwright harness: proxy.ts lets these routes open signed out, and
// the placeholder Convex URL never answers, so render the component as-is there.
const E2E_HARNESS =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

/**
 * Mounts children only once `users.getProfile` has a user row. Backend queries
 * that call `requireUser` throw while signed out and during the short race after
 * sign-in before the users row exists; `getProfile` returns null instead.
 */
export function ProfileReady({
  children,
  fallback,
}: {
  children: ReactNode;
  /** Shown while waiting or signed out. Defaults to a short status line. */
  fallback?: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");

  if (E2E_HARNESS && !isAuthenticated) return <>{children}</>;
  if (isLoading || (isAuthenticated && profile === undefined)) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <output className="block text-sm text-muted-foreground">
        Loading…
      </output>
    );
  }
  if (!isAuthenticated || !profile) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <output className="block text-sm text-muted-foreground">
        Sign in to see this page.
      </output>
    );
  }
  return <>{children}</>;
}
