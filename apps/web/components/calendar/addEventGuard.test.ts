import { describe, expect, test } from "bun:test";
import { getAddEventAuthState, SERVER_ERROR_MESSAGE, toAddEventErrorMessage } from "./addEventGuard";

describe("add event auth guard", () => {
  test("waits while auth is loading, even if not yet authenticated", () => {
    expect(
      getAddEventAuthState({ isAuthenticated: false, isLoading: true, profile: undefined })
    ).toBe("wait");
  });

  test("is signed out only after auth loading finishes", () => {
    expect(
      getAddEventAuthState({ isAuthenticated: false, isLoading: false, profile: undefined })
    ).toBe("signed-out");
  });

  test("waits for an authenticated user's profile to resolve", () => {
    expect(
      getAddEventAuthState({ isAuthenticated: true, isLoading: false, profile: undefined })
    ).toBe("wait");
    expect(
      getAddEventAuthState({ isAuthenticated: true, isLoading: false, profile: null })
    ).toBe("wait");
  });

  test("is ready once the authenticated user's profile exists", () => {
    expect(
      getAddEventAuthState({ isAuthenticated: true, isLoading: false, profile: { name: "Ari" } })
    ).toBe("ready");
  });

  test("server errors never leak raw Convex text", () => {
    const raw = new Error('[CONVEX M(calendar_events:create)] {"code":"X"} Server Error');
    expect(toAddEventErrorMessage(raw)).toBe(SERVER_ERROR_MESSAGE);
    expect(toAddEventErrorMessage(raw)).not.toContain("CONVEX");
  });
});
