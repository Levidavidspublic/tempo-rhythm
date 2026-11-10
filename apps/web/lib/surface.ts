/**
 * Which surface this deployment serves.
 *
 * - "coming-soon": only the coming-soon page, the waitlist API, the payment webhook and the
 *   release health check exist. Every other path answers 404. No sign-in, no app routes, no
 *   backend client.
 * - "app": the full app.
 *
 * Deny by default on live: the Vercel production environment is "coming-soon" unless
 * TEMPO_SURFACE says "app". Everywhere else is "app" unless TEMPO_SURFACE says "coming-soon".
 */
export type Surface = "coming-soon" | "app";

export const COMING_SOON_PATH = "/coming-soon";

/**
 * API routes that stay reachable on the coming-soon surface. Exact paths only.
 * `/api/health` is here because the release check and the live smoke read the deployed commit
 * from it (docs/DEPLOY.md, scripts/factory/release-gate.mjs, deploy-live-plan.mjs). It answers
 * `{ ok, service, proof, commit }` and calls nothing.
 */
export const COMING_SOON_API_PATHS = ["/api/waitlist", "/api/whop/webhook", "/api/health"] as const;

/** Static files the coming-soon page itself needs. Its scripts, styles and fonts live under /_next. */
export const COMING_SOON_STATIC_PATHS = ["/favicon.ico"] as const;

type SurfaceEnv = Record<string, string | undefined>;

/** Which surface this deployment serves: TEMPO_SURFACE when it names one, else coming-soon on Vercel production and app everywhere else. */
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
  if (
    (COMING_SOON_API_PATHS as readonly string[]).includes(pathname) ||
    (COMING_SOON_STATIC_PATHS as readonly string[]).includes(pathname)
  ) {
    return { action: "next" };
  }
  return { action: "not-found" };
}

// The proxy now sees every path outside /_next, so that on the coming-soon surface a path that
// only looks like a file (/notes/x.css) cannot slip past the gate into an app route. The app
// surface keeps exactly the paths it always handled: these two patterns are the proxy's previous
// matcher, unchanged.
const APP_PROXY_PAGE_PATHS =
  /^\/(?:(?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)$/;
const APP_PROXY_API_PATHS = /^\/(?:api|trpc)(?:.*)$/;

/** Whether the app surface's sign-in proxy handles this path (it skips file-like paths, as before). */
export function appProxyApplies(pathname: string): boolean {
  return APP_PROXY_PAGE_PATHS.test(pathname) || APP_PROXY_API_PATHS.test(pathname);
}
