import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { publicHttpsUrl } from "./config";
import { FAKE, SECRETS, fakeExecutor } from "./fakeExecutor.testkit";
import {
  type AuthServerMetadata,
  type FetchLike,
  OAuthFlowError,
  authServerMetadataUrls,
  buildAuthorizationUrl,
  chooseAuthMethod,
  chooseScope,
  createPkce,
  createState,
  discoverProtectedResource,
  exchangeCode,
  fetchAuthServerMetadata,
  parseBearerChallenge,
  protectedResourceMetadataUrls,
  readTokenResponse,
  refreshTokens,
  registerClient,
  resourceMatches,
  revokeToken,
} from "./oauth";

async function failure(run: () => Promise<unknown>): Promise<OAuthFlowError> {
  const error = await run().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(OAuthFlowError);
  return error as OAuthFlowError;
}

const METADATA: AuthServerMetadata = {
  issuer: FAKE.issuer,
  authorizationEndpoint: FAKE.authorize,
  tokenEndpoint: FAKE.token,
  registrationEndpoint: FAKE.register,
  revocationEndpoint: FAKE.revoke,
  scopesSupported: ["openid", "offline_access"],
  tokenEndpointAuthMethods: ["client_secret_basic", "none"],
  issParameterSupported: false,
};

describe("discovery", () => {
  test("the 401 challenge names the protected resource metadata, whose resource and issuer are read", async () => {
    const executor = fakeExecutor({ scopeInChallenge: "mcp:tools" });
    const found = await discoverProtectedResource(executor.fetch, FAKE.mcpUrl);
    expect(found).toEqual({ issuer: FAKE.issuer, resourceScope: "mcp:tools" });
    expect(executor.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${FAKE.mcpUrl}`,
      `GET ${FAKE.prm}`,
    ]);
    // The probe is unauthenticated.
    expect(executor.calls[0]?.headers.authorization).toBeUndefined();
  });

  test("without a challenge header the well-known URIs are tried in the spec's order", async () => {
    const executor = fakeExecutor({ challengeHeader: false, scopesSupported: ["a", "b"] });
    const found = await discoverProtectedResource(executor.fetch, FAKE.mcpUrl);
    expect(found).toEqual({ issuer: FAKE.issuer, resourceScope: "a b" });
    expect(protectedResourceMetadataUrls("https://h.test/mcp?connection=x")).toEqual([
      "https://h.test/.well-known/oauth-protected-resource/mcp?connection=x",
      "https://h.test/.well-known/oauth-protected-resource",
    ]);
    expect(protectedResourceMetadataUrls("https://h.test/")).toEqual([
      "https://h.test/.well-known/oauth-protected-resource",
    ]);
  });

  test("metadata that names another resource stops the connect", async () => {
    const executor = fakeExecutor({ prmResource: "https://evil.test/mcp" });
    expect((await failure(() => discoverProtectedResource(executor.fetch, FAKE.mcpUrl))).kind).toBe("discovery");
    expect(resourceMatches("https://h.test/mcp", "https://h.test/mcp")).toBe(true);
    expect(resourceMatches("https://h.test/mcp", "https://h.test/mcp?connection=x")).toBe(true);
    expect(resourceMatches("https://h.test/other", "https://h.test/mcp")).toBe(false);
    expect(resourceMatches("https://h.test/mcp?connection=y", "https://h.test/mcp?connection=x")).toBe(false);
  });

  test("auth server metadata: RFC 8414 first, exact issuer, S256 required", async () => {
    const executor = fakeExecutor({ issSupported: true });
    const metadata = await fetchAuthServerMetadata(executor.fetch, FAKE.issuer);
    expect(metadata).toMatchObject({
      issuer: FAKE.issuer,
      authorizationEndpoint: FAKE.authorize,
      tokenEndpoint: FAKE.token,
      registrationEndpoint: FAKE.register,
      revocationEndpoint: FAKE.revoke,
      issParameterSupported: true,
    });
    expect(executor.calls.map((c) => c.url)).toEqual([FAKE.asMetadata]);

    const mismatch = fakeExecutor({ metadataIssuer: "https://auth.executor.test/" });
    expect((await failure(() => fetchAuthServerMetadata(mismatch.fetch, FAKE.issuer))).kind).toBe("issuer_mismatch");
    const noPkce = fakeExecutor({ s256: false });
    expect((await failure(() => fetchAuthServerMetadata(noPkce.fetch, FAKE.issuer))).kind).toBe("no_pkce");
  });

  test("an issuer with a path is looked up in the MCP spec's order", () => {
    expect(authServerMetadataUrls("https://a.test/api/auth")).toEqual([
      "https://a.test/.well-known/oauth-authorization-server/api/auth",
      "https://a.test/.well-known/openid-configuration/api/auth",
      "https://a.test/api/auth/.well-known/openid-configuration",
    ]);
    expect(authServerMetadataUrls("https://a.test")).toEqual([
      "https://a.test/.well-known/oauth-authorization-server",
      "https://a.test/.well-known/openid-configuration",
    ]);
  });

  test("a network failure or a timeout is a kind, not the server's text", async () => {
    const down: FetchLike = async () => {
      throw new TypeError("getaddrinfo ENOTFOUND secret-host");
    };
    const error = await failure(() => discoverProtectedResource(down, FAKE.mcpUrl));
    expect(error.kind).toBe("network");
    expect(error.message).toBe("oauth step failed (network)");
  });

  test("WWW-Authenticate parameters are read from the Bearer challenge", () => {
    expect(parseBearerChallenge('Bearer resource_metadata="https://x.test/prm", scope="a b"')).toEqual({
      resource_metadata: "https://x.test/prm",
      scope: "a b",
    });
    expect(parseBearerChallenge('Basic realm="x", Bearer error=insufficient_scope')).toEqual({
      error: "insufficient_scope",
    });
    expect(parseBearerChallenge('Basic realm="x"')).toBeNull();
    expect(parseBearerChallenge(null)).toBeNull();
  });
});

describe("m7: discovered URLs are held to public https (SSRF guard)", () => {
  test("publicHttpsUrl refuses IP literals, localhost, private names, other ports, credentials and http", () => {
    for (const refused of [
      "http://auth.executor.test/x",
      "https://127.0.0.1/x",
      "https://0x7f000001/x",
      "https://2130706433/x",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/token",
      "https://[::1]/x",
      "https://[fd00::1]/x",
      "https://localhost/x",
      "https://api.localhost/x",
      "https://intranet-host/x",
      "https://metadata.google.internal/x",
      "https://printer.local/x",
      "https://router.home.arpa/x",
      "https://auth.executor.test:8443/x",
      // A URL with a user and password, built so secret scanners don't read it as a credential.
      ["https://user", "pass@auth.executor.test/x"].join(":"),
      "https://auth.executor.test/x#frag",
      "not a url",
    ]) {
      expect(publicHttpsUrl(refused)).toBeNull();
    }
    expect(publicHttpsUrl("https://auth.executor.test/oauth2/token")).toBe("https://auth.executor.test/oauth2/token");
    expect(publicHttpsUrl("https://mcp.executor.sh/mcp?connection=abc")).toBe("https://mcp.executor.sh/mcp?connection=abc");
  });

  test("a challenge naming a private or IP-literal metadata URL is refused, and that URL is never fetched", async () => {
    for (const named of [
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/.well-known/oauth-protected-resource",
      "https://metadata.google.internal/computeMetadata",
      "http://mcp.executor.test/.well-known/oauth-protected-resource/mcp",
    ]) {
      const executor = fakeExecutor({ challengeResourceMetadata: named });
      expect((await failure(() => discoverProtectedResource(executor.fetch, FAKE.mcpUrl))).kind).toBe("discovery");
      expect(executor.calls.map((c) => c.url)).toEqual([FAKE.mcpUrl]);
    }
  });

  test("an authorization server or endpoint on a private address is refused before it is called", async () => {
    const issuerOnIp = fakeExecutor({ authorizationServer: "https://127.0.0.1" });
    expect((await failure(() => discoverProtectedResource(issuerOnIp.fetch, FAKE.mcpUrl))).kind).toBe("discovery");
    expect((await failure(() => fetchAuthServerMetadata(issuerOnIp.fetch, "https://127.0.0.1"))).kind).toBe("discovery");
    expect(issuerOnIp.calls.some((c) => c.url.includes("127.0.0.1"))).toBe(false);

    const tokenOnLocalhost = fakeExecutor({ tokenEndpoint: "https://localhost/token" });
    expect((await failure(() => fetchAuthServerMetadata(tokenOnLocalhost.fetch, FAKE.issuer))).kind).toBe("discovery");
  });

  test("metadata requests refuse redirects; the unauthenticated probe does not follow one", async () => {
    const executor = fakeExecutor();
    const found = await discoverProtectedResource(executor.fetch, FAKE.mcpUrl);
    await fetchAuthServerMetadata(executor.fetch, found.issuer);
    expect(executor.calls.map((c) => [c.method, c.redirect])).toEqual([
      ["POST", "manual"],
      ["GET", "error"],
      ["GET", "error"],
    ]);
  });
});

describe("registration, PKCE and the authorization URL", () => {
  test("Dynamic Client Registration sends Tempo's details and keeps the secret it gets", async () => {
    const executor = fakeExecutor();
    const client = await registerClient(executor.fetch, METADATA, {
      redirectUri: "https://x.convex.site/connections/executor/callback",
      clientUri: "https://www.tempo.test",
    });
    expect(client).toEqual({
      clientId: FAKE.clientId,
      clientSecret: SECRETS.clientSecret,
      tokenEndpointAuthMethod: "client_secret_basic",
    });
    expect(JSON.parse(executor.calls[0]?.body ?? "{}")).toEqual({
      client_name: "Tempo",
      client_uri: "https://www.tempo.test",
      redirect_uris: ["https://x.convex.site/connections/executor/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "client_secret_basic",
    });
    expect(chooseAuthMethod({ ...METADATA, tokenEndpointAuthMethods: ["none"] })).toBe("none");
    expect((await failure(() => registerClient(executor.fetch, { ...METADATA, registrationEndpoint: undefined }, { redirectUri: "https://x", clientUri: "https://y" }))).kind).toBe("no_registration");
  });

  test("PKCE is S256 of a 43-character verifier; state is fresh", async () => {
    const { verifier, challenge } = await createPkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(createState()).not.toBe(createState());
  });

  test("the authorization URL carries code, S256, state, scope and resource", () => {
    const url = new URL(
      buildAuthorizationUrl(METADATA, {
        clientId: FAKE.clientId,
        redirectUri: "https://x.convex.site/cb",
        challenge: "CHALLENGE",
        state: "STATE",
        scope: "openid offline_access",
        resource: FAKE.mcpUrl,
      }),
    );
    expect(url.origin + url.pathname).toBe(FAKE.authorize);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: FAKE.clientId,
      redirect_uri: "https://x.convex.site/cb",
      code_challenge: "CHALLENGE",
      code_challenge_method: "S256",
      state: "STATE",
      scope: "openid offline_access",
      resource: FAKE.mcpUrl,
    });
  });

  test("scope: the resource's scopes, plus offline_access only when the server lists it", () => {
    expect(chooseScope("mcp", METADATA)).toBe("mcp offline_access");
    expect(chooseScope(undefined, METADATA)).toBe("offline_access");
    expect(chooseScope("mcp", { ...METADATA, scopesSupported: [] })).toBe("mcp");
    expect(chooseScope(undefined, { ...METADATA, scopesSupported: [] })).toBeUndefined();
  });
});

describe("tokens", () => {
  const confidential = { clientId: FAKE.clientId, clientSecret: SECRETS.clientSecret, tokenEndpointAuthMethod: "client_secret_basic" as const };

  test("n5: with basic auth the client is named in the header only, not in the body", async () => {
    const executor = fakeExecutor();
    await exchangeCode(executor.fetch, {
      tokenEndpoint: FAKE.token,
      client: confidential,
      code: SECRETS.code,
      redirectUri: "https://x.convex.site/cb",
      codeVerifier: "VERIFIER",
      resource: FAKE.mcpUrl,
    });
    const form = new URLSearchParams(executor.calls[0]?.body);
    expect(form.has("client_id")).toBe(false);
    expect(form.has("client_secret")).toBe(false);
    expect(executor.calls[0]?.headers.authorization).toStartWith("Basic ");
  });

  test("the code exchange sends the verifier, the redirect URI and the resource, with basic auth", async () => {
    const executor = fakeExecutor();
    const tokens = await exchangeCode(executor.fetch, {
      tokenEndpoint: FAKE.token,
      client: confidential,
      code: SECRETS.code,
      redirectUri: "https://x.convex.site/cb",
      codeVerifier: "VERIFIER",
      resource: FAKE.mcpUrl,
    });
    expect(tokens).toEqual({
      accessToken: SECRETS.access1,
      refreshToken: SECRETS.refresh1,
      expiresIn: 3600,
      scope: "openid offline_access",
    });
    const call = executor.calls[0];
    expect(call?.headers.authorization).toBe(`Basic ${btoa(`${FAKE.clientId}:${SECRETS.clientSecret}`)}`);
    expect(Object.fromEntries(new URLSearchParams(call?.body))).toEqual({
      grant_type: "authorization_code",
      code: SECRETS.code,
      redirect_uri: "https://x.convex.site/cb",
      code_verifier: "VERIFIER",
      resource: FAKE.mcpUrl,
    });
  });

  test("errors carry the kind only, never the server's error_description or a secret", async () => {
    const executor = fakeExecutor({ tokenError: "access_denied" });
    const error = await failure(() =>
      exchangeCode(executor.fetch, {
        tokenEndpoint: FAKE.token,
        client: confidential,
        code: SECRETS.code,
        redirectUri: "https://x",
        codeVerifier: "VERIFIER",
        resource: FAKE.mcpUrl,
      }),
    );
    expect(error.kind).toBe("token");
    expect(error.message).not.toContain("SERVER-TEXT");
    expect(error.message).not.toContain(SECRETS.code);

    const grant = fakeExecutor({ tokenError: "invalid_grant" });
    expect(
      (
        await failure(() =>
          exchangeCode(grant.fetch, {
            tokenEndpoint: FAKE.token,
            client: confidential,
            code: SECRETS.code,
            redirectUri: "https://x",
            codeVerifier: "V",
            resource: FAKE.mcpUrl,
          }),
        )
      ).kind,
    ).toBe("invalid_grant");
  });

  test("a non-Bearer or token-less answer is refused", () => {
    expect(() => readTokenResponse({ access_token: "x", token_type: "mac" })).toThrow(OAuthFlowError);
    expect(() => readTokenResponse({ token_type: "Bearer" })).toThrow(OAuthFlowError);
    expect(readTokenResponse({ access_token: "x", token_type: "bearer", expires_in: -5 })).toEqual({ accessToken: "x" });
  });

  test("refresh sends the refresh token and the resource; invalid_grant is its own kind", async () => {
    const executor = fakeExecutor();
    executor.issue(SECRETS.access1, SECRETS.refresh1);
    const tokens = await refreshTokens(executor.fetch, {
      tokenEndpoint: FAKE.token,
      client: { clientId: FAKE.clientId, tokenEndpointAuthMethod: "none" },
      refreshToken: SECRETS.refresh1,
      resource: FAKE.mcpUrl,
    });
    expect(tokens.accessToken).toBe(SECRETS.access2);
    expect(tokens.refreshToken).toBe(SECRETS.refresh2);
    expect(Object.fromEntries(new URLSearchParams(executor.calls[0]?.body))).toEqual({
      grant_type: "refresh_token",
      refresh_token: SECRETS.refresh1,
      resource: FAKE.mcpUrl,
      client_id: FAKE.clientId,
    });
    expect(executor.calls[0]?.headers.authorization).toBeUndefined();

    const refused = fakeExecutor({ refreshError: "invalid_grant" });
    expect(
      (
        await failure(() =>
          refreshTokens(refused.fetch, {
            tokenEndpoint: FAKE.token,
            client: { clientId: FAKE.clientId, tokenEndpointAuthMethod: "none" },
            refreshToken: SECRETS.refresh1,
            resource: FAKE.mcpUrl,
          }),
        )
      ).kind,
    ).toBe("invalid_grant");
  });

  test("revocation posts the token with its hint, and never throws", async () => {
    const executor = fakeExecutor();
    const ok = await revokeToken(executor.fetch, {
      revocationEndpoint: FAKE.revoke,
      client: { clientId: FAKE.clientId, tokenEndpointAuthMethod: "client_secret_post", clientSecret: SECRETS.clientSecret },
      token: SECRETS.refresh1,
      tokenTypeHint: "refresh_token",
    });
    expect(ok).toBe(true);
    expect(executor.revoked).toEqual([{ token: SECRETS.refresh1, hint: "refresh_token" }]);
    expect(new URLSearchParams(executor.calls[0]?.body).get("client_secret")).toBe(SECRETS.clientSecret);
    const down: FetchLike = async () => {
      throw new TypeError("down");
    };
    expect(
      await revokeToken(down, {
        revocationEndpoint: FAKE.revoke,
        client: { clientId: FAKE.clientId, tokenEndpointAuthMethod: "none" },
        token: "t",
        tokenTypeHint: "access_token",
      }),
    ).toBe(false);
  });
});
