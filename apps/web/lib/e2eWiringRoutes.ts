/**
 * Routes the local Playwright webServer may open signed out (TEMPO-B05-01, loop f3-2 wiring).
 * Used only by the dev-only E2E bypass in proxy.ts: it needs NODE_ENV !== "production" and both
 * TEMPO_E2E_AUTH_BYPASS=1 and NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS=1, so production auth is unchanged.
 * Each wiring smoke spec (tests/e2e/wiring/) asserts its component renders on one of these routes.
 */
export const E2E_WIRING_ROUTES = [
  "/plan",
  "/habits",
  "/habits/(.*)",
  "/brain-dump",
  "/search",
  "/coach",
  "/settings/profile",
  "/settings/preferences",
  "/settings/nags",
  "/settings/memory",
  "/notifications",
  "/billing",
  "/templates",
  "/templates/(.*)",
  "/onboarding",
] as const;
