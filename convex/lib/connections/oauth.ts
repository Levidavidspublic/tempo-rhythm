/**
 * OAuth for connecting a person's Executor account (TEMPO-B07-07, #989; research doc §2, §3.3).
 *
 * Plain functions over a `fetch` that the caller passes in, so tests need no network. Native
 * `fetch` only (HARD_RULES §2). Every request has a timeout. Every error is an `OAuthFlowError`
 * whose message is its kind only: never a token, a code, a client secret or the server's text
 * (doc §3.5: Tempo never shows or logs Executor's `error_description`).
 *
 * The steps, in the MCP authorization spec's order (doc §2.1, sources S10–S13):
 * 1. `discoverProtectedResource`: one unauthenticated MCP request; a `401` names the protected
 *    resource metadata (RFC 9728) in `WWW-Authenticate`. Without it, the well-known URIs.
 * 2. `fetchProtectedResourceMetadata`: `resource` must be the MCP URL; take the first
 *    authorization server.
 * 3. `fetchAuthServerMetadata`: RFC 8414, then OpenID discovery; `issuer` must match exactly and
 *    S256 PKCE must be offered, else stop.
 * 4. `registerClient`: Dynamic Client Registration (RFC 7591) when no client is stored yet.
 * 5. `createPkce` / `createState` / `buildAuthorizationUrl` (with `resource`, RFC 8707).
 * 6. `exchangeCode`, `refreshTokens`, `revokeToken` (RFC 7009).
 *
 * Hosted Executor's real values (issuer, scopes, lifetimes, revocation) are UNKNOWN (doc §7.1
 * items 3–8): nothing here is hard-coded; it is all read from the metadata at connect time.
 */
import { randomBase64Url, sha256Base64Url } from "./crypto";

/** The slice of `fetch` this module uses. Tests pass a stub. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const OAUTH_LIMITS = {
  /** Discovery, registration, token and refresh requests. */
  timeoutMs: 15_000,
  /** Each revocation request (doc §2.5 step 2). */
  revokeTimeoutMs: 5_000,
  /** Largest metadata or token response read. */
  maxResponseBytes: 64 * 1024,
} as const;

export type OAuthErrorKind =
  | "network"
  | "timeout"
  | "discovery"
  | "issuer_mismatch"
  | "no_pkce"
  | "no_registration"
  | "registration"
  | "invalid_grant"
  | "invalid_client"
  | "token"
  | "bad_response";

/** A failed OAuth step. The message is the kind only. */
export class OAuthFlowError extends Error {
  readonly kind: OAuthErrorKind;
  constructor(kind: OAuthErrorKind) {
    super(`oauth step failed (${kind})`);
    this.name = "OAuthFlowError";
    this.kind = kind;
  }
}

export type TokenEndpointAuthMethod = "none" | "client_secret_basic" | "client_secret_post";

export type AuthServerMetadata = {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  revocationEndpoint?: string;
  scopesSupported: string[];
  tokenEndpointAuthMethods: string[];
  /** RFC 9207: the server says it sends `iss` on the redirect. */
  issParameterSupported: boolean;
};

export type ResourceDiscovery = {
  /** The first authorization server in the protected resource metadata. */
  issuer: string;
  /** `scope` from the 401 challenge, else the metadata's `scopes_supported`, joined. */
  resourceScope?: string;
};

export type RegisteredClient = {
  clientId: string;
  clientSecret?: string;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
};

export type ClientCredentials = {
  clientId: string;
  clientSecret?: string;
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
};

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  /** Seconds, when the server says. */
  expiresIn?: number;
  scope?: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** An https URL string (no credentials, no fragment), or undefined. */
function httpsEndpoint(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * The body as text, reading at most `max` bytes; null when it is longer (the rest is not read).
 * Shared with the MCP client.
 */
export async function readCappedText(response: Response, max: number): Promise<string | null> {
  if (!response.body) {
    const text = await response.text();
    return new TextEncoder().encode(text).length > max ? null : text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await readCappedText(response, OAUTH_LIMITS.maxResponseBytes);
  if (text === null) throw new OAuthFlowError("bad_response");
  try {
    return JSON.parse(text);
  } catch {
    throw new OAuthFlowError("bad_response");
  }
}

/**
 * One request with a timeout. Network failures and aborts become `network` / `timeout`; the
 * body is read by `read` while the timer still runs.
 */
async function request<T>(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new OAuthFlowError(controller.signal.aborted ? "timeout" : "network");
    }
    try {
      return await read(response);
    } catch (error) {
      if (error instanceof OAuthFlowError) throw error;
      throw new OAuthFlowError(controller.signal.aborted ? "timeout" : "bad_response");
    }
  } finally {
    clearTimeout(timer);
  }
}

/** The parameters of the `Bearer` challenge in a `WWW-Authenticate` header (lower-cased names). */
export function parseBearerChallenge(header: string | null): Record<string, string> | null {
  if (!header) return null;
  const match = /(?:^|,)\s*Bearer\b(.*)$/i.exec(header);
  if (!match) return null;
  const params: Record<string, string> = {};
  const pattern = /([A-Za-z0-9_.-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,"]+))/g;
  for (const m of (match[1] ?? "").matchAll(pattern)) {
    const name = (m[1] ?? "").toLowerCase();
    if (!(name in params)) {
      params[name] = m[2] !== undefined ? m[2].replace(/\\(.)/g, "$1") : (m[3] ?? "");
    }
  }
  return params;
}

/**
 * RFC 9728 §3.1 well-known URIs for a resource: path-inserted first, then the root (the MCP
 * spec's order). `https://h/mcp?x` gives `https://h/.well-known/oauth-protected-resource/mcp?x`.
 */
export function protectedResourceMetadataUrls(resource: string): string[] {
  const url = new URL(resource);
  const suffix = `${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  const urls = [`${url.origin}/.well-known/oauth-protected-resource${suffix}`];
  if (suffix) urls.push(`${url.origin}/.well-known/oauth-protected-resource`);
  return urls;
}

/**
 * Where to look for an issuer's metadata, in the MCP spec's order: RFC 8414 with the path
 * inserted, OpenID discovery with the path inserted, then OpenID discovery with it appended.
 */
export function authServerMetadataUrls(issuer: string): string[] {
  const url = new URL(issuer);
  const path = url.pathname.replace(/\/+$/, "");
  if (!path) {
    return [
      `${url.origin}/.well-known/oauth-authorization-server`,
      `${url.origin}/.well-known/openid-configuration`,
    ];
  }
  return [
    `${url.origin}/.well-known/oauth-authorization-server${path}`,
    `${url.origin}/.well-known/openid-configuration${path}`,
    `${url.origin}${path}/.well-known/openid-configuration`,
  ];
}

/** The unauthenticated probe: an MCP `initialize`, which a protected server answers with 401. */
function probeBody(): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "Tempo", version: "1.0.0" },
    },
  });
}

/**
 * Steps 4–5 of doc §2.1: probe the MCP URL, read the protected resource metadata, check its
 * `resource` and return the first authorization server.
 */
export async function discoverProtectedResource(
  fetchImpl: FetchLike,
  mcpUrl: string,
): Promise<ResourceDiscovery> {
  const challenge = await request(
    fetchImpl,
    mcpUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: probeBody(),
      redirect: "manual",
    },
    OAUTH_LIMITS.timeoutMs,
    async (response) => {
      // The body is not needed; only a 401's challenge is.
      await response.body?.cancel().catch(() => {});
      return response.status === 401
        ? parseBearerChallenge(response.headers.get("WWW-Authenticate"))
        : null;
    },
  );
  const fromHeader = httpsEndpoint(challenge?.resource_metadata);
  const candidates = fromHeader ? [fromHeader] : protectedResourceMetadataUrls(mcpUrl);
  for (const url of candidates) {
    const metadata = await fetchProtectedResourceMetadata(fetchImpl, url, mcpUrl);
    if (metadata) {
      const resourceScope = str(challenge?.scope) ?? (metadata.scopes.join(" ") || undefined);
      return { issuer: metadata.issuer, ...(resourceScope ? { resourceScope } : {}) };
    }
  }
  throw new OAuthFlowError("discovery");
}

/**
 * True when the metadata's `resource` names the MCP URL. EXTRAPOLATED: RFC 9728 wants the exact
 * identifier; a scoped URL (`?connection=`) is also accepted when the metadata names the same
 * URL without its query, since how hosted Executor states it is UNKNOWN (doc §1.5, §7.1).
 */
export function resourceMatches(resource: string, mcpUrl: string): boolean {
  let stated: URL;
  let configured: URL;
  try {
    stated = new URL(resource);
    configured = new URL(mcpUrl);
  } catch {
    return false;
  }
  if (stated.href === configured.href) return true;
  return configured.search !== "" && stated.search === "" && stated.href === `${configured.origin}${configured.pathname}`;
}

/** The PRM at `url`: null when it is missing (non-200); throws when it names another resource. */
export async function fetchProtectedResourceMetadata(
  fetchImpl: FetchLike,
  url: string,
  mcpUrl: string,
): Promise<{ issuer: string; scopes: string[] } | null> {
  const json = await request(
    fetchImpl,
    url,
    { method: "GET", headers: { Accept: "application/json" } },
    OAUTH_LIMITS.timeoutMs,
    async (response) => {
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => {});
        return null;
      }
      return readJson(response);
    },
  );
  if (json === null) return null;
  if (!isObject(json)) throw new OAuthFlowError("discovery");
  const resource = str(json.resource);
  if (!resource || !resourceMatches(resource, mcpUrl)) throw new OAuthFlowError("discovery");
  // The issuer is compared as written (RFC 8414 §3.3), so the server's own string is kept.
  const issuer = strings(json.authorization_servers)[0];
  if (!issuer || !httpsEndpoint(issuer)) throw new OAuthFlowError("discovery");
  return { issuer, scopes: strings(json.scopes_supported) };
}

/**
 * Step 6–7: the authorization server's metadata. `issuer` must equal the PRM's exactly (plain
 * string comparison), and S256 must be listed; otherwise the connect stops.
 */
export async function fetchAuthServerMetadata(
  fetchImpl: FetchLike,
  issuer: string,
): Promise<AuthServerMetadata> {
  for (const url of authServerMetadataUrls(issuer)) {
    const json = await request(
      fetchImpl,
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      OAUTH_LIMITS.timeoutMs,
      async (response) => {
        if (response.status !== 200) {
          await response.body?.cancel().catch(() => {});
          return null;
        }
        return readJson(response);
      },
    );
    if (json === null) continue;
    if (!isObject(json)) throw new OAuthFlowError("discovery");
    if (json.issuer !== issuer) throw new OAuthFlowError("issuer_mismatch");
    if (!strings(json.code_challenge_methods_supported).includes("S256")) {
      throw new OAuthFlowError("no_pkce");
    }
    const authorizationEndpoint = httpsEndpoint(json.authorization_endpoint);
    const tokenEndpoint = httpsEndpoint(json.token_endpoint);
    if (!authorizationEndpoint || !tokenEndpoint) throw new OAuthFlowError("discovery");
    const registrationEndpoint = httpsEndpoint(json.registration_endpoint);
    const revocationEndpoint = httpsEndpoint(json.revocation_endpoint);
    return {
      issuer,
      authorizationEndpoint,
      tokenEndpoint,
      ...(registrationEndpoint ? { registrationEndpoint } : {}),
      ...(revocationEndpoint ? { revocationEndpoint } : {}),
      scopesSupported: strings(json.scopes_supported),
      tokenEndpointAuthMethods: strings(json.token_endpoint_auth_methods_supported),
      issParameterSupported: json.authorization_response_iss_parameter_supported === true,
    };
  }
  throw new OAuthFlowError("discovery");
}

/**
 * The scope to ask for (doc §2.3): the challenge's or the resource's scopes, plus
 * `offline_access` only when the authorization server lists it. Undefined when there is none.
 */
export function chooseScope(resourceScope: string | undefined, metadata: AuthServerMetadata): string | undefined {
  const scopes = (resourceScope ?? "").split(/\s+/).filter(Boolean);
  if (metadata.scopesSupported.includes("offline_access") && !scopes.includes("offline_access")) {
    scopes.push("offline_access");
  }
  return scopes.length > 0 ? [...new Set(scopes)].join(" ") : undefined;
}

/** `client_secret_basic` when the server lists it, else `none` (doc §2.3, EXTRAPOLATED values). */
export function chooseAuthMethod(metadata: AuthServerMetadata): TokenEndpointAuthMethod {
  return metadata.tokenEndpointAuthMethods.includes("client_secret_basic") ? "client_secret_basic" : "none";
}

/**
 * Dynamic Client Registration (RFC 7591). One client per issuer and redirect URI, shared by
 * every person on the deployment (doc §2.3). The request values are EXTRAPOLATED.
 */
export async function registerClient(
  fetchImpl: FetchLike,
  metadata: AuthServerMetadata,
  options: { redirectUri: string; clientUri: string },
): Promise<RegisteredClient> {
  if (!metadata.registrationEndpoint) throw new OAuthFlowError("no_registration");
  const method = chooseAuthMethod(metadata);
  const json = await request(
    fetchImpl,
    metadata.registrationEndpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_name: "Tempo",
        client_uri: options.clientUri,
        redirect_uris: [options.redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "web",
        token_endpoint_auth_method: method,
      }),
      redirect: "error",
    },
    OAUTH_LIMITS.timeoutMs,
    async (response) => {
      if (response.status !== 200 && response.status !== 201) {
        await response.body?.cancel().catch(() => {});
        throw new OAuthFlowError("registration");
      }
      return readJson(response);
    },
  );
  if (!isObject(json)) throw new OAuthFlowError("registration");
  const clientId = str(json.client_id);
  if (!clientId) throw new OAuthFlowError("registration");
  const clientSecret = str(json.client_secret);
  const stated = json.token_endpoint_auth_method;
  const tokenEndpointAuthMethod: TokenEndpointAuthMethod =
    stated === "none" || stated === "client_secret_basic" || stated === "client_secret_post"
      ? stated
      : method;
  if (tokenEndpointAuthMethod !== "none" && !clientSecret) throw new OAuthFlowError("registration");
  return { clientId, ...(clientSecret ? { clientSecret } : {}), tokenEndpointAuthMethod };
}

/** A PKCE pair (RFC 7636): a 43-character verifier and its S256 challenge. */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBase64Url(32);
  return { verifier, challenge: await sha256Base64Url(verifier) };
}

/** A fresh `state`: 32 random bytes, base64url. Only its SHA-256 is stored. */
export function createState(): string {
  return randomBase64Url(32);
}

/** The authorization URL (doc §2.1 step 10). The only thing the browser is ever given. */
export function buildAuthorizationUrl(
  metadata: Pick<AuthServerMetadata, "authorizationEndpoint">,
  options: {
    clientId: string;
    redirectUri: string;
    challenge: string;
    state: string;
    scope?: string;
    resource: string;
  },
): string {
  const url = new URL(metadata.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("code_challenge", options.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", options.state);
  if (options.scope) url.searchParams.set("scope", options.scope);
  url.searchParams.set("resource", options.resource);
  return url.href;
}

/** Client authentication for a token, refresh or revocation request. */
function clientAuth(
  client: ClientCredentials,
  body: URLSearchParams,
): Record<string, string> {
  body.set("client_id", client.clientId);
  if (client.tokenEndpointAuthMethod === "client_secret_post" && client.clientSecret) {
    body.set("client_secret", client.clientSecret);
    return {};
  }
  if (client.tokenEndpointAuthMethod === "client_secret_basic" && client.clientSecret) {
    // RFC 6749 §2.3.1: form-encode each part before base64.
    const pair = `${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`;
    return { Authorization: `Basic ${btoa(pair)}` };
  }
  return {};
}

/** A token endpoint answer: access token present and `token_type` Bearer (doc §2.4 step 6). */
export function readTokenResponse(json: unknown): TokenSet {
  if (!isObject(json)) throw new OAuthFlowError("token");
  const accessToken = str(json.access_token);
  const tokenType = str(json.token_type);
  if (!accessToken || tokenType?.toLowerCase() !== "bearer") throw new OAuthFlowError("token");
  const refreshToken = str(json.refresh_token);
  const scope = str(json.scope);
  const expiresIn =
    typeof json.expires_in === "number" && Number.isFinite(json.expires_in) && json.expires_in > 0
      ? json.expires_in
      : undefined;
  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(expiresIn !== undefined ? { expiresIn } : {}),
    ...(scope ? { scope } : {}),
  };
}

async function tokenRequest(
  fetchImpl: FetchLike,
  tokenEndpoint: string,
  client: ClientCredentials,
  params: Record<string, string>,
): Promise<TokenSet> {
  const body = new URLSearchParams(params);
  const authHeader = clientAuth(client, body);
  const json = await request(
    fetchImpl,
    tokenEndpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        ...authHeader,
      },
      body: body.toString(),
      redirect: "error",
    },
    OAUTH_LIMITS.timeoutMs,
    async (response) => {
      if (response.status === 200) return readJson(response);
      let code: unknown;
      try {
        const error = await readJson(response);
        code = isObject(error) ? error.error : undefined;
      } catch {
        code = undefined;
      }
      if (code === "invalid_grant") throw new OAuthFlowError("invalid_grant");
      if (code === "invalid_client" || response.status === 401) throw new OAuthFlowError("invalid_client");
      throw new OAuthFlowError("token");
    },
  );
  return readTokenResponse(json);
}

/** Step 5 of doc §2.4: the code for tokens, with the PKCE verifier and `resource`. */
export async function exchangeCode(
  fetchImpl: FetchLike,
  options: {
    tokenEndpoint: string;
    client: ClientCredentials;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string;
  },
): Promise<TokenSet> {
  return tokenRequest(fetchImpl, options.tokenEndpoint, options.client, {
    grant_type: "authorization_code",
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.codeVerifier,
    resource: options.resource,
  });
}

/** Doc §3.3: a refresh with `resource`. A rotated refresh token comes back in the set. */
export async function refreshTokens(
  fetchImpl: FetchLike,
  options: {
    tokenEndpoint: string;
    client: ClientCredentials;
    refreshToken: string;
    resource: string;
  },
): Promise<TokenSet> {
  return tokenRequest(fetchImpl, options.tokenEndpoint, options.client, {
    grant_type: "refresh_token",
    refresh_token: options.refreshToken,
    resource: options.resource,
  });
}

/** RFC 7009 revocation, 5-second timeout. True only on a 200; never throws. */
export async function revokeToken(
  fetchImpl: FetchLike,
  options: {
    revocationEndpoint: string;
    client: ClientCredentials;
    token: string;
    tokenTypeHint: "refresh_token" | "access_token";
  },
): Promise<boolean> {
  const body = new URLSearchParams({ token: options.token, token_type_hint: options.tokenTypeHint });
  const authHeader = clientAuth(options.client, body);
  try {
    return await request(
      fetchImpl,
      options.revocationEndpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...authHeader },
        body: body.toString(),
        redirect: "error",
      },
      OAUTH_LIMITS.revokeTimeoutMs,
      async (response) => {
        await response.body?.cancel().catch(() => {});
        return response.status === 200;
      },
    );
  } catch {
    return false;
  }
}
