import { describe, expect, mock, test } from "bun:test";
import { getAccessTokenCookieName, getRefreshTokenCookieName } from "@insforge/sdk/ssr";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/auth/insforge/refresh/route";
import {
  CALENDAR_E2E_BYPASS_OPTION,
  decideEntryRedirect,
  hasAuthenticatedEntrySession,
  isInsforgeRefreshRequest,
  PUBLIC_ROUTE_PATTERNS,
} from "../rootEntry";
import { SESSION_REQUEST_HEADER } from "./client";
import { hasVerifiedInsforgeSession } from "./server-session";

const origin = "https://tempo.example.test";
const provider = { url: "https://insforge.example.test", anonKey: "non-secret-fixture" };
const refreshPath = "/api/auth/insforge/refresh";
const accessCookie = "synthetic-session";

function request(withAccessCookie = false) {
  const req = new NextRequest(`${origin}/today`);
  if (withAccessCookie) req.cookies.set(getAccessTokenCookieName(), accessCookie);
  return req;
}

function upstream(respond: () => Response) {
  const fetcher = mock<(...args: Parameters<typeof fetch>) => Promise<Response>>(async () =>
    respond()
  );
  return Object.assign(fetcher, { preconnect: fetch.preconnect });
}

describe("server-verified InsForge session", () => {
  test("denies a missing access cookie without an upstream call, even with a refresh cookie", async () => {
    const req = request();
    req.cookies.set(getRefreshTokenCookieName(), "synthetic-refresh-session");
    const fetcher = upstream(() => Response.json({}));
    expect(await hasVerifiedInsforgeSession(req, provider, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("denies incomplete or insecure configuration without an upstream call", async () => {
    const fetcher = upstream(() => Response.json({}));
    for (const env of [
      {},
      { url: provider.url },
      { anonKey: provider.anonKey },
      { ...provider, url: "http://insforge.example.test" },
    ]) {
      expect(await hasVerifiedInsforgeSession(request(true), env, fetcher)).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("accepts only a request whose access cookie the SDK verifies upstream", async () => {
    const fetcher = upstream(() => Response.json({ user: { id: "fixture-user" } }));
    expect(await hasVerifiedInsforgeSession(request(true), provider, fetcher)).toBe(true);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${provider.url}/api/auth/sessions/current`);
    expect(new Headers(init?.headers).get("Authorization") === `Bearer ${accessCookie}`).toBe(true);
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");

    expect(await hasVerifiedInsforgeSession(request(), provider, fetcher)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test.each(["INVALID_TOKEN", "TOKEN_EXPIRED"])("denies provider rejection %s", async (error) => {
    const fetcher = upstream(() => Response.json({ error }, { status: 401 }));
    expect(await hasVerifiedInsforgeSession(request(true), provider, fetcher)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("denies lookup errors and responses without a verified user ID", async () => {
    const req = request(true);
    const failedFetch = upstream(() => {
      throw new Error("Upstream unavailable");
    });
    const missingUser = upstream(() => Response.json({ user: { id: " " } }));
    expect(await hasVerifiedInsforgeSession(req, provider, failedFetch)).toBe(false);
    expect(await hasVerifiedInsforgeSession(req, provider, missingUser)).toBe(false);
  });
});

describe("app entry auth policy", () => {
  test("keeps the Convex default and the two-session requirement until Alpha moves", async () => {
    const authenticated = async () => true;
    const anonymous = async () => false;
    expect(await hasAuthenticatedEntrySession(authenticated)).toBe(true);
    expect(await hasAuthenticatedEntrySession(anonymous)).toBe(false);
    expect(await hasAuthenticatedEntrySession(authenticated, authenticated)).toBe(true);
    expect(await hasAuthenticatedEntrySession(authenticated, anonymous)).toBe(false);
    expect(await hasAuthenticatedEntrySession(anonymous, authenticated)).toBe(false);
  });

  test("denies a thrown auth lookup", async () => {
    const fail = async () => {
      throw new Error("Auth unavailable");
    };
    expect(await hasAuthenticatedEntrySession(fail)).toBe(false);
    expect(await hasAuthenticatedEntrySession(async () => true, fail)).toBe(false);
  });

  test("hands the exact refresh POST to the route without widening the public patterns", () => {
    expect(isInsforgeRefreshRequest(refreshPath, "POST")).toBe(true);
    expect((PUBLIC_ROUTE_PATTERNS as readonly string[]).includes(refreshPath)).toBe(false);
  });

  test("the refresh handler returns 401 without an InsForge session", async () => {
    const env = [
      ["NEXT_PUBLIC_DATA_BACKEND", "insforge"],
      ["NEXT_PUBLIC_INSFORGE_URL", provider.url],
      ["NEXT_PUBLIC_INSFORGE_ANON_KEY", provider.anonKey],
    ] as const;
    const previous = env.map(([key, value]) => {
      const prior = process.env[key];
      process.env[key] = value;
      return [key, prior] as const;
    });
    try {
      const req = new NextRequest(`${origin}${refreshPath}`, {
        method: "POST",
        headers: { [SESSION_REQUEST_HEADER]: "1" },
      });
      expect(isInsforgeRefreshRequest(req.nextUrl.pathname, req.method)).toBe(true);
      const response = await POST(req);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ user: null });
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test.each([
    [refreshPath, "GET"],
    [refreshPath, "OPTIONS"],
    [`${refreshPath}/`, "POST"],
    [`${refreshPath}/other`, "POST"],
    ["/api/auth/insforge/other", "POST"],
    ["/api/private", "POST"],
    ["/today", "GET"],
  ])("preserves the anonymous redirect for %s (%s)", (pathname, method) => {
    expect(isInsforgeRefreshRequest(pathname, method)).toBe(false);
    const target = new URL(
      decideEntryRedirect({
        pathname,
        search: "",
        isAuthenticated: false,
        isPublicRoute: PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern === pathname),
        [CALENDAR_E2E_BYPASS_OPTION]: false,
      }) ?? "",
      origin
    );
    expect(target.pathname).toBe("/sign-in");
    expect(target.searchParams.get("next")).toBe(pathname);
  });
});
