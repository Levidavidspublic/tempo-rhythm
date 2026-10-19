import { ConvexError, type Infer, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import { isInactiveAccount } from "./lib/accountDeletion";
import { requireApprovedForAi } from "./lib/aiGate";
import { isApproved, requireApprovedUser } from "./lib/approval";
import {
  type Env,
  EXECUTOR_PROVIDER,
  type ReturnTo,
  callbackRedirect,
  executorConfig,
  executorEnabled,
  isScopedMcpUrl,
  publicHttpsUrl,
  siteOrigin,
} from "./lib/connections/config";
import {
  CONNECTIONS_KEY_VERSION,
  decryptSecret,
  encryptSecret,
  loadConnectionsKey,
  randomBase64Url,
  secretAad,
  sha256Hex,
} from "./lib/connections/crypto";
import { type LookupSummary, summarizeSearchResult } from "./lib/connections/lookup";
import { McpCallError, openMcpSession } from "./lib/connections/mcpClient";
import {
  type AuthServerMetadata,
  type ClientCredentials,
  type FetchLike,
  OAuthFlowError,
  buildAuthorizationUrl,
  chooseScope,
  createPkce,
  createState,
  discoverProtectedResource,
  exchangeCode,
  fetchAuthServerMetadata,
  refreshTokens,
  registerClient,
  revokeToken,
} from "./lib/connections/oauth";
import { coachMayRun, searchArgumentName } from "./lib/connections/policy";
import { resolveUserFromIdentity } from "./lib/requireUser";

/**
 * Connected accounts: a person's own Executor account (TEMPO-B07-07, #989). Design:
 * `docs/research/EXECUTOR-IN-TEMPO.md` §2–§5 (branch `t/977-executor-research`).
 *
 * Public contract:
 * - `list()` and `status({ provider: "executor" })` (approved accounts): what the settings
 *   screen shows. Never a secret. Queries read no clock (C-26): a connect attempt, or new tokens
 *   waiting for their owner's confirm, count as `connecting` while their row is live, and a
 *   scheduled `sweep` retires them when they expire.
 * - `startExecutorConnect({ returnTo? })` (approved accounts): discovery, client registration,
 *   PKCE; returns only the authorization URL. Every attempt counts against the hourly limit
 *   before anything is fetched.
 * - `GET /connections/executor/callback` (connectionsHttp.ts): exchanges the code and stores the
 *   encrypted tokens on a `pending_confirm` connection, then sends the browser to the app with
 *   `?executor=confirm&n=<one-time nonce>`. Nothing can use those tokens yet.
 * - `confirmExecutorConnect({ nonce })` (the signed-in person): the tokens become theirs only when
 *   they are the person who started the connect, still approved, within 10 minutes, and the
 *   attempt started after their latest disconnect; otherwise the tokens are revoked at Executor
 *   and scrubbed. This ties the callback to the person: a link someone else started can't put
 *   your Executor account on their Tempo account. Safe to repeat: the same nonce again (a reply
 *   that got lost) answers "connected" within the nonce's 10 minutes and changes nothing.
 * - `disconnect({ provider: "executor" })` (the signed-in owner, approved or not): moves the
 *   person's cancellation point (`connectionLimits.disconnectGeneration`), so a connect attempt
 *   already past its callback can't stage or confirm afterwards; revokes at Executor when it
 *   offers revocation, then scrubs every ciphertext, whatever the revoke said.
 * - The coach's "Look in my apps" lookup is `coach.lookUpInExecutor`; its Executor half is
 *   `searchExecutorFor` here.
 *
 * Tokens, codes, PKCE verifiers, confirm nonces and client secrets are encrypted or hashed at
 * rest, decrypted only inside actions, and never appear in a return value, a query result, a log
 * line or an error message. The only secret-like value that leaves Convex is the confirm nonce,
 * once, in the redirect to the browser that finished the OAuth step. Log lines name an error's
 * class and kind only. Tokens Tempo stops holding (replaced, refused, dropped) are revoked at
 * Executor first, best effort; so are new tokens it never managed to keep (a staging or a
 * refresh write that failed or was refused).
 *
 * When `TEMPO_EXECUTOR_ENABLED` is not `true`, or `EXECUTOR_MCP_URL`, `TEMPO_CONNECTIONS_KEY`,
 * `SITE_URL` or `CONVEX_SITE_URL` is missing or malformed, Executor is `unavailable`: no connect
 * and no lookup, and nothing fetched for them. Disconnect and account deletion still revoke (with
 * the key and the stored revocation endpoint) and scrub.
 */

/** A connect attempt lives this long (EXTRAPOLATED, doc §2.1 step 9). */
export const PENDING_TTL_MS = 10 * 60_000;
/** New tokens wait this long for their owner's confirm (the confirm nonce's life). */
export const CONFIRM_TTL_MS = 10 * 60_000;
/** Connect attempts per person per hour (EXTRAPOLATED, doc §4.6). */
export const CONNECT_ATTEMPTS_PER_HOUR = 5;
/** Executor calls per person per hour (EXTRAPOLATED, doc §4.6). */
export const CALLS_PER_HOUR = 30;
export const HOUR_MS = 60 * 60_000;
/** One refresh at a time per connection: a lease longer than the refresh request's timeout. */
export const REFRESH_LEASE_MS = 30_000;
/** Refresh before a call when the access token ends within this (doc §3.3). */
export const REFRESH_EARLY_MS = 60_000;
/** A connection still `revoking` this long after it was retired is scrubbed by the sweep. */
export const REVOKE_GRACE_MS = HOUR_MS;
/** Most rows one sweep run handles per kind; a full batch schedules the next run at once. */
export const SWEEP_BATCH = 50;

/** The MCP tool the coach's lookup runs (doc §4.3). */
export const SEARCH_TOOL = "search";

export type ConnectionDeps = {
  fetch: FetchLike;
  env: Env;
  now: () => number;
};

/** Native `fetch`, the deployment's env and the clock. Tests pass stand-ins. */
export function defaultConnectionDeps(): ConnectionDeps {
  return { fetch: (url, init) => fetch(url, init), env: process.env, now: () => Date.now() };
}

export type PublicConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "needs_reauth"
  | "unavailable";

export type ConfirmStatus = "connected" | "expired" | "mismatch" | "error";

const publicStatusValidator = v.union(
  v.literal("not_connected"),
  v.literal("connecting"),
  v.literal("connected"),
  v.literal("needs_reauth"),
  v.literal("unavailable"),
);
const confirmStatusValidator = v.union(
  v.literal("connected"),
  v.literal("expired"),
  v.literal("mismatch"),
  v.literal("error"),
);
const returnToValidator = v.union(v.literal("settings"), v.literal("coach"));
const authMethodValidator = v.union(
  v.literal("none"),
  v.literal("client_secret_basic"),
  v.literal("client_secret_post"),
);
/** What an action needs of the shared OAuth client. Its secret stays a ciphertext. */
const clientMaterialValidator = v.object({
  clientId: v.string(),
  clientSecretCipher: v.optional(v.string()),
  keyVersion: v.number(),
  tokenEndpointAuthMethod: authMethodValidator,
  tokenEndpoint: v.string(),
  revocationEndpoint: v.optional(v.string()),
  issParameterSupported: v.optional(v.boolean()),
  issuer: v.string(),
  redirectUri: v.string(),
});
type ClientMaterial = Infer<typeof clientMaterialValidator>;

type Reader = QueryCtx | MutationCtx;
type Runner = Pick<ActionCtx, "runQuery" | "runMutation">;

// ---------------------------------------------------------------------------
// Ciphertext bindings (lib/connections/crypto.ts `secretAad`)
// ---------------------------------------------------------------------------

function tokenAad(userId: Id<"users">, field: "accessToken" | "refreshToken"): string {
  return secretAad(`${userId}|${EXECUTOR_PROVIDER}`, field);
}

function pendingAad(userId: Id<"users">, stateHash: string): string {
  return secretAad(`${userId}|${EXECUTOR_PROVIDER}|pending:${stateHash}`, "codeVerifier");
}

function clientAad(issuer: string, redirectUri: string): string {
  return secretAad(`oauthClient|${issuer}|${redirectUri}`, "clientSecret");
}

async function clientCredentials(key: CryptoKey, client: ClientMaterial): Promise<ClientCredentials> {
  const clientSecret = client.clientSecretCipher
    ? await decryptSecret(key, client.clientSecretCipher, clientAad(client.issuer, client.redirectUri))
    : undefined;
  return {
    clientId: client.clientId,
    tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
    ...(clientSecret ? { clientSecret } : {}),
  };
}

function clientMaterial(row: Doc<"oauthClients">): ClientMaterial {
  return {
    clientId: row.clientId,
    ...(row.clientSecretCipher ? { clientSecretCipher: row.clientSecretCipher } : {}),
    keyVersion: row.keyVersion,
    tokenEndpointAuthMethod: row.tokenEndpointAuthMethod,
    tokenEndpoint: row.tokenEndpoint,
    ...(row.revocationEndpoint ? { revocationEndpoint: row.revocationEndpoint } : {}),
    ...(row.issParameterSupported !== undefined ? { issParameterSupported: row.issParameterSupported } : {}),
    issuer: row.issuer,
    redirectUri: row.redirectUri,
  };
}

/** An error's class and kind only: never its message's source data, a token or server text. */
export function connectionErrorKind(error: unknown): string {
  if (error instanceof OAuthFlowError || error instanceof McpCallError) {
    return `${error.name}: ${error.kind}`;
  }
  return error instanceof Error ? error.name : typeof error;
}

/**
 * RFC 7009 revocation of tokens Tempo is about to stop holding, best effort: only when the
 * client has a public revocation endpoint. True only when every revoke sent was confirmed.
 */
async function revokeAtProvider(
  fetchImpl: FetchLike,
  revocationEndpoint: string | undefined,
  client: ClientCredentials,
  tokens: Array<{ token: string | undefined; hint: "refresh_token" | "access_token" }>,
): Promise<boolean> {
  const endpoint = publicHttpsUrl(revocationEndpoint);
  const held = tokens.filter((t): t is { token: string; hint: "refresh_token" | "access_token" } => Boolean(t.token));
  if (!endpoint || held.length === 0) return false;
  let all = true;
  for (const { token, hint } of held) {
    const ok = await revokeToken(fetchImpl, { revocationEndpoint: endpoint, client, token, tokenTypeHint: hint });
    all = all && ok;
  }
  return all;
}

/**
 * Newly issued tokens that never reached Tempo's keeping (their staging or refresh write failed
 * or was refused): nothing else would ever hand them back, so revoke those exact tokens at
 * Executor, best effort. Without a public revocation endpoint nothing is sent and the log line
 * names the kind of tokens only. Never throws, so the caller's own error path runs next.
 */
async function revokeUnkept(
  fetchImpl: FetchLike,
  revocationEndpoint: string | undefined,
  client: ClientCredentials,
  issued: { accessToken: string; refreshToken?: string },
): Promise<void> {
  if (!publicHttpsUrl(revocationEndpoint)) {
    console.error(
      issued.refreshToken
        ? "connections: new access and refresh tokens were not kept; Executor offers no revocation"
        : "connections: a new access token was not kept; Executor offers no revocation",
    );
    return;
  }
  try {
    await revokeAtProvider(fetchImpl, revocationEndpoint, client, [
      { token: issued.refreshToken, hint: "refresh_token" },
      { token: issued.accessToken, hint: "access_token" },
    ]);
  } catch (error) {
    console.error(`connections: could not revoke tokens that were not kept (${connectionErrorKind(error)})`);
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The person's live connection rows: at most one usable, plus any waiting for a confirm. */
async function liveConnections(ctx: Reader, userId: Id<"users">): Promise<Doc<"connections">[]> {
  return ctx.db
    .query("connections")
    .withIndex("by_userId_provider_deletedAt", (q) =>
      q.eq("userId", userId).eq("provider", EXECUTOR_PROVIDER).eq("deletedAt", undefined),
    )
    .take(20);
}

/** The live connection that may be used (never one still waiting for its confirm). */
async function activeConnection(ctx: Reader, userId: Id<"users">): Promise<Doc<"connections"> | null> {
  return (await liveConnections(ctx, userId)).find((row) => row.status !== "pending_confirm") ?? null;
}

async function livePendingRows(ctx: Reader, userId: Id<"users">, limit: number) {
  return ctx.db
    .query("oauthPending")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .take(limit);
}

async function secretsOf(ctx: Reader, connectionId: Id<"connections">) {
  return ctx.db
    .query("connectionSecrets")
    .withIndex("by_connectionId", (q) => q.eq("connectionId", connectionId))
    .take(5);
}

function derivedStatus(
  enabled: boolean,
  connection: Doc<"connections"> | null,
  connecting: boolean,
): PublicConnectionStatus {
  if (!enabled) return "unavailable";
  if (connection?.status === "connected") return "connected";
  if (connecting) return "connecting";
  if (connection?.status === "needs_reauth") return "needs_reauth";
  if (connection?.status === "unavailable") return "unavailable";
  return "not_connected";
}

/** The person's Executor state as the public queries show it. `env` is for tests. */
export async function executorView(ctx: Reader, userId: Id<"users">, env: Env = process.env) {
  const enabled = executorEnabled(env);
  const rows = await liveConnections(ctx, userId);
  const connection = rows.find((row) => row.status !== "pending_confirm") ?? null;
  // A connect attempt in flight, or new tokens waiting for the person's confirm.
  const connecting =
    rows.some((row) => row.status === "pending_confirm") || (await livePendingRows(ctx, userId, 1)).length > 0;
  return {
    enabled,
    connection,
    status: derivedStatus(enabled, connection, connecting),
    times: connection
      ? {
          connectedAt: connection.connectedAt,
          ...(connection.lastUsedAt !== undefined ? { lastUsedAt: connection.lastUsedAt } : {}),
        }
      : {},
  };
}

/**
 * Every provider Tempo can connect (today only Executor), with its state for the signed-in
 * person. Never a token, code, client id or secret.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      provider: v.literal("executor"),
      status: publicStatusValidator,
      connectedAt: v.optional(v.number()),
      lastUsedAt: v.optional(v.number()),
      accountLabel: v.optional(v.string()),
      scoped: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    const view = await executorView(ctx, user._id);
    return [
      {
        provider: EXECUTOR_PROVIDER,
        status: view.status,
        ...view.times,
        ...(view.connection?.accountLabel ? { accountLabel: view.connection.accountLabel } : {}),
        scoped: view.connection ? isScopedMcpUrl(view.connection.mcpUrl) : false,
      },
    ];
  },
});

/**
 * The Executor connection's state. `enabled` is false when the deployment has Executor off or
 * misconfigured; the status is then `unavailable`. Tokens waiting for the person's confirm show
 * as `connecting`.
 */
export const status = query({
  args: { provider: v.literal("executor") },
  returns: v.object({
    status: publicStatusValidator,
    connectedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
    enabled: v.boolean(),
  }),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    const view = await executorView(ctx, user._id);
    return { status: view.status, ...view.times, enabled: view.enabled };
  },
});

// ---------------------------------------------------------------------------
// Per-person limits
// ---------------------------------------------------------------------------

/**
 * Counts one connect attempt or one Executor call in the person's fixed one-hour window
 * (`connectionLimits`, one row per person). False when the window is full. The row is read even
 * when tombstoned, so neither a reconnect nor a restored account resets the window.
 */
async function countInWindow(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "connect" | "call",
  max: number,
  now: number,
): Promise<boolean> {
  const row = await ctx.db
    .query("connectionLimits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  const start = kind === "connect" ? row?.connectWindowStartMs : row?.callWindowStartMs;
  const count = kind === "connect" ? row?.connectWindowCount : row?.callWindowCount;
  const inWindow = start !== undefined && now - start < HOUR_MS;
  const used = inWindow ? (count ?? 0) : 0;
  if (used >= max) {
    return false;
  }
  const windowStart = inWindow && start !== undefined ? start : now;
  const fields =
    kind === "connect"
      ? { connectWindowStartMs: windowStart, connectWindowCount: used + 1 }
      : { callWindowStartMs: windowStart, callWindowCount: used + 1 };
  if (row) {
    await ctx.db.patch(row._id, { ...fields, updatedAt: now });
  } else {
    await ctx.db.insert("connectionLimits", { userId, ...fields, createdAt: now, updatedAt: now });
  }
  return true;
}

/**
 * The person's cancellation point: how many disconnects they have made (`connectionLimits`, read
 * even when tombstoned; missing reads as 0). A connect attempt carries the number it started
 * under through its pending row and its staged connection; one below this is never staged or
 * confirmed, so a disconnect also cancels a callback that is already past its pending row.
 */
async function disconnectGeneration(ctx: Reader, userId: Id<"users">): Promise<number> {
  const row = await ctx.db
    .query("connectionLimits")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  return row?.disconnectGeneration ?? 0;
}

/** True when a disconnect came after the attempt that started under `startGeneration`. */
async function cancelledByDisconnect(
  ctx: Reader,
  userId: Id<"users">,
  startGeneration: number | undefined,
): Promise<boolean> {
  return (startGeneration ?? 0) < (await disconnectGeneration(ctx, userId));
}

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

/**
 * Counts one connect attempt for the approved caller before anything is fetched, so failing
 * attempts (discovery, registration) are limited too. "rate_limited" past
 * `CONNECT_ATTEMPTS_PER_HOUR` in the hour. "ok" carries the person's disconnect generation now:
 * the attempt's start, which its pending row and staged connection keep.
 */
export const reserveConnectAttempt = internalMutation({
  args: {},
  returns: v.union(
    v.object({ status: v.literal("ok"), userId: v.id("users"), startGeneration: v.number() }),
    v.object({ status: v.literal("rate_limited") }),
  ),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    const ok = await countInWindow(ctx, user._id, "connect", CONNECT_ATTEMPTS_PER_HOUR, Date.now());
    return ok
      ? { status: "ok" as const, userId: user._id, startGeneration: await disconnectGeneration(ctx, user._id) }
      : { status: "rate_limited" as const };
  },
});

const endpointsValidator = v.object({
  authorizationEndpoint: v.string(),
  tokenEndpoint: v.string(),
  registrationEndpoint: v.optional(v.string()),
  revocationEndpoint: v.optional(v.string()),
  issParameterSupported: v.boolean(),
});

/**
 * The shared OAuth client for an issuer and redirect URI. With a live row: refreshes its
 * endpoints from today's metadata and returns it. Without one: inserts `registration` when given
 * (the first registration wins a race; a later one gets the stored row), else returns null.
 */
export const upsertOAuthClient = internalMutation({
  args: {
    issuer: v.string(),
    redirectUri: v.string(),
    endpoints: endpointsValidator,
    registration: v.optional(
      v.object({
        clientId: v.string(),
        clientSecretCipher: v.optional(v.string()),
        keyVersion: v.number(),
        tokenEndpointAuthMethod: authMethodValidator,
      }),
    ),
  },
  returns: v.union(v.null(), v.object({ clientRowId: v.id("oauthClients"), client: clientMaterialValidator })),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("oauthClients")
      .withIndex("by_issuer_redirectUri", (q) => q.eq("issuer", args.issuer).eq("redirectUri", args.redirectUri))
      .take(10);
    const live = existing.find((row) => row.deletedAt === undefined);
    const endpoints = {
      authorizationEndpoint: args.endpoints.authorizationEndpoint,
      tokenEndpoint: args.endpoints.tokenEndpoint,
      registrationEndpoint: args.endpoints.registrationEndpoint,
      revocationEndpoint: args.endpoints.revocationEndpoint,
      issParameterSupported: args.endpoints.issParameterSupported,
    };
    if (live) {
      await ctx.db.patch(live._id, { ...endpoints, updatedAt: now });
      const row = (await ctx.db.get(live._id)) as Doc<"oauthClients">;
      return { clientRowId: live._id, client: clientMaterial(row) };
    }
    if (!args.registration) return null;
    const id = await ctx.db.insert("oauthClients", {
      issuer: args.issuer,
      redirectUri: args.redirectUri,
      clientId: args.registration.clientId,
      ...(args.registration.clientSecretCipher ? { clientSecretCipher: args.registration.clientSecretCipher } : {}),
      keyVersion: args.registration.keyVersion,
      tokenEndpointAuthMethod: args.registration.tokenEndpointAuthMethod,
      ...endpoints,
      codeChallengeS256: true,
      createdAt: now,
      updatedAt: now,
    });
    const row = (await ctx.db.get(id)) as Doc<"oauthClients">;
    return { clientRowId: id, client: clientMaterial(row) };
  },
});

/**
 * Retires a shared client the authorization server no longer knows (`invalid_client`), so the
 * next connect registers a new one. A tombstone, not a delete; connections that used it need a
 * reconnect.
 */
export const retireOAuthClient = internalMutation({
  args: { clientRowId: v.id("oauthClients") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.clientRowId);
    if (row && row.deletedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(row._id, { deletedAt: now, updatedAt: now });
    }
    return null;
  },
});

/** Saves one connect attempt (doc §2.1 step 9) and schedules the sweep for when it expires. */
export const createPending = internalMutation({
  args: {
    userId: v.id("users"),
    stateHash: v.string(),
    codeVerifierCipher: v.string(),
    keyVersion: v.number(),
    issuer: v.string(),
    resource: v.string(),
    redirectUri: v.string(),
    clientRowId: v.id("oauthClients"),
    returnTo: returnToValidator,
    startGeneration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + PENDING_TTL_MS;
    await ctx.db.insert("oauthPending", {
      userId: args.userId,
      provider: EXECUTOR_PROVIDER,
      stateHash: args.stateHash,
      codeVerifierCipher: args.codeVerifierCipher,
      keyVersion: args.keyVersion,
      issuer: args.issuer,
      resource: args.resource,
      redirectUri: args.redirectUri,
      clientRowId: args.clientRowId,
      returnTo: args.returnTo,
      startGeneration: args.startGeneration,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    // No cron (see `sweep`): the attempt schedules its own expiry.
    await ctx.scheduler.runAt(expiresAt + 1_000, internal.connections.sweep, {});
    return null;
  },
});

function unavailableError(): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code: "unavailable", message: "Executor isn't available right now. Nothing changed." });
}

function rateLimitedError(): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code: "rate_limited", message: "That's a lot of connect attempts. Try again in a bit." });
}

async function ensureClient(
  ctx: Runner,
  deps: ConnectionDeps,
  key: CryptoKey,
  redirectUri: string,
  clientUri: string,
  metadata: AuthServerMetadata,
): Promise<{ clientRowId: Id<"oauthClients">; client: ClientMaterial }> {
  const endpoints = {
    authorizationEndpoint: metadata.authorizationEndpoint,
    tokenEndpoint: metadata.tokenEndpoint,
    ...(metadata.registrationEndpoint ? { registrationEndpoint: metadata.registrationEndpoint } : {}),
    ...(metadata.revocationEndpoint ? { revocationEndpoint: metadata.revocationEndpoint } : {}),
    issParameterSupported: metadata.issParameterSupported,
  };
  const stored = await ctx.runMutation(internal.connections.upsertOAuthClient, {
    issuer: metadata.issuer,
    redirectUri,
    endpoints,
  });
  if (stored) return stored;
  const registered = await registerClient(deps.fetch, metadata, { redirectUri, clientUri });
  const clientSecretCipher = registered.clientSecret
    ? await encryptSecret(key, registered.clientSecret, clientAad(metadata.issuer, redirectUri))
    : undefined;
  const saved = await ctx.runMutation(internal.connections.upsertOAuthClient, {
    issuer: metadata.issuer,
    redirectUri,
    endpoints,
    registration: {
      clientId: registered.clientId,
      ...(clientSecretCipher ? { clientSecretCipher } : {}),
      keyVersion: CONNECTIONS_KEY_VERSION,
      tokenEndpointAuthMethod: registered.tokenEndpointAuthMethod,
    },
  });
  if (!saved) throw new OAuthFlowError("registration");
  return saved;
}

/**
 * `startExecutorConnect` (doc §2.1 steps 3–10). Approval first, then the switch (with Executor
 * unavailable nothing is fetched), then the attempt is counted; only then discovery. Failures
 * throw `ConvexError` `{ code: "unavailable" | "rate_limited" }` with Tempo's own words; the log
 * line names the failed step's kind only.
 */
export async function startExecutorConnectFlow(
  ctx: Runner,
  args: { returnTo?: ReturnTo },
  deps: ConnectionDeps,
): Promise<{ authorizationUrl: string }> {
  await requireApprovedForAi(ctx as ActionCtx);
  const config = executorConfig(deps.env);
  const key = config ? await loadConnectionsKey(deps.env) : null;
  if (!config || !key) {
    throw unavailableError();
  }
  const attempt = await ctx.runMutation(internal.connections.reserveConnectAttempt, {});
  if (attempt.status !== "ok") {
    throw rateLimitedError();
  }
  try {
    const resource = await discoverProtectedResource(deps.fetch, config.mcpUrl);
    const metadata = await fetchAuthServerMetadata(deps.fetch, resource.issuer);
    const { clientRowId, client } = await ensureClient(
      ctx,
      deps,
      key,
      config.redirectUri,
      config.siteOrigin,
      metadata,
    );
    const state = createState();
    const pkce = await createPkce();
    const stateHash = await sha256Hex(state);
    await ctx.runMutation(internal.connections.createPending, {
      userId: attempt.userId,
      stateHash,
      codeVerifierCipher: await encryptSecret(key, pkce.verifier, pendingAad(attempt.userId, stateHash)),
      keyVersion: CONNECTIONS_KEY_VERSION,
      issuer: metadata.issuer,
      resource: config.mcpUrl,
      redirectUri: config.redirectUri,
      clientRowId,
      returnTo: args.returnTo ?? "settings",
      startGeneration: attempt.startGeneration,
    });
    const scope = chooseScope(resource.resourceScope, metadata);
    return {
      authorizationUrl: buildAuthorizationUrl(metadata, {
        clientId: client.clientId,
        redirectUri: config.redirectUri,
        challenge: pkce.challenge,
        state,
        ...(scope ? { scope } : {}),
        resource: config.mcpUrl,
      }),
    };
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    console.error(`connections.startExecutorConnect: could not start (${connectionErrorKind(error)})`);
    throw unavailableError();
  }
}

export const startExecutorConnect = action({
  args: { returnTo: v.optional(returnToValidator) },
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx, args): Promise<{ authorizationUrl: string }> =>
    startExecutorConnectFlow(ctx, args, defaultConnectionDeps()),
});

// ---------------------------------------------------------------------------
// Callback (connectionsHttp.ts) and confirm
// ---------------------------------------------------------------------------

/** Scrubs and tombstones a person's live connect attempts. */
async function cancelPending(ctx: MutationCtx, userId: Id<"users">, now: number): Promise<number> {
  const rows = await livePendingRows(ctx, userId, 50);
  for (const row of rows) {
    await ctx.db.patch(row._id, { codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
  }
  return rows.length;
}

/**
 * Doc §2.4 steps 1–2: finds the attempt by the SHA-256 of `state` and spends it in this same
 * transaction, before any network call: marks it used, scrubs the verifier from the row and
 * tombstones it. Returns what the code exchange needs (the verifier still encrypted). A missing,
 * used or expired attempt, or one a later disconnect cancelled, is "expired"; a deleted or no
 * longer approved account, or a missing client, is "error" (and no code is exchanged).
 */
export const consumePending = internalMutation({
  args: { stateHash: v.string() },
  returns: v.union(
    v.object({ status: v.literal("expired"), returnTo: v.optional(returnToValidator) }),
    v.object({ status: v.literal("error"), returnTo: returnToValidator }),
    v.object({
      status: v.literal("ok"),
      userId: v.id("users"),
      returnTo: returnToValidator,
      issuer: v.string(),
      resource: v.string(),
      redirectUri: v.string(),
      stateHash: v.string(),
      codeVerifierCipher: v.string(),
      clientRowId: v.id("oauthClients"),
      client: clientMaterialValidator,
      startGeneration: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const row = await ctx.db
      .query("oauthPending")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", args.stateHash))
      .first();
    if (!row) {
      return { status: "expired" as const };
    }
    if (row.deletedAt !== undefined || row.usedAt !== undefined || !row.codeVerifierCipher) {
      return { status: "expired" as const, returnTo: row.returnTo };
    }
    if (row.expiresAt <= now) {
      await ctx.db.patch(row._id, { codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
      return { status: "expired" as const, returnTo: row.returnTo };
    }
    // One use only: spent before anything is sent anywhere.
    await ctx.db.patch(row._id, { usedAt: now, codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
    const user = await ctx.db.get(row.userId);
    const client = await ctx.db.get(row.clientRowId);
    if (!user || isInactiveAccount(user) || !isApproved(user) || !client || client.deletedAt !== undefined) {
      return { status: "error" as const, returnTo: row.returnTo };
    }
    if (await cancelledByDisconnect(ctx, row.userId, row.startGeneration)) {
      // The person disconnected after this attempt started: no code is exchanged for it.
      return { status: "expired" as const, returnTo: row.returnTo };
    }
    return {
      status: "ok" as const,
      userId: row.userId,
      returnTo: row.returnTo,
      issuer: row.issuer,
      resource: row.resource,
      redirectUri: row.redirectUri,
      stateHash: row.stateHash,
      codeVerifierCipher: row.codeVerifierCipher,
      clientRowId: row.clientRowId,
      client: clientMaterial(client),
      startGeneration: row.startGeneration ?? 0,
    };
  },
});

/**
 * Doc §2.4 step 7, made safe against a link someone else started: the encrypted tokens go on a
 * new `pending_confirm` connection that nothing can use, with the SHA-256 of a one-time confirm
 * nonce and a 10-minute life. The account's current connection is untouched until the confirm.
 * Cancels any other open connect attempt and schedules the sweep for the nonce's expiry. False
 * when the account is gone, inactive or no longer approved, or when the person disconnected after
 * this attempt started (the caller then revokes the tokens).
 */
export const stageTokens = internalMutation({
  args: {
    userId: v.id("users"),
    issuer: v.string(),
    mcpUrl: v.string(),
    clientRowId: v.id("oauthClients"),
    scope: v.optional(v.string()),
    accessTokenCipher: v.string(),
    refreshTokenCipher: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    keyVersion: v.number(),
    confirmNonceHash: v.string(),
    startGeneration: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || isInactiveAccount(user) || !isApproved(user)) {
      return false;
    }
    if (await cancelledByDisconnect(ctx, args.userId, args.startGeneration)) {
      return false;
    }
    const now = Date.now();
    const confirmExpiresAt = now + CONFIRM_TTL_MS;
    const connectionId = await ctx.db.insert("connections", {
      userId: args.userId,
      provider: EXECUTOR_PROVIDER,
      status: "pending_confirm",
      mcpUrl: args.mcpUrl,
      issuer: args.issuer,
      clientRowId: args.clientRowId,
      ...(args.scope ? { scope: args.scope } : {}),
      connectedAt: now,
      confirmNonceHash: args.confirmNonceHash,
      confirmExpiresAt,
      startGeneration: args.startGeneration,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("connectionSecrets", {
      userId: args.userId,
      connectionId,
      accessTokenCipher: args.accessTokenCipher,
      ...(args.refreshTokenCipher ? { refreshTokenCipher: args.refreshTokenCipher } : {}),
      ...(args.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: args.accessTokenExpiresAt } : {}),
      keyVersion: args.keyVersion,
      createdAt: now,
      updatedAt: now,
    });
    await cancelPending(ctx, args.userId, now);
    await ctx.scheduler.runAt(confirmExpiresAt + 1_000, internal.connections.sweep, {});
    return true;
  },
});

/**
 * The callback (doc §2.4), as a plain function over a request so tests can drive it. Every
 * answer is `no-store` with no referrer, and every redirect goes to a fixed path on `SITE_URL`.
 * Success sends `?executor=confirm&n=<nonce>`: the app then calls `confirmExecutorConnect` as the
 * signed-in person. Failures send `?executor=denied|expired|error`. Never a code, a state or a
 * token.
 */
export async function handleExecutorCallback(
  ctx: Runner,
  request: Request,
  deps: ConnectionDeps,
): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  const origin = siteOrigin(deps.env.SITE_URL);
  if (!origin) {
    console.error("connections.callback: SITE_URL is missing or invalid");
    return new Response("Tempo couldn't finish connecting Executor. You can close this page.", {
      status: 503,
      headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const redirect = (returnTo: ReturnTo, result: "confirm" | "denied" | "expired" | "error", nonce?: string) =>
    new Response(null, {
      status: 302,
      headers: { ...headers, Location: callbackRedirect(origin, returnTo, result, nonce) },
    });

  const config = executorConfig(deps.env);
  const key = config ? await loadConnectionsKey(deps.env) : null;
  if (!config || !key) {
    return redirect("settings", "error");
  }
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  if (!state || state.length > 512) {
    return redirect("settings", "expired");
  }
  // 1–2. Find the attempt by the hash of `state` and spend it.
  const pending = await ctx.runMutation(internal.connections.consumePending, {
    stateHash: await sha256Hex(state),
  });
  if (pending.status !== "ok") {
    return redirect(pending.returnTo ?? "settings", pending.status);
  }
  const back = (result: "denied" | "error") => redirect(pending.returnTo, result);
  // 3. `iss` (RFC 9207): plain string comparison with the recorded issuer; absent is refused
  // only when the server says it sends it.
  const iss = params.get("iss");
  if (iss !== null ? iss !== pending.issuer : pending.client.issParameterSupported === true) {
    console.error("connections.callback: the issuer did not match");
    return back("error");
  }
  // 4. The person said no (or the server failed). Its text is never shown or logged.
  if (params.get("error") !== null) {
    return back("denied");
  }
  const code = params.get("code");
  if (!code || code.length > 4096) {
    return back("error");
  }
  try {
    const codeVerifier = await decryptSecret(key, pending.codeVerifierCipher, pendingAad(pending.userId, pending.stateHash));
    const client = await clientCredentials(key, pending.client);
    // 5–6. The exchange, with the verifier and `resource`; Bearer checked in readTokenResponse.
    let tokens: Awaited<ReturnType<typeof exchangeCode>>;
    try {
      tokens = await exchangeCode(deps.fetch, {
        tokenEndpoint: pending.client.tokenEndpoint,
        client,
        code,
        redirectUri: pending.redirectUri,
        codeVerifier,
        resource: pending.resource,
      });
    } catch (error) {
      if (error instanceof OAuthFlowError && error.kind === "invalid_client") {
        // The server no longer knows Tempo's client: the next connect registers a new one.
        await ctx.runMutation(internal.connections.retireOAuthClient, { clientRowId: pending.clientRowId });
      }
      throw error;
    }
    // 7. Encrypt and stage them until the person confirms. Tokens that were not staged (the
    // encryption or the write threw, or the account or a disconnect refused them) belong to
    // nobody: hand them back to Executor at once (best effort), then take the error path.
    let nonce: string | null = null;
    try {
      const candidate = randomBase64Url(32);
      const now = deps.now();
      const staged = await ctx.runMutation(internal.connections.stageTokens, {
        userId: pending.userId,
        issuer: pending.issuer,
        mcpUrl: pending.resource,
        clientRowId: pending.clientRowId,
        ...(tokens.scope ? { scope: tokens.scope } : {}),
        accessTokenCipher: await encryptSecret(key, tokens.accessToken, tokenAad(pending.userId, "accessToken")),
        ...(tokens.refreshToken
          ? { refreshTokenCipher: await encryptSecret(key, tokens.refreshToken, tokenAad(pending.userId, "refreshToken")) }
          : {}),
        ...(tokens.expiresIn !== undefined ? { accessTokenExpiresAt: now + tokens.expiresIn * 1000 } : {}),
        keyVersion: CONNECTIONS_KEY_VERSION,
        confirmNonceHash: await sha256Hex(candidate),
        startGeneration: pending.startGeneration,
      });
      if (staged) nonce = candidate;
    } finally {
      if (!nonce) await revokeUnkept(deps.fetch, pending.client.revocationEndpoint, client, tokens);
    }
    if (!nonce) {
      return back("error");
    }
    return redirect(pending.returnTo, "confirm", nonce);
  } catch (error) {
    console.error(`connections.callback: could not finish (${connectionErrorKind(error)})`);
    return back("error");
  }
}

/** The signed-in person, whatever their approval or active state; throws when signed out. */
async function signedInPerson(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  const user = identity ? await resolveUserFromIdentity(ctx, identity) : null;
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/** Retires a connection row: `revoking`, tombstoned, nonce and lease dropped. Its revoke runs next. */
async function retireConnection(ctx: MutationCtx, row: Doc<"connections">, now: number): Promise<void> {
  await ctx.db.patch(row._id, {
    status: "revoking",
    confirmNonceHash: undefined,
    confirmExpiresAt: undefined,
    refreshLeaseUntil: undefined,
    refreshLeaseToken: undefined,
    deletedAt: row.deletedAt ?? now,
    updatedAt: now,
  });
}

/**
 * The confirm (M2 of the #989 review). Finds the staged connection by the nonce's hash.
 * "connected" only when the signed-in person started this connect, is still active and approved,
 * the nonce is under 10 minutes old, and no disconnect came after the attempt started; their
 * previous connection (and any other staged one) is then retired for revoking. Otherwise the
 * staged tokens are retired: "expired" (unknown, late or cancelled by a disconnect), "mismatch"
 * (another person), "error" (the owner is no longer active or approved). `revoke` lists the rows
 * the action revokes and scrubs.
 *
 * Idempotent: a confirmed row keeps the nonce's hash until the nonce's own `confirmExpiresAt`
 * (never longer; `expireConfirmNonce` clears it then), so the same nonce again from its owner (a
 * retry after a lost reply) answers "connected" and changes nothing. From anyone else, or after
 * that time, it is "expired" and still changes nothing.
 */
export const confirmStaged = internalMutation({
  args: { nonceHash: v.string() },
  returns: v.object({ status: confirmStatusValidator, revoke: v.array(v.id("connections")) }),
  handler: async (ctx, args) => {
    const user = await signedInPerson(ctx);
    const row = await ctx.db
      .query("connections")
      .withIndex("by_confirmNonceHash", (q) => q.eq("confirmNonceHash", args.nonceHash))
      .first();
    if (!row || row.deletedAt !== undefined) {
      return { status: "expired" as const, revoke: [] };
    }
    const now = Date.now();
    if (row.status !== "pending_confirm") {
      // Only a live row this nonce already confirmed still carries its hash: a repeated confirm.
      const repeat = row.userId === user._id && (row.confirmExpiresAt ?? 0) > now;
      return { status: repeat ? ("connected" as const) : ("expired" as const), revoke: [] };
    }
    const refused: ConfirmStatus | null =
      (row.confirmExpiresAt ?? 0) <= now
        ? "expired"
        : row.userId !== user._id
          ? "mismatch"
          : isInactiveAccount(user) || !isApproved(user)
            ? "error"
            : (await cancelledByDisconnect(ctx, user._id, row.startGeneration))
              ? "expired"
              : null;
    if (refused) {
      await retireConnection(ctx, row, now);
      await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
      return { status: refused, revoke: [row._id] };
    }
    const others = (await liveConnections(ctx, user._id)).filter((other) => other._id !== row._id);
    for (const other of others) {
      await retireConnection(ctx, other, now);
    }
    // The nonce's hash and expiry stay until that expiry, for a repeated confirm; then they go.
    await ctx.db.patch(row._id, {
      status: "connected",
      connectedAt: now,
      lastErrorAt: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAt((row.confirmExpiresAt ?? now) + 1_000, internal.connections.expireConfirmNonce, {
      connectionId: row._id,
    });
    if (others.length > 0) {
      await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
    }
    return { status: "connected" as const, revoke: others.map((other) => other._id) };
  },
});

/** Clears a confirmed row's nonce hash once the nonce's 10 minutes are over (scheduled by the confirm). */
export const expireConfirmNonce = internalMutation({
  args: { connectionId: v.id("connections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    const now = Date.now();
    if (row && row.status !== "pending_confirm" && row.confirmNonceHash !== undefined && (row.confirmExpiresAt ?? 0) <= now) {
      await ctx.db.patch(row._id, { confirmNonceHash: undefined, confirmExpiresAt: undefined, updatedAt: now });
    }
    return null;
  },
});

/** `confirmExecutorConnect` as a plain function over its seams, for tests. */
export async function confirmExecutorConnectFlow(
  ctx: Runner,
  args: { nonce: string },
  deps: ConnectionDeps,
): Promise<{ status: ConfirmStatus }> {
  const nonce = args.nonce.trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    return { status: "expired" };
  }
  const result = await ctx.runMutation(internal.connections.confirmStaged, { nonceHash: await sha256Hex(nonce) });
  // Refused tokens, and the connection a confirm replaced, are revoked at Executor and scrubbed.
  for (const connectionId of result.revoke) {
    await revokeAndScrub(ctx, connectionId, deps);
  }
  return { status: result.status };
}

/**
 * The app calls this with `n` from `?executor=confirm&n=<nonce>`, as the signed-in person. Returns
 * `{ status: "connected" | "expired" | "mismatch" | "error" }`; on anything but "connected" the
 * new tokens are already revoked and scrubbed. Throws only when nobody is signed in. Safe to call
 * again with the same nonce when a reply was lost: within the nonce's 10 minutes its owner gets
 * "connected" again and nothing is created or retired twice.
 */
export const confirmExecutorConnect = action({
  args: { nonce: v.string() },
  returns: v.object({ status: confirmStatusValidator }),
  handler: async (ctx, args): Promise<{ status: ConfirmStatus }> =>
    confirmExecutorConnectFlow(ctx, args, defaultConnectionDeps()),
});

// ---------------------------------------------------------------------------
// Calls: tokens, refresh, rate limit, audit
// ---------------------------------------------------------------------------

/**
 * What one Executor call needs (doc §5.4 `secretsForCall`): the usable connection (never one
 * waiting for its confirm), its ciphertexts (decrypted in the action) and the OAuth client.
 */
export const secretsForCall = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({ status: v.literal("not_connected") }),
    v.object({ status: v.literal("needs_reauth") }),
    v.object({
      status: v.literal("ok"),
      connectionId: v.id("connections"),
      mcpUrl: v.string(),
      accessTokenCipher: v.optional(v.string()),
      refreshTokenCipher: v.optional(v.string()),
      accessTokenExpiresAt: v.optional(v.number()),
      client: clientMaterialValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const connection = await activeConnection(ctx, args.userId);
    if (!connection || (connection.status !== "connected" && connection.status !== "unavailable")) {
      return connection?.status === "needs_reauth"
        ? { status: "needs_reauth" as const }
        : { status: "not_connected" as const };
    }
    const secrets = (await secretsOf(ctx, connection._id)).find((row) => row.deletedAt === undefined);
    const client = await ctx.db.get(connection.clientRowId);
    if (!secrets || !client || client.deletedAt !== undefined) {
      return { status: "needs_reauth" as const };
    }
    return {
      status: "ok" as const,
      connectionId: connection._id,
      mcpUrl: connection.mcpUrl,
      ...(secrets.accessTokenCipher ? { accessTokenCipher: secrets.accessTokenCipher } : {}),
      ...(secrets.refreshTokenCipher ? { refreshTokenCipher: secrets.refreshTokenCipher } : {}),
      ...(secrets.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: secrets.accessTokenExpiresAt } : {}),
      client: clientMaterial(client),
    };
  },
});

/**
 * Counts one call against the person's `CALLS_PER_HOUR` window (`connectionLimits`, per person,
 * so a reconnect does not reset it). "gone" when the connection is no longer live and usable.
 */
export const reserveCall = internalMutation({
  args: { connectionId: v.id("connections") },
  returns: v.union(v.literal("ok"), v.literal("rate_limited"), v.literal("gone")),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || (row.status !== "connected" && row.status !== "unavailable")) {
      return "gone" as const;
    }
    const ok = await countInWindow(ctx, row.userId, "call", CALLS_PER_HOUR, Date.now());
    return ok ? ("ok" as const) : ("rate_limited" as const);
  },
});

/** Takes the refresh lease (doc §3.3): one refresh at a time; a second caller gets "busy". */
export const claimRefresh = internalMutation({
  args: { connectionId: v.id("connections") },
  returns: v.union(
    v.object({ status: v.literal("claimed"), leaseToken: v.string() }),
    v.object({ status: v.literal("busy") }),
    v.object({ status: v.literal("gone") }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || (row.status !== "connected" && row.status !== "unavailable")) {
      return { status: "gone" as const };
    }
    const now = Date.now();
    if (row.refreshLeaseUntil !== undefined && row.refreshLeaseUntil > now) {
      return { status: "busy" as const };
    }
    const leaseToken = crypto.randomUUID();
    await ctx.db.patch(row._id, { refreshLeaseUntil: now + REFRESH_LEASE_MS, refreshLeaseToken: leaseToken, updatedAt: now });
    return { status: "claimed" as const, leaseToken };
  },
});

/** Gives the lease back after a failed refresh. Only its own lease. */
export const releaseRefresh = internalMutation({
  args: { connectionId: v.id("connections"), leaseToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (row && row.refreshLeaseToken === args.leaseToken) {
      await ctx.db.patch(row._id, { refreshLeaseUntil: undefined, refreshLeaseToken: undefined, updatedAt: Date.now() });
    }
    return null;
  },
});

/**
 * Stores refreshed tokens and releases the lease, only while this refresh still holds it. A
 * refresh token is replaced only when the server sent a new one (rotation, doc §3.3).
 */
export const storeRefreshed = internalMutation({
  args: {
    connectionId: v.id("connections"),
    leaseToken: v.string(),
    accessTokenCipher: v.string(),
    refreshTokenCipher: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || row.refreshLeaseToken !== args.leaseToken) {
      return false;
    }
    const secrets = (await secretsOf(ctx, row._id)).find((s) => s.deletedAt === undefined);
    if (!secrets) {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch(secrets._id, {
      accessTokenCipher: args.accessTokenCipher,
      ...(args.refreshTokenCipher ? { refreshTokenCipher: args.refreshTokenCipher } : {}),
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      keyVersion: CONNECTIONS_KEY_VERSION,
      updatedAt: now,
    });
    await ctx.db.patch(row._id, {
      refreshLeaseUntil: undefined,
      refreshLeaseToken: undefined,
      ...(args.scope ? { scope: args.scope } : {}),
      updatedAt: now,
    });
    return true;
  },
});

/**
 * `needs_reauth` (refresh refused, a second 401, a changed MCP URL, unreadable ciphertexts) scrubs
 * the tokens; the caller revokes them at Executor first when it can. `unavailable` (timeout, 5xx)
 * keeps them; the next success sets `connected` again.
 */
export const markStatus = internalMutation({
  args: { connectionId: v.id("connections"), status: v.union(v.literal("needs_reauth"), v.literal("unavailable")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || row.status === "needs_reauth" || row.status === "pending_confirm") {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: args.status,
      lastErrorAt: now,
      // An `unavailable` mark leaves a refresh another lookup may be running alone.
      ...(args.status === "needs_reauth" ? { refreshLeaseUntil: undefined, refreshLeaseToken: undefined } : {}),
      updatedAt: now,
    });
    if (args.status === "needs_reauth") {
      for (const secrets of await secretsOf(ctx, row._id)) {
        await ctx.db.patch(secrets._id, {
          accessTokenCipher: undefined,
          refreshTokenCipher: undefined,
          accessTokenExpiresAt: undefined,
          updatedAt: now,
        });
      }
    }
    return null;
  },
});

const decisionValidator = v.union(
  v.literal("auto"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("blocked"),
);
const outcomeValidator = v.union(
  v.literal("ok"),
  v.literal("error"),
  v.literal("approval_required"),
  v.literal("timeout"),
  v.literal("rate_limited"),
  v.literal("unauthorized"),
);

/**
 * The audit row for one Executor tool call (doc §4.5): content-free. An `ok` call also stamps
 * `lastUsedAt` and puts an `unavailable` connection back to `connected`.
 */
export const recordCall = internalMutation({
  args: {
    connectionId: v.id("connections"),
    tool: v.string(),
    decision: decisionValidator,
    outcome: outcomeValidator,
    inputDigest: v.optional(v.string()),
    resultBytes: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), v.id("connectionCalls")),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row) {
      return null;
    }
    const now = Date.now();
    const id = await ctx.db.insert("connectionCalls", {
      userId: row.userId,
      connectionId: row._id,
      kind: "tool_call",
      tool: args.tool,
      decision: args.decision,
      outcome: args.outcome,
      ...(args.inputDigest ? { inputDigest: args.inputDigest } : {}),
      ...(args.resultBytes !== undefined ? { resultBytes: args.resultBytes } : {}),
      ...(args.durationMs !== undefined ? { durationMs: args.durationMs } : {}),
      createdAt: now,
      updatedAt: now,
    });
    if (args.outcome === "ok" && row.deletedAt === undefined) {
      await ctx.db.patch(row._id, {
        lastUsedAt: now,
        ...(row.status === "unavailable" ? { status: "connected" as const, lastErrorAt: undefined } : {}),
        updatedAt: now,
      });
    }
    return id;
  },
});

export type ExecutorSearchOutcome =
  | { status: "ok"; summary: LookupSummary; callId: Id<"connectionCalls"> | null }
  | { status: "not_connected" | "needs_reauth" | "unavailable" | "rate_limited" | "busy" };

type SearchRun =
  | { kind: "ok"; result: Record<string, unknown>; isError: boolean; bytes: number }
  | { kind: "blocked" }
  | { kind: "unsupported" };

/**
 * One `search` session: `tools/list` first, so the policy sees the tool's own annotations
 * (doc §4.1), then `tools/call`. Any tool other than an auto `search` is refused here.
 */
async function runSearch(fetchImpl: FetchLike, mcpUrl: string, accessToken: string, query: string): Promise<SearchRun> {
  const session = openMcpSession(fetchImpl, { url: mcpUrl, accessToken });
  try {
    const tools = await session.listTools();
    const tool = tools.find((t) => t.name === SEARCH_TOOL);
    if (!tool || !coachMayRun(tool.name, tool.annotations)) {
      return { kind: "blocked" };
    }
    const argument = searchArgumentName(tool.inputSchema);
    if (!argument) {
      return { kind: "unsupported" };
    }
    return { kind: "ok", ...(await session.callTool(tool.name, { [argument]: query })) };
  } finally {
    session.close();
  }
}

/**
 * The Executor half of "Look in my apps" (doc §4.3): approval and the conversation are the
 * caller's (`coach.runExecutorLookup`). With Executor unavailable nothing is fetched. Then: the
 * usable connection, the per-person limit, a refresh if the token is about to end (one at a
 * time), one `search` with a 15-second deadline, one retry on a network error, one
 * refresh-and-retry on a 401, and an audit row. Tokens dropped for `needs_reauth` are revoked at
 * Executor first (best effort). Only a summary of the answer comes back: no raw results.
 */
export async function searchExecutorFor(
  ctx: Runner,
  userId: Id<"users">,
  query: string,
  deps: ConnectionDeps,
): Promise<ExecutorSearchOutcome> {
  const config = executorConfig(deps.env);
  const key = config ? await loadConnectionsKey(deps.env) : null;
  if (!config || !key) {
    return { status: "unavailable" };
  }
  const material = await ctx.runQuery(internal.connections.secretsForCall, { userId });
  if (material.status !== "ok") {
    return { status: material.status };
  }
  const connectionId = material.connectionId;
  const started = deps.now();
  const inputDigest = await sha256Hex(JSON.stringify({ tool: SEARCH_TOOL, arguments: { query } }));
  const audit = (
    decision: "auto" | "blocked",
    outcome: "ok" | "error" | "timeout" | "rate_limited" | "unauthorized",
    resultBytes?: number,
  ) =>
    ctx.runMutation(internal.connections.recordCall, {
      connectionId,
      tool: SEARCH_TOOL,
      decision,
      outcome,
      inputDigest,
      ...(resultBytes !== undefined ? { resultBytes } : {}),
      durationMs: Math.max(0, deps.now() - started),
    });

  let accessToken: string | undefined;
  let refreshToken: string | undefined;
  let client: ClientCredentials;
  try {
    accessToken = material.accessTokenCipher
      ? await decryptSecret(key, material.accessTokenCipher, tokenAad(userId, "accessToken"))
      : undefined;
    refreshToken = material.refreshTokenCipher
      ? await decryptSecret(key, material.refreshTokenCipher, tokenAad(userId, "refreshToken"))
      : undefined;
    client = await clientCredentials(key, material.client);
  } catch (error) {
    // Unreadable ciphertexts (for example a changed key): nothing to revoke; the person reconnects.
    console.error(`connections.search: tokens could not be read (${connectionErrorKind(error)})`);
    await audit("auto", "unauthorized");
    await ctx.runMutation(internal.connections.markStatus, { connectionId, status: "needs_reauth" });
    return { status: "needs_reauth" };
  }

  /** Revoke what Tempo still holds (best effort), then drop it: the person signs in again. */
  const reauth = async (): Promise<ExecutorSearchOutcome> => {
    await revokeAtProvider(deps.fetch, material.client.revocationEndpoint, client, [
      { token: refreshToken, hint: "refresh_token" },
      { token: accessToken, hint: "access_token" },
    ]);
    await ctx.runMutation(internal.connections.markStatus, { connectionId, status: "needs_reauth" });
    return { status: "needs_reauth" };
  };
  const unavailable = async (outcome: "error" | "timeout", markConnection: boolean): Promise<ExecutorSearchOutcome> => {
    if (markConnection) {
      await ctx.runMutation(internal.connections.markStatus, { connectionId, status: "unavailable" });
    }
    await audit("auto", outcome);
    return { status: "unavailable" };
  };

  if (material.mcpUrl !== config.mcpUrl) {
    // Tokens are bound to the URL they were issued for (doc §1.5): a new URL needs a reconnect.
    return reauth();
  }
  const reserved = await ctx.runMutation(internal.connections.reserveCall, { connectionId });
  if (reserved !== "ok") {
    return { status: reserved === "rate_limited" ? "rate_limited" : "not_connected" };
  }

  /** A fresh access token, or the outcome to stop with. */
  const refresh = async (): Promise<string | ExecutorSearchOutcome> => {
    if (!refreshToken) {
      await audit("auto", "unauthorized");
      return reauth();
    }
    const lease = await ctx.runMutation(internal.connections.claimRefresh, { connectionId });
    if (lease.status !== "claimed") {
      return { status: lease.status === "busy" ? "busy" : "not_connected" };
    }
    let tokens: Awaited<ReturnType<typeof refreshTokens>>;
    try {
      tokens = await refreshTokens(deps.fetch, {
        tokenEndpoint: material.client.tokenEndpoint,
        client,
        refreshToken,
        resource: material.mcpUrl,
      });
    } catch (error) {
      await ctx.runMutation(internal.connections.releaseRefresh, { connectionId, leaseToken: lease.leaseToken });
      console.error(`connections.search: the refresh failed (${connectionErrorKind(error)})`);
      if (error instanceof OAuthFlowError && error.kind === "invalid_client") {
        // The server no longer knows Tempo's client: retire it so the next connect registers again.
        const clientRow = await ctx.runQuery(internal.connections.clientRowOf, { connectionId });
        if (clientRow) await ctx.runMutation(internal.connections.retireOAuthClient, { clientRowId: clientRow });
        await audit("auto", "unauthorized");
        return reauth();
      }
      if (error instanceof OAuthFlowError && error.kind === "invalid_grant") {
        await audit("auto", "unauthorized");
        return reauth();
      }
      return unavailable(error instanceof OAuthFlowError && error.kind === "timeout" ? "timeout" : "error", true);
    }
    const now = deps.now();
    let stored = false;
    try {
      stored = await ctx.runMutation(internal.connections.storeRefreshed, {
        connectionId,
        leaseToken: lease.leaseToken,
        accessTokenCipher: await encryptSecret(key, tokens.accessToken, tokenAad(userId, "accessToken")),
        ...(tokens.refreshToken
          ? { refreshTokenCipher: await encryptSecret(key, tokens.refreshToken, tokenAad(userId, "refreshToken")) }
          : {}),
        ...(tokens.expiresIn !== undefined ? { accessTokenExpiresAt: now + tokens.expiresIn * 1000 } : {}),
        ...(tokens.scope ? { scope: tokens.scope } : {}),
      });
    } finally {
      // Not kept (the connection was retired, the lease was lost, or the write threw): revoke the
      // tokens this refresh just got, and only those; the stored ones stay as they are.
      if (!stored) await revokeUnkept(deps.fetch, material.client.revocationEndpoint, client, tokens);
    }
    if (!stored) {
      return { status: "busy" };
    }
    refreshToken = tokens.refreshToken ?? refreshToken;
    return tokens.accessToken;
  };

  let refreshed = false;
  if (
    !accessToken ||
    (material.accessTokenExpiresAt !== undefined && material.accessTokenExpiresAt - started < REFRESH_EARLY_MS)
  ) {
    const next = await refresh();
    if (typeof next !== "string") return next;
    accessToken = next;
    refreshed = true;
  }

  let retriedNetwork = false;
  for (;;) {
    let run: SearchRun;
    try {
      run = await runSearch(deps.fetch, material.mcpUrl, accessToken, query);
    } catch (error) {
      const kind = error instanceof McpCallError ? error.kind : "bad_response";
      console.error(`connections.search: the call failed (${connectionErrorKind(error)})`);
      if (kind === "unauthorized" && !refreshed) {
        // One refresh and one retry (doc §3.3). A 401 on a token refreshed during this lookup
        // counts as the second one: the person signs in again.
        const next = await refresh();
        if (typeof next !== "string") return next;
        accessToken = next;
        refreshed = true;
        continue;
      }
      if (kind === "unauthorized" || kind === "insufficient_scope") {
        await audit("auto", "unauthorized");
        return reauth();
      }
      if (kind === "network" && !retriedNetwork) {
        // `search` is read-only, so one retry is safe.
        retriedNetwork = true;
        continue;
      }
      if (kind === "rate_limited") {
        await audit("auto", "rate_limited");
        return { status: "rate_limited" };
      }
      if (kind === "timeout") return unavailable("timeout", true);
      return unavailable("error", kind === "network" || kind === "upstream");
    }
    if (run.kind === "blocked") {
      console.error("connections.search: the search tool is not read-only here, so it was refused");
      await audit("blocked", "error");
      return { status: "unavailable" };
    }
    if (run.kind === "unsupported" || run.isError) {
      return unavailable("error", false);
    }
    const summary = summarizeSearchResult(run.result);
    if (!summary) {
      console.error("connections.search: the search answer could not be read");
      return unavailable("error", false);
    }
    const callId = await audit("auto", "ok", run.bytes);
    return { status: "ok", summary, callId };
  }
}

/** The OAuth client row a connection uses. */
export const clientRowOf = internalQuery({
  args: { connectionId: v.id("connections") },
  returns: v.union(v.null(), v.id("oauthClients")),
  handler: async (ctx, args) => (await ctx.db.get(args.connectionId))?.clientRowId ?? null,
});

// ---------------------------------------------------------------------------
// Disconnect, account deletion, sweep
// ---------------------------------------------------------------------------

/**
 * Scrubs one connection: every ciphertext goes to undefined, the secrets row and the connection
 * are tombstoned, the status is `disconnected`, and an audit row says whether Executor confirmed
 * the revoke. Never a hard delete.
 */
async function scrubConnection(
  ctx: MutationCtx,
  connection: Doc<"connections">,
  now: number,
  revokedAtProvider: boolean,
): Promise<void> {
  for (const secrets of await secretsOf(ctx, connection._id)) {
    await ctx.db.patch(secrets._id, {
      accessTokenCipher: undefined,
      refreshTokenCipher: undefined,
      accessTokenExpiresAt: undefined,
      deletedAt: secrets.deletedAt ?? now,
      updatedAt: now,
    });
  }
  await ctx.db.patch(connection._id, {
    status: "disconnected",
    revokedAtProvider,
    confirmNonceHash: undefined,
    confirmExpiresAt: undefined,
    refreshLeaseUntil: undefined,
    refreshLeaseToken: undefined,
    deletedAt: connection.deletedAt ?? now,
    updatedAt: now,
  });
  const user = await ctx.db.get(connection.userId);
  await ctx.db.insert("connectionCalls", {
    userId: connection.userId,
    connectionId: connection._id,
    kind: "disconnect",
    outcome: revokedAtProvider ? "revoked" : "not_revoked",
    createdAt: now,
    updatedAt: now,
    // The audit row of a deleted account is born tombstoned, like the rest of its data.
    ...(user && !isInactiveAccount(user) ? {} : { deletedAt: now }),
  });
}

/**
 * Disconnect step 1 (doc §2.5), for the signed-in owner whatever their approval (a revoked or
 * deactivated person can still take their tokens back). The person's disconnect generation goes
 * up by one, so an attempt that started before now can't stage or confirm later (even one whose
 * callback already spent its pending row). Every live connection row, including one waiting for
 * its confirm, becomes `revoking` and is tombstoned at once (the person sees "not connected");
 * open connect attempts are cancelled; the sweep is scheduled in case a revoke never finishes. A
 * deleted account has nothing live left (account deletion retired it).
 */
export const beginDisconnect = internalMutation({
  args: {},
  returns: v.array(v.id("connections")),
  handler: async (ctx) => {
    const user = await signedInPerson(ctx);
    const now = Date.now();
    const limits = await ctx.db
      .query("connectionLimits")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const generation = (limits?.disconnectGeneration ?? 0) + 1;
    if (limits) {
      await ctx.db.patch(limits._id, { disconnectGeneration: generation, updatedAt: now });
    } else {
      await ctx.db.insert("connectionLimits", {
        userId: user._id,
        disconnectGeneration: generation,
        createdAt: now,
        updatedAt: now,
      });
    }
    await cancelPending(ctx, user._id, now);
    const rows = await liveConnections(ctx, user._id);
    for (const row of rows) {
      await retireConnection(ctx, row, now);
    }
    if (rows.length > 0) {
      await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
    }
    return rows.map((row) => row._id);
  },
});

/** What a revoke needs for one `revoking` connection: ciphertexts and the client. Else null. */
export const revokeMaterial = internalQuery({
  args: { connectionId: v.id("connections") },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      accessTokenCipher: v.optional(v.string()),
      refreshTokenCipher: v.optional(v.string()),
      client: v.optional(clientMaterialValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.status !== "revoking") {
      return null;
    }
    const secrets = (await secretsOf(ctx, connection._id)).find(
      (row) => row.accessTokenCipher !== undefined || row.refreshTokenCipher !== undefined,
    );
    const client = await ctx.db.get(connection.clientRowId);
    return {
      userId: connection.userId,
      ...(secrets?.accessTokenCipher ? { accessTokenCipher: secrets.accessTokenCipher } : {}),
      ...(secrets?.refreshTokenCipher ? { refreshTokenCipher: secrets.refreshTokenCipher } : {}),
      ...(client ? { client: clientMaterial(client) } : {}),
    };
  },
});

/** A revoke's last step: scrub, whatever the revoke said. Only a `revoking` connection. */
export const finishRevoke = internalMutation({
  args: { connectionId: v.id("connections"), revokedAtProvider: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection && connection.status === "revoking") {
      await scrubConnection(ctx, connection, Date.now(), args.revokedAtProvider);
    }
    return null;
  },
});

/**
 * Revokes the refresh token, then the access token, at the client's revocation endpoint (RFC
 * 7009, 5 s each) when the key is set and Executor offers one; then scrubs. Runs even with
 * `TEMPO_EXECUTOR_ENABLED` off: the switch stops new connects and lookups, not giving tokens back.
 * True only when every revoke sent was confirmed.
 */
async function revokeAndScrub(ctx: Runner, connectionId: Id<"connections">, deps: ConnectionDeps): Promise<boolean> {
  const material = await ctx.runQuery(internal.connections.revokeMaterial, { connectionId });
  let revoked = false;
  const key = material?.client ? await loadConnectionsKey(deps.env) : null;
  if (material?.client && key) {
    try {
      const client = await clientCredentials(key, material.client);
      revoked = await revokeAtProvider(deps.fetch, material.client.revocationEndpoint, client, [
        {
          token: material.refreshTokenCipher
            ? await decryptSecret(key, material.refreshTokenCipher, tokenAad(material.userId, "refreshToken"))
            : undefined,
          hint: "refresh_token",
        },
        {
          token: material.accessTokenCipher
            ? await decryptSecret(key, material.accessTokenCipher, tokenAad(material.userId, "accessToken"))
            : undefined,
          hint: "access_token",
        },
      ]);
    } catch (error) {
      console.error(`connections.revoke: could not revoke (${connectionErrorKind(error)})`);
      revoked = false;
    }
  }
  await ctx.runMutation(internal.connections.finishRevoke, { connectionId, revokedAtProvider: revoked });
  return revoked;
}

/** `disconnect` as a plain function over its seams, for tests. */
export async function disconnectFlow(
  ctx: Runner,
  deps: ConnectionDeps,
): Promise<{ status: "disconnected"; revokedAtProvider: boolean }> {
  const retired = await ctx.runMutation(internal.connections.beginDisconnect, {});
  let revokedAtProvider = retired.length > 0;
  for (const connectionId of retired) {
    const revoked = await revokeAndScrub(ctx, connectionId, deps);
    revokedAtProvider = revokedAtProvider && revoked;
  }
  return { status: "disconnected", revokedAtProvider };
}

export const disconnect = action({
  args: { provider: v.literal("executor") },
  returns: v.object({ status: v.literal("disconnected"), revokedAtProvider: v.boolean() }),
  handler: async (ctx): Promise<{ status: "disconnected"; revokedAtProvider: boolean }> =>
    disconnectFlow(ctx, defaultConnectionDeps()),
});

/** One retired connection's revoke and scrub, scheduled by the sweep for expired confirms. */
export const revokeConnection = internalAction({
  args: { connectionId: v.id("connections") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await revokeAndScrub(ctx, args.connectionId, defaultConnectionDeps());
    return null;
  },
});

/** The person's connections waiting for a revoke, through `by_userId_status` (no scan limit). */
export const revokingConnections = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(v.id("connections")),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "revoking"))
      .take(SWEEP_BATCH);
    return rows.map((row) => row._id);
  },
});

/** Account deletion, after the fact (doc §3.4): revoke at Executor, then scrub. */
export async function revokeForAccountDeletionFlow(
  ctx: Runner,
  userId: Id<"users">,
  deps: ConnectionDeps,
): Promise<number> {
  const ids = await ctx.runQuery(internal.connections.revokingConnections, { userId });
  for (const connectionId of ids) {
    await revokeAndScrub(ctx, connectionId, deps);
  }
  return ids.length;
}

export const revokeForAccountDeletion = internalAction({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await revokeForAccountDeletionFlow(ctx, args.userId, defaultConnectionDeps());
    return null;
  },
});

/**
 * Called by `users.deleteMyAccount` right after `softDeleteUserAccount` (which marks the
 * person's live connections `revoking` and scrubs connect attempts, and itself never schedules):
 * schedules the revoke now and the sweep for when the grace hour is over.
 */
export async function scheduleConnectionRevokes(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const revoking = await ctx.db
    .query("connections")
    .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "revoking"))
    .first();
  if (!revoking) {
    return false;
  }
  await ctx.scheduler.runAfter(0, internal.connections.revokeForAccountDeletion, { userId });
  await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
  return true;
}

/**
 * The sweep (doc §5.4), idempotent and bounded (a full batch runs again at once):
 * - expired connect attempts lose their verifier and are tombstoned;
 * - tokens whose confirm never came are retired and their revoke is scheduled;
 * - connections still `revoking` an hour after they were retired are scrubbed without a revoke.
 *
 * Not a cron: `convex/pageCleanup.test.ts` holds the app to exactly one cron job, so each connect
 * attempt and each staged confirm schedules the sweep for its own expiry, and each retirement for
 * the end of its grace hour. The effect matches an hourly sweep for every row that needs one.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.object({ pendingScrubbed: v.number(), confirmsExpired: v.number(), connectionsScrubbed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("oauthPending")
      .withIndex("by_deletedAt_expiresAt", (q) => q.eq("deletedAt", undefined).lt("expiresAt", now))
      .take(SWEEP_BATCH);
    for (const row of expired) {
      await ctx.db.patch(row._id, { codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
    }
    const unconfirmed = (
      await ctx.db
        .query("connections")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "pending_confirm").lt("updatedAt", now - CONFIRM_TTL_MS + 1))
        .take(SWEEP_BATCH)
    ).filter((row) => (row.confirmExpiresAt ?? 0) <= now);
    for (const row of unconfirmed) {
      await retireConnection(ctx, row, now);
      await ctx.scheduler.runAfter(0, internal.connections.revokeConnection, { connectionId: row._id });
    }
    if (unconfirmed.length > 0) {
      await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
    }
    const stuck = await ctx.db
      .query("connections")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "revoking").lt("updatedAt", now - REVOKE_GRACE_MS))
      .take(SWEEP_BATCH);
    for (const connection of stuck) {
      await scrubConnection(ctx, connection, now, false);
    }
    if (expired.length === SWEEP_BATCH || unconfirmed.length === SWEEP_BATCH || stuck.length === SWEEP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.connections.sweep, {});
    }
    return { pendingScrubbed: expired.length, confirmsExpired: unconfirmed.length, connectionsScrubbed: stuck.length };
  },
});
