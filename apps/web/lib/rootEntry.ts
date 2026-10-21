/**
 * Default entry for "/".
 *
 * Signed-out visitors with no `code` query see the public marketing page.
 * Signed-in visitors go to /today.
 * A non-empty `code` query on "/" is a Convex Auth magic link. The auth
 * middleware exchanges that code before this decision on a normal browser
 * GET. If the code is still on the request, stay on "/" so the exchange
 * can finish. The follow-up request (no code, session cookies set) then
 * sends the signed-in visitor to /today.
 *
 * Other app routes stay private: signed-out visitors go to /sign-in.
 */
export const PUBLIC_ROUTE_PATTERNS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/terms",
  "/privacy",
  "/contact",
  "/success",
  "/api/health",
  // The per-user MCP token authenticates this route, not the session cookie.
  "/api/mcp",
] as const;

export function decideEntryRedirect(input: {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
  isPublicRoute: boolean;
  isCalendarE2EBypass: boolean;
}): string | null {
  const query = input.search.startsWith("?") ? input.search.slice(1) : input.search;
  const code = new URLSearchParams(query).get("code");
  if (input.pathname === "/" && code) {
    return null;
  }

  if (input.pathname === "/" && input.isAuthenticated) {
    return "/today";
  }

  if (input.pathname === "/") {
    return null;
  }

  if (!(input.isPublicRoute || input.isCalendarE2EBypass || input.isAuthenticated)) {
    const nextPath = `${input.pathname}${input.search}`;
    const params = new URLSearchParams({ next: nextPath });
    return `/sign-in?${params.toString()}`;
  }

  return null;
}
