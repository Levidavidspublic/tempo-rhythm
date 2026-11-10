import { describe, expect, test } from "bun:test";
import { decideComingSoon, getSurface } from "./surface";

describe("surface", () => {
  test("live is coming-soon unless told otherwise (deny by default)", () => {
    expect(getSurface({ VERCEL_ENV: "production" })).toBe("coming-soon");
    expect(getSurface({ VERCEL_ENV: "production", TEMPO_SURFACE: "" })).toBe("coming-soon");
    expect(getSurface({ VERCEL_ENV: "production", TEMPO_SURFACE: "typo" })).toBe("coming-soon");
    expect(getSurface({ VERCEL_ENV: "production", TEMPO_SURFACE: "app" })).toBe("app");
  });

  test("preview and local are the app unless told otherwise", () => {
    expect(getSurface({ VERCEL_ENV: "preview" })).toBe("app");
    expect(getSurface({})).toBe("app");
    expect(getSurface({ VERCEL_ENV: "preview", TEMPO_SURFACE: "coming-soon" })).toBe("coming-soon");
  });
});

describe("coming-soon surface routing", () => {
  test("/ shows the coming-soon page and /coming-soon goes back to /", () => {
    expect(decideComingSoon("/")).toEqual({ action: "rewrite", to: "/coming-soon" });
    expect(decideComingSoon("/coming-soon")).toEqual({ action: "redirect", to: "/" });
  });

  test("only the waitlist API and the payment webhook pass", () => {
    expect(decideComingSoon("/api/waitlist")).toEqual({ action: "next" });
    expect(decideComingSoon("/api/whop/webhook")).toEqual({ action: "next" });
  });

  test("every app, sign-in and other API path is not found", () => {
    for (const path of [
      "/sign-in",
      "/sign-up",
      "/today",
      "/tasks",
      "/admin/approvals",
      "/settings/profile",
      "/checkout",
      "/about",
      "/privacy",
      "/api/health",
      "/api/mcp",
      "/api/waitlist/",
      "/api/waitlist/export",
      "/api/whop",
      "/coming-soon/x",
      "/robots.txt",
    ]) {
      expect(decideComingSoon(path)).toEqual({ action: "not-found" });
    }
  });
});
