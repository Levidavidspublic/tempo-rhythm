import { createServerClient, getAccessTokenCookieName } from "@insforge/sdk/ssr";
import type { NextRequest } from "next/server";

const UPSTREAM_TIMEOUT_MS = 8_000;

type InsforgeSessionEnv = {
  url?: string;
  anonKey?: string;
};

export async function hasVerifiedInsforgeSession(
  request: Pick<NextRequest, "cookies" | "signal">,
  env: InsforgeSessionEnv = {
    url: process.env.NEXT_PUBLIC_INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  },
  fetchUpstream = fetch
): Promise<boolean> {
  const baseUrl = env.url?.trim();
  const anonKey = env.anonKey?.trim();
  if (!baseUrl || !anonKey || !request.cookies.get(getAccessTokenCookieName())?.value.trim()) {
    return false;
  }

  try {
    if (new URL(baseUrl).protocol !== "https:") return false;

    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]);
    const { data, error } = await createServerClient({
      baseUrl,
      anonKey,
      cookies: request.cookies,
      retryCount: 0,
      timeout: UPSTREAM_TIMEOUT_MS,
      fetch: Object.assign(
        (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
          fetchUpstream(input, {
            ...init,
            cache: "no-store",
            redirect: "error",
            signal: init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline,
          }),
        { preconnect: fetchUpstream.preconnect }
      ),
    }).auth.getCurrentUser();
    return !error && typeof data?.user?.id === "string" && data.user.id.trim().length > 0;
  } catch {
    return false;
  }
}
