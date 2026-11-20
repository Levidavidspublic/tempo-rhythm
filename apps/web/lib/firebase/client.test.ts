import { afterEach, describe, expect, test } from "bun:test";

import { getFirebaseClient, resetFirebaseClientForTests } from "./client";

afterEach(() => {
  resetFirebaseClientForTests();
});

describe("getFirebaseClient", () => {
  test("returns null when Firebase configuration is missing", () => {
    expect(getFirebaseClient({})).toBeNull();
  });

  test("creates and caches one client for a complete fake configuration", () => {
    const env = {
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-project.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-project",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:test",
    };

    const first = getFirebaseClient(env);
    const second = getFirebaseClient(env);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(first?.app.options.projectId).toBe("demo-project");
  });
});
