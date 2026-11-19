import { describe, expect, test } from "bun:test";
import { checkOAuthClientDoc, oauthClientPublicView } from "./oauth-client-doc";

const validPublicClient = {
  issuer: "https://issuer.example",
  redirectUri: "https://app.example/oauth/callback",
  clientId: "fake-client-id",
  keyVersion: 1,
  tokenEndpointAuthMethod: "none",
  authorizationEndpoint: "https://issuer.example/authorize",
  tokenEndpoint: "https://issuer.example/token",
  codeChallengeS256: true,
  createdAt: 1_795_000_000_000,
  updatedAt: 1_795_000_000_001,
} as const;

describe("OAuth client documents", () => {
  test("accepts a valid public client", () => {
    expect(checkOAuthClientDoc(validPublicClient)).toEqual({ ok: true, doc: validPublicClient });
  });

  test("accepts a valid confidential client", () => {
    const client = {
      ...validPublicClient,
      tokenEndpointAuthMethod: "client_secret_basic" as const,
      clientSecretCipher: "fake-ciphertext",
    };
    expect(checkOAuthClientDoc(client)).toEqual({ ok: true, doc: client });
  });

  test("refuses a userId field", () => {
    expect(checkOAuthClientDoc({ ...validPublicClient, userId: "fake-user" }).ok).toBe(false);
  });

  test("refuses a plain clientSecret field", () => {
    expect(checkOAuthClientDoc({ ...validPublicClient, clientSecret: "fake-secret" }).ok).toBe(
      false
    );
  });

  test("refuses an HTTP token endpoint", () => {
    expect(
      checkOAuthClientDoc({ ...validPublicClient, tokenEndpoint: "http://issuer.example/token" }).ok
    ).toBe(false);
  });

  test("enforces secret presence for the sign-in method", () => {
    expect(
      checkOAuthClientDoc({ ...validPublicClient, clientSecretCipher: "fake-ciphertext" }).ok
    ).toBe(false);
    expect(
      checkOAuthClientDoc({
        ...validPublicClient,
        tokenEndpointAuthMethod: "client_secret_basic",
      }).ok
    ).toBe(false);
  });

  test("refuses codeChallengeS256 false", () => {
    expect(checkOAuthClientDoc({ ...validPublicClient, codeChallengeS256: false }).ok).toBe(false);
  });

  test("public view drops secret material and reports whether a secret exists", () => {
    const checked = checkOAuthClientDoc({
      ...validPublicClient,
      tokenEndpointAuthMethod: "client_secret_post",
      clientSecretCipher: "fake-ciphertext",
    });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const view = oauthClientPublicView(checked.doc);
    expect(view).not.toHaveProperty("clientSecretCipher");
    expect(view).not.toHaveProperty("keyVersion");
    expect(view.hasClientSecret).toBe(true);
  });
});
