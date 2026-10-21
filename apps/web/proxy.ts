import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextRequest } from "next/server";
import { E2E_WIRING_ROUTES } from "./lib/e2eWiringRoutes";
import { decideEntryRedirect, PUBLIC_ROUTE_PATTERNS } from "./lib/rootEntry";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS]);

const isCoreTaskViewRoute = createRouteMatcher([
  "/today",
  "/tasks",
  "/tasks/priority",
  "/tasks/energy",
  "/tasks/checklists",
  "/projects",
  "/projects/(.*)",
]);

// Wiring smoke specs (tests/e2e/wiring/) open these signed out under the same dev-only bypass.
const isWiringE2ERoute = createRouteMatcher([...E2E_WIRING_ROUTES]);

export default convexAuthNextjsMiddleware(async (request: NextRequest, ctx) => {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.TEMPO_E2E_AUTH_BYPASS === "1" &&
    process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1" &&
    (isCoreTaskViewRoute(request) || isWiringE2ERoute(request))
  ) {
    return;
  }

  const { convexAuth } = ctx;
  const isCalendarE2EBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.TEMPO_E2E_PUBLIC_CALENDAR === "1" &&
    request.nextUrl.pathname === "/calendar";
  let isAuthenticated = false;
  try {
    isAuthenticated = await convexAuth.isAuthenticated();
  } catch {
    isAuthenticated = false;
  }

  const redirectTo = decideEntryRedirect({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated,
    isPublicRoute: isPublicRoute(request),
    isCalendarE2EBypass,
  });
  if (redirectTo) {
    return nextjsMiddlewareRedirect(request, redirectTo);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
