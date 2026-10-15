import { describe, expect, test } from "bun:test";
import { decideEntryRedirect, PUBLIC_ROUTE_PATTERNS } from "./rootEntry";

const signedOut = {
  isAuthenticated: false,
  isPublicRoute: false,
  isCalendarE2EBypass: false,
};

describe("default entry", () => {
  test("treats / as a public route for the marketing page", () => {
    expect(PUBLIC_ROUTE_PATTERNS).toContain("/");
    expect(PUBLIC_ROUTE_PATTERNS).toEqual([
      "/",
      "/sign-in",
      "/sign-up",
      "/terms",
      "/privacy",
      "/contact",
      "/success",
      "/api/health",
      "/api/mcp",
    ]);
  });

  test("does not redirect /api/mcp to /sign-in when signed out", () => {
    expect(
      decideEntryRedirect({
        ...signedOut,
        pathname: "/api/mcp",
        search: "",
        isPublicRoute: true,
      })
    ).toBeNull();
  });

  test("shows the marketing page to a signed-out visitor on /", () => {
    expect(decideEntryRedirect({ ...signedOut, pathname: "/", search: "" })).toBeNull();
    expect(
      decideEntryRedirect({
        ...signedOut,
        pathname: "/",
        search: "",
        isPublicRoute: true,
      })
    ).toBeNull();
  });

  test("sends a signed-in visitor on / to /today", () => {
    expect(
      decideEntryRedirect({
        ...signedOut,
        pathname: "/",
        search: "",
        isAuthenticated: true,
      })
    ).toBe("/today");
  });

  test("leaves a magic-link code on / so Convex Auth can exchange it", () => {
    const search = "?code=magic-link-token";
    expect(decideEntryRedirect({ ...signedOut, pathname: "/", search })).toBeNull();
    expect(
      decideEntryRedirect({
        ...signedOut,
        pathname: "/",
        search,
        isAuthenticated: true,
      })
    ).toBeNull();
  });

  test("keeps the listed auth and legal routes public for signed-out visitors", () => {
    for (const pathname of PUBLIC_ROUTE_PATTERNS) {
      expect(
        decideEntryRedirect({
          ...signedOut,
          pathname,
          search: "",
          isPublicRoute: true,
        })
      ).toBeNull();
    }
  });

  test("still sends signed-out visitors on app routes to /sign-in", () => {
    expect(decideEntryRedirect({ ...signedOut, pathname: "/today", search: "" })).toBe(
      "/sign-in?next=%2Ftoday"
    );
  });

  test("does not treat a code query on other routes as a free pass", () => {
    expect(
      decideEntryRedirect({
        ...signedOut,
        pathname: "/today",
        search: "?code=magic-link-token",
      })
    ).toBe("/sign-in?next=%2Ftoday%3Fcode%3Dmagic-link-token");
  });
});
