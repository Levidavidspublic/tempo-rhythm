import { describe, expect, test } from "bun:test";
import {
  checkConnectionSecretDoc,
  isConnectionSecretUsable,
  scrubConnectionSecretPatch,
  type ConnectionSecretDoc,
} from "./connection-secret-doc";

const validSecret = {
  connectionId: "connection-1",
  accessTokenCipher: "cipher-a",
  refreshTokenCipher: "cipher-r",
  accessTokenExpiresAt: 1_795_100_000_000,
  keyVersion: 1,
  createdAt: 1_795_000_000_000,
  updatedAt: 1_795_000_000_000,
} as const;

describe("connection secret documents", () => {
  test("accepts a valid document", () => {
    expect(checkConnectionSecretDoc(validSecret)).toEqual({ ok: true, doc: validSecret });
  });

  test("refuses userId because ownership comes from the private path", () => {
    expect(checkConnectionSecretDoc({ ...validSecret, userId: "user-1" }).ok).toBe(false);
  });

  test("refuses a plain accessToken field", () => {
    expect(checkConnectionSecretDoc({ ...validSecret, accessToken: "not-a-token" }).ok).toBe(false);
  });

  test("refuses invalid key versions", () => {
    expect(checkConnectionSecretDoc({ ...validSecret, keyVersion: 0 }).ok).toBe(false);
    expect(checkConnectionSecretDoc({ ...validSecret, keyVersion: 1.5 }).ok).toBe(false);
  });

  test("refuses a deleted document that still holds ciphertext", () => {
    expect(checkConnectionSecretDoc({ ...validSecret, deletedAt: validSecret.updatedAt }).ok).toBe(
      false,
    );
  });

  test("does not include a ciphertext value in a refusal reason", () => {
    const cipher = "cipher-must-not-leak";
    const result = checkConnectionSecretDoc({ ...validSecret, deletedAt: 1, accessTokenCipher: cipher });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).not.toContain(cipher);
  });

  test("builds the disconnect scrub patch", () => {
    const nowMs = 1_795_200_000_000;

    expect(scrubConnectionSecretPatch(nowMs)).toEqual({
      clear: ["accessTokenCipher", "refreshTokenCipher", "accessTokenExpiresAt"],
      set: { deletedAt: nowMs, updatedAt: nowMs },
    });
  });

  test("is unusable after scrub and usable with only a refresh cipher", () => {
    const refreshOnly: ConnectionSecretDoc = {
      connectionId: "connection-1",
      refreshTokenCipher: "cipher-r",
      keyVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    };
    const scrubbed = { ...refreshOnly, refreshTokenCipher: undefined, deletedAt: 2, updatedAt: 2 };

    expect(isConnectionSecretUsable(scrubbed)).toBe(false);
    expect(isConnectionSecretUsable(refreshOnly)).toBe(true);
  });
});
