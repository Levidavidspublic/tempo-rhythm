"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const PLACEHOLDER_NAME = "User";

function usable(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === PLACEHOLDER_NAME) return null;
  return trimmed;
}

function resolveGreetingName(profile: { greetingName?: string; email?: string } | null): string {
  return usable(profile?.greetingName) ?? usable(profile?.email?.split("@")[0]) ?? "there";
}

/** Shell greeting. Hot files wire this in; it never renders the placeholder name. */
export function GreetingName() {
  const profile = useQuery(api.users.getProfile, {});
  if (profile === undefined) {
    return <span aria-live="polite">Hi</span>;
  }
  return <span aria-live="polite">Hi, {resolveGreetingName(profile)}</span>;
}
