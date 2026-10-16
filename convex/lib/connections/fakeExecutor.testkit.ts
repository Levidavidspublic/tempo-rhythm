/**
 * Test kit (TEMPO-B07-07, #989): an in-memory stand-in for an Executor deployment, served
 * through a `fetch`-shaped function. No network. The file name has two dots, so Convex's bundler
 * skips it (it is not a function module) and `bun test` does not run it.
 *
 * Every "secret" here is a recognizable fake string, so a test can assert it never shows up in a
 * return value, a log line, a stored row or a redirect.
 */
import { createHash } from "node:crypto";
import type { FetchLike } from "./oauth";

export const FAKE = {
  mcpUrl: "https://mcp.executor.test/mcp",
  prm: "https://mcp.executor.test/.well-known/oauth-protected-resource/mcp",
  prmRoot: "https://mcp.executor.test/.well-known/oauth-protected-resource",
  issuer: "https://auth.executor.test",
  asMetadata: "https://auth.executor.test/.well-known/oauth-authorization-server",
  oidcMetadata: "https://auth.executor.test/.well-known/openid-configuration",
  authorize: "https://auth.executor.test/oauth2/authorize",
  token: "https://auth.executor.test/oauth2/token",
  register: "https://auth.executor.test/oauth2/register",
  revoke: "https://auth.executor.test/oauth2/revoke",
  clientId: "tempo-client-1",
  sessionId: "fake-session-1",
} as const;

/** Fake secret values. None is real; each is easy to grep for. */
export const SECRETS = {
  clientSecret: "FAKE-CLIENT-SECRET-cs111",
  code: "FAKE-AUTH-CODE-cd222",
  access1: "FAKE-ACCESS-TOKEN-at333",
  refresh1: "FAKE-REFRESH-TOKEN-rt444",
  access2: "FAKE-ACCESS-TOKEN-at555",
  refresh2: "FAKE-REFRESH-TOKEN-rt666",
} as const;

export const SEARCH_TOOL_DEF = {
  name: "search",
  description: "Find Executor app tools by words in their paths, descriptions and labels.",
  inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  annotations: { readOnlyHint: true, destructiveHint: false },
};

/** A search answer in the shape guessed for Executor 2 (UNKNOWN in reality). */
export const SEARCH_RESULT = {
  content: [
    {
      type: "text",
      text: JSON.stringify({
        items: [
          { path: "google_calendar.events.list", description: "List events", app: { name: "Google Calendar" } },
          { path: "google_calendar.events.get", description: "Get an event", app: { name: "Google Calendar" } },
          { path: "google_calendar.events.create", description: "Create an event", app: { name: "Google Calendar" } },
          { path: "gmail.messages.list", description: "List mail", app: { name: "Gmail" } },
        ],
      }),
    },
  ],
};

export type FakeExecutorOptions = {
  /** 401 names the PRM in WWW-Authenticate (default true). */
  challengeHeader?: boolean;
  scopeInChallenge?: string;
  prmResource?: string;
  metadataIssuer?: string;
  s256?: boolean;
  registration?: boolean;
  authMethods?: string[];
  revocation?: boolean;
  issSupported?: boolean;
  scopesSupported?: string[];
  /** OAuth error code the code exchange answers with. */
  tokenError?: string;
  tokenType?: string;
  /** OAuth error code a refresh answers with. */
  refreshError?: string;
  expiresIn?: number;
  /** MCP tools/list answer. */
  tools?: unknown[];
  /** MCP tools/call result for `search`. */
  searchResult?: unknown;
  /** Answer MCP requests as an event stream. */
  sse?: boolean;
  /** Answer the next N authenticated MCP requests with 401. */
  unauthorizedTimes?: number;
  /** Fail the next N authenticated MCP requests at the network level. */
  networkFailures?: number;
  /** Answer authenticated MCP requests with this status. */
  mcpStatus?: number;
  /** Never answer authenticated MCP requests (until the caller aborts). */
  mcpHang?: boolean;
};

export type RecordedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

function headersOf(init?: RequestInit): Record<string, string> {
  const out: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  return out;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** An Executor stand-in. `calls` records every request; `options` can be changed between steps. */
export function fakeExecutor(initial: FakeExecutorOptions = {}) {
  const options: FakeExecutorOptions = { ...initial };
  const calls: RecordedCall[] = [];
  const validAccess = new Set<string>();
  const validRefresh = new Set<string>();
  const revoked: Array<{ token: string; hint: string | null }> = [];
  let expectedChallenge: string | null = null;
  let registrations = 0;
  let refreshes = 0;

  const fetchImpl: FetchLike = async (url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = headersOf(init);
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ url, method, headers, body });
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");

    if (url === FAKE.mcpUrl && method === "POST") {
      const auth = headers.authorization;
      if (!auth) {
        const challenge: Record<string, string> =
          options.challengeHeader === false
            ? {}
            : {
                "WWW-Authenticate": `Bearer resource_metadata="${FAKE.prm}"${
                  options.scopeInChallenge ? `, scope="${options.scopeInChallenge}"` : ""
                }`,
              };
        return json(401, { error: "unauthorized" }, challenge);
      }
      if (options.networkFailures && options.networkFailures > 0) {
        options.networkFailures -= 1;
        throw new TypeError("fetch failed");
      }
      if (options.mcpHang) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }
      const token = auth.replace(/^Bearer\s+/i, "");
      if (options.unauthorizedTimes && options.unauthorizedTimes > 0) {
        options.unauthorizedTimes -= 1;
        return json(401, { error: "invalid_token" }, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      }
      if (!validAccess.has(token)) {
        return json(401, { error: "invalid_token" }, { "WWW-Authenticate": 'Bearer error="invalid_token"' });
      }
      if (options.mcpStatus) {
        return json(options.mcpStatus, { error: "nope" });
      }
      const rpc = JSON.parse(body) as { id?: number; method: string; params?: Record<string, unknown> };
      if (rpc.id === undefined) {
        return new Response(null, { status: 202 });
      }
      let answer: unknown;
      if (rpc.method === "initialize") {
        answer = {
          jsonrpc: "2.0",
          id: rpc.id,
          result: { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "fake-executor" } },
        };
      } else if (rpc.method === "tools/list") {
        answer = { jsonrpc: "2.0", id: rpc.id, result: { tools: options.tools ?? [SEARCH_TOOL_DEF] } };
      } else if (rpc.method === "tools/call" && rpc.params?.name === "search") {
        answer = { jsonrpc: "2.0", id: rpc.id, result: options.searchResult ?? SEARCH_RESULT };
      } else {
        answer = { jsonrpc: "2.0", id: rpc.id, error: { code: -32601, message: "no such tool" } };
      }
      const extra: Record<string, string> = rpc.method === "initialize" ? { "Mcp-Session-Id": FAKE.sessionId } : {};
      if (options.sse) {
        const text = `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{}}\n\nevent: message\ndata: ${JSON.stringify(answer)}\n\n`;
        return new Response(text, { status: 200, headers: { "Content-Type": "text/event-stream", ...extra } });
      }
      return json(200, answer, extra);
    }

    if ((url === FAKE.prm || url === FAKE.prmRoot) && method === "GET") {
      if (url === FAKE.prmRoot && options.challengeHeader !== false) return json(404, {});
      return json(200, {
        resource: options.prmResource ?? FAKE.mcpUrl,
        authorization_servers: [FAKE.issuer],
        ...(options.scopesSupported ? { scopes_supported: options.scopesSupported } : {}),
      });
    }

    if (url === FAKE.asMetadata && method === "GET") {
      return json(200, {
        issuer: options.metadataIssuer ?? FAKE.issuer,
        authorization_endpoint: FAKE.authorize,
        token_endpoint: FAKE.token,
        ...(options.registration === false ? {} : { registration_endpoint: FAKE.register }),
        ...(options.revocation === false ? {} : { revocation_endpoint: FAKE.revoke }),
        code_challenge_methods_supported: options.s256 === false ? ["plain"] : ["S256"],
        token_endpoint_auth_methods_supported: options.authMethods ?? ["client_secret_basic", "none"],
        scopes_supported: ["openid", "offline_access"],
        ...(options.issSupported ? { authorization_response_iss_parameter_supported: true } : {}),
      });
    }

    if (url === FAKE.register && method === "POST") {
      registrations += 1;
      const request = JSON.parse(body) as { token_endpoint_auth_method?: string };
      const method = request.token_endpoint_auth_method ?? "none";
      return json(201, {
        client_id: FAKE.clientId,
        ...(method === "none" ? {} : { client_secret: SECRETS.clientSecret }),
        token_endpoint_auth_method: method,
      });
    }

    if (url === FAKE.token && method === "POST") {
      const form = new URLSearchParams(body);
      if (form.get("grant_type") === "authorization_code") {
        if (options.tokenError) return json(400, { error: options.tokenError, error_description: "SERVER-TEXT" });
        const verifier = form.get("code_verifier") ?? "";
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        if (form.get("code") !== SECRETS.code || (expectedChallenge !== null && challenge !== expectedChallenge)) {
          return json(400, { error: "invalid_grant" });
        }
        validAccess.add(SECRETS.access1);
        validRefresh.add(SECRETS.refresh1);
        return json(200, {
          access_token: SECRETS.access1,
          token_type: options.tokenType ?? "Bearer",
          refresh_token: SECRETS.refresh1,
          ...(options.expiresIn !== undefined ? { expires_in: options.expiresIn } : { expires_in: 3600 }),
          scope: "openid offline_access",
        });
      }
      if (form.get("grant_type") === "refresh_token") {
        refreshes += 1;
        if (options.refreshError) return json(400, { error: options.refreshError });
        const refresh = form.get("refresh_token") ?? "";
        if (!validRefresh.has(refresh)) return json(400, { error: "invalid_grant" });
        validRefresh.delete(refresh);
        validAccess.add(SECRETS.access2);
        validRefresh.add(SECRETS.refresh2);
        return json(200, {
          access_token: SECRETS.access2,
          token_type: "Bearer",
          refresh_token: SECRETS.refresh2,
          expires_in: 3600,
        });
      }
      return json(400, { error: "unsupported_grant_type" });
    }

    if (url === FAKE.revoke && method === "POST") {
      const form = new URLSearchParams(body);
      const token = form.get("token") ?? "";
      revoked.push({ token, hint: form.get("token_type_hint") });
      validAccess.delete(token);
      validRefresh.delete(token);
      return new Response(null, { status: 200 });
    }

    return json(404, { error: "not found" });
  };

  return {
    fetch: fetchImpl,
    calls,
    options,
    revoked,
    /** The S256 challenge the next code exchange must match (from the authorization URL). */
    expectChallenge(challenge: string) {
      expectedChallenge = challenge;
    },
    issue(access: string, refresh?: string) {
      validAccess.add(access);
      if (refresh) validRefresh.add(refresh);
    },
    get registrations() {
      return registrations;
    },
    get refreshes() {
      return refreshes;
    },
    /** Requests that reached the MCP endpoint with a bearer token. */
    mcpCalls() {
      return calls.filter((c) => c.url === FAKE.mcpUrl && c.headers.authorization);
    },
    /** JSON-RPC methods of the authenticated MCP requests, in order. */
    mcpMethods() {
      return this.mcpCalls().map((c) => (JSON.parse(c.body) as { method: string }).method);
    },
  };
}

export type FakeExecutor = ReturnType<typeof fakeExecutor>;
