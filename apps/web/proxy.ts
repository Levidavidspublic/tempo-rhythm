import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";
import { E2E_WIRING_ROUTES } from "./lib/e2eWiringRoutes";
import { decideEntryRedirect, PUBLIC_ROUTE_PATTERNS } from "./lib/rootEntry";
import { decideComingSoon, getSurface } from "./lib/surface";

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

const appProxy = convexAuthNextjsMiddleware(async (request: NextRequest, ctx) => {
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

/**
 * Coming-soon surface (live, see lib/surface.ts): deny by default. Only "/", the waitlist API and
 * the payment webhook answer; everything else is 404. Runs before any sign-in or backend code.
 */
function comingSoonProxy(request: NextRequest): NextResponse {
  const decision = decideComingSoon(request.nextUrl.pathname);
  switch (decision.action) {
    case "rewrite":
      return NextResponse.rewrite(new URL(decision.to, request.url));
    case "redirect":
      return NextResponse.redirect(new URL(decision.to, request.url), 308);
    case "next":
      return NextResponse.next();
    default:
      return new NextResponse("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
  }
}

/** Picks the surface first: coming-soon requests never reach the app's sign-in proxy. */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (getSurface() === "coming-soon") {
    return comingSoonProxy(request);
  }
  return appProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
