import { describe, expect, test } from "bun:test";
import { spawnSync } from "bun";
import { NextRequest } from "next/server";
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
      "/pricing",
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

  test("makes only the pricing route public using the real middleware matcher", async () => {
    // Import the installed matcher leaf; the barrel also enforces a React Server Component context.
    const { createRouteMatcher } = await import(new URL("./routeMatcher.js",
      import.meta.resolve("@convex-dev/auth/nextjs/server")).href);
    const matchesPublicRoute = createRouteMatcher([...PUBLIC_ROUTE_PATTERNS]);
    const pricing = new NextRequest("https://tempo.example/pricing?lang=he");
    expect(matchesPublicRoute(pricing)).toBe(true);
    for (const isAuthenticated of [false, true]) {
      expect(decideEntryRedirect({ ...signedOut, pathname: pricing.nextUrl.pathname,
        search: pricing.nextUrl.search, isPublicRoute: matchesPublicRoute(pricing), isAuthenticated })).toBeNull();
    }
    for (const pathname of ["/pricing/private", "/pricing-extra", "/settings", "/today"]) {
      const request = new NextRequest(`https://tempo.example${pathname}`);
      expect(matchesPublicRoute(request)).toBe(false);
      expect(decideEntryRedirect({ ...signedOut, pathname, search: "", isPublicRoute: matchesPublicRoute(request) }))
        .toBe(`/sign-in?next=${encodeURIComponent(pathname)}`);
    }
  });

  test("public pricing renders its catalog and checkout status without an account", () => {
    // A fresh Bun process prevents other suites' process-global React/Convex mocks leaking in.
    const result = spawnSync([process.execPath, "-e", `
      import { createElement } from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { LocaleProvider } from "./components/providers/LocaleProvider";
      import { PublicPricing } from "./components/marketing-pages/PublicPricing";
      console.log(renderToStaticMarkup(createElement(LocaleProvider, null, createElement(PublicPricing))));
    `], { cwd: `${import.meta.dir}/..`, timeout: 10_000 });
    expect(result.exitCode).toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toBe("");
    const html = new TextDecoder().decode(result.stdout);
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Checkout is not open yet. No payment is collected on this page.");
    expect(html).toContain("Account access currently needs approval.");
    for (const price of ["$1", "$10", "$20", "$40"]) expect(html).toContain(`>${price}</span>`);
    for (const tier of ["trial", "basic", "pro", "max"]) expect(html).toContain(`aria-labelledby="t-${tier}"`);
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain('href="/sign-in"');
    expect(html).not.toContain("data-current");
    expect(html.match(/<button\b/g)).toHaveLength(2);
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    expect(html).not.toContain("<form");
  }, 15_000);
});
