/**
 * Which surface this deployment serves.
 *
 * - "coming-soon": only the coming-soon page, the waitlist API and the payment webhook exist.
 *   Every other path answers 404. No sign-in, no app routes, no backend client.
 * - "app": the full app.
 *
 * Deny by default on live: the Vercel production environment is "coming-soon" unless
 * TEMPO_SURFACE says "app". Everywhere else is "app" unless TEMPO_SURFACE says "coming-soon".
 */
export type Surface = "coming-soon" | "app";

export const COMING_SOON_PATH = "/coming-soon";

/** API routes that stay reachable on the coming-soon surface. Exact paths only. */
export const COMING_SOON_API_PATHS = ["/api/waitlist", "/api/whop/webhook"] as const;

type SurfaceEnv = Record<string, string | undefined>;

export function getSurface(env: SurfaceEnv = process.env): Surface {
  const explicit = env.TEMPO_SURFACE?.trim();
  if (explicit === "app" || explicit === "coming-soon") {
    return explicit;
  }
  return env.VERCEL_ENV === "production" ? "coming-soon" : "app";
}

export type ComingSoonDecision =
  | { action: "rewrite"; to: typeof COMING_SOON_PATH }
  | { action: "redirect"; to: "/" }
  | { action: "next" }
  | { action: "not-found" };

/** What the coming-soon surface does with a request path. Anything not listed is not found. */
export function decideComingSoon(pathname: string): ComingSoonDecision {
  if (pathname === "/") {
    return { action: "rewrite", to: COMING_SOON_PATH };
  }
  if (pathname === COMING_SOON_PATH) {
    return { action: "redirect", to: "/" };
  }
  if ((COMING_SOON_API_PATHS as readonly string[]).includes(pathname)) {
    return { action: "next" };
  }
  return { action: "not-found" };
}
