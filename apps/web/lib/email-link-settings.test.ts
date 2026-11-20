import { describe, expect, test } from "bun:test";
import { buildEmailLinkSettings, safeNextPath } from "./email-link-settings";

describe("email link settings", () => {
  test("safeNextPath accepts safe local paths", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/notes/abc?x=1")).toBe("/notes/abc?x=1");
  });

  test("safeNextPath rejects empty, external, malformed, and oversized paths", () => {
    for (const path of [
      "",
      "today",
      "//evil.example",
      "/\\evil",
      "/a\\b",
      "/a\nnext",
      "/x?u=https://evil.example",
      `/${"a".repeat(512)}`,
    ]) {
      expect(safeNextPath(path)).toBeNull();
    }
  });

  test("builds settings for an HTTPS origin without a next path", () => {
    const settings = buildEmailLinkSettings({ origin: "https://app.example" });

    expect(settings).toEqual({
      url: "https://app.example/sign-in",
      handleCodeInApp: true,
    });
    expect(Object.isFrozen(settings)).toBe(true);
  });

  test("encodes a safe next path and drops an unsafe one", () => {
    expect(
      buildEmailLinkSettings({
        origin: "https://app.example",
        next: "/notes/abc?x=1",
      }),
    ).toEqual({
      url: "https://app.example/sign-in?next=%2Fnotes%2Fabc%3Fx%3D1",
      handleCodeInApp: true,
    });
    expect(
      buildEmailLinkSettings({
        origin: "https://app.example",
        next: "//evil.example",
      }),
    ).toEqual({
      url: "https://app.example/sign-in",
      handleCodeInApp: true,
    });
  });

  test("rejects unsafe origins and accepts HTTP localhost", () => {
    for (const origin of [
      "http://app.example",
      "https://app.example/path",
      "https://user@app.example",
      "not a url",
    ]) {
      expect(buildEmailLinkSettings({ origin })).toBeNull();
    }

    expect(buildEmailLinkSettings({ origin: "http://localhost:3000" })).toEqual({
      url: "http://localhost:3000/sign-in",
      handleCodeInApp: true,
    });
  });
});
