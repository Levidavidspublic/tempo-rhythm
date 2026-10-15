import { describe, expect, test } from "bun:test";

import { passkeysView } from "./passkeys-view";

describe("passkeysView", () => {
  test("shows a spinner while auth loads, never signed-out", () => {
    expect(passkeysView({ isLoading: true, isAuthenticated: false, passkeysEnabled: false })).toBe(
      "loading",
    );
  });

  test("signed-in with the flag off shows coming soon", () => {
    expect(passkeysView({ isLoading: false, isAuthenticated: true, passkeysEnabled: false })).toBe(
      "coming-soon",
    );
  });

  test("signed-in with the flag on shows the manager", () => {
    expect(passkeysView({ isLoading: false, isAuthenticated: true, passkeysEnabled: true })).toBe(
      "enabled",
    );
  });

  test("lost client session shows the recovery state", () => {
    expect(passkeysView({ isLoading: false, isAuthenticated: false, passkeysEnabled: true })).toBe(
      "signed-out",
    );
  });
});
