import { describe, expect, test } from "bun:test";
import {
  checkOAuthPendingDoc,
  OAUTH_PENDING_TTL_MS,
  oauthPendingState,
  type OAuthPendingDoc,
} from "./oauth-pending-doc";

const validAttempt = {
  provider: "executor",
  stateHash: "a".repeat(64),
  codeVerifierCipher: "fake-ciphertext",
  keyVersion: 1,
  issuer: "https://issuer.example.com",
  resource: "https://resource.example.com",
  redirectUri: "https://tempo.example.com/oauth/callback",
  clientRowId: "client-row-1",
  returnTo: "settings",
  createdAt: 1_795_000_000_000,
  updatedAt: 1_795_000_000_000,
  expiresAt: 1_795_000_000_000 + OAUTH_PENDING_TTL_MS,
} as const;

describe("checkOAuthPendingDoc", () => {
  test("accepts a valid attempt", () => {
    expect(checkOAuthPendingDoc(validAttempt)).toEqual({ ok: true, doc: validAttempt });
  });

  test("refuses userId because ownership comes from the path", () => {
    expect(checkOAuthPendingDoc({ ...validAttempt, userId: "fake-user" }).ok).toBe(false);
  });

  test("refuses a plain codeVerifier field", () => {
    expect(checkOAuthPendingDoc({ ...validAttempt, codeVerifier: "fake-verifier" }).ok).toBe(false);
  });

  test("refuses a stateHash that is not 64 lowercase hex characters", () => {
    expect(checkOAuthPendingDoc({ ...validAttempt, stateHash: "A".repeat(64) }).ok).toBe(false);
  });

  test("refuses an HTTP redirect URI", () => {
    expect(
      checkOAuthPendingDoc({ ...validAttempt, redirectUri: "http://tempo.example.com/callback" }).ok,
    ).toBe(false);
  });

  test("refuses expiry more than 10 minutes after creation", () => {
    expect(
      checkOAuthPendingDoc({
        ...validAttempt,
        expiresAt: validAttempt.createdAt + OAUTH_PENDING_TTL_MS + 1,
      }).ok,
    ).toBe(false);
  });

  test("refuses a used attempt that still holds the verifier cipher", () => {
    expect(checkOAuthPendingDoc({ ...validAttempt, usedAt: validAttempt.createdAt + 1 }).ok).toBe(
      false,
    );
  });

  test("reports open, expired, used, and removed states in precedence order", () => {
    expect(oauthPendingState(validAttempt, validAttempt.expiresAt - 1)).toBe("open");
    expect(oauthPendingState(validAttempt, validAttempt.expiresAt)).toBe("expired");

    const withoutCipher = { ...validAttempt, codeVerifierCipher: undefined };
    expect(
      oauthPendingState({ ...withoutCipher, usedAt: validAttempt.createdAt + 1 }, validAttempt.expiresAt),
    ).toBe("used");
    expect(
      oauthPendingState(
        {
          ...withoutCipher,
          usedAt: validAttempt.createdAt + 1,
          deletedAt: validAttempt.createdAt + 2,
        } as OAuthPendingDoc,
        validAttempt.expiresAt,
      ),
    ).toBe("removed");
  });
});
