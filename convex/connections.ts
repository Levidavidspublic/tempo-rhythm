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
  siteOrigin,
} from "./lib/connections/config";
import {
  CONNECTIONS_KEY_VERSION,
  decryptSecret,
  encryptSecret,
  loadConnectionsKey,
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

/**
 * Connected accounts: a person's own Executor account (TEMPO-B07-07, #989). Design:
 * `docs/research/EXECUTOR-IN-TEMPO.md` §2–§5 (branch `t/977-executor-research`).
 *
 * Public contract (approved accounts only):
 * - `list()` and `status({ provider: "executor" })`: what the settings screen shows. Never a
 *   secret. Queries read no clock (C-26): a connect attempt counts as `connecting` while its
 *   pending row is live, and a scheduled `sweep` tombstones it when it expires.
 * - `startExecutorConnect({ returnTo? })`: discovery, client registration, PKCE; returns only
 *   the authorization URL.
 * - `disconnect({ provider: "executor" })`: revokes at Executor when it offers revocation, then
 *   scrubs every ciphertext Tempo holds, whatever the revoke said.
 * - The OAuth callback is `GET /connections/executor/callback` (connectionsHttp.ts).
 * - The coach's "Look in my apps" lookup is `coach.lookUpInExecutor`; its Executor half is
 *   `searchExecutorFor` here.
 *
 * Tokens, codes, PKCE verifiers and client secrets are encrypted at rest
 * (lib/connections/crypto.ts), decrypted only inside actions, and never appear in a return value,
 * a query result, a log line, an error message or the redirect back to the web app. Log lines
 * name an error's class and kind only.
 *
 * When `TEMPO_EXECUTOR_ENABLED` is not `true`, or `EXECUTOR_MCP_URL`, `TEMPO_CONNECTIONS_KEY`,
 * `SITE_URL` or `CONVEX_SITE_URL` is missing or malformed, Executor is `unavailable`: nothing
 * calls out (no `fetch`). Disconnect and account deletion still scrub, without revoking.
 */

/** A connect attempt lives this long (EXTRAPOLATED, doc §2.1 step 9). */
export const PENDING_TTL_MS = 10 * 60_000;
/** Connect attempts per person per hour (EXTRAPOLATED, doc §4.6). */
export const CONNECT_ATTEMPTS_PER_HOUR = 5;
/** Executor calls per person per hour (EXTRAPOLATED, doc §4.6). */
export const CALLS_PER_HOUR = 30;
export const HOUR_MS = 60 * 60_000;
/** One refresh at a time per connection: a lease longer than the refresh request's timeout. */
export const REFRESH_LEASE_MS = 30_000;
/** Refresh before a call when the access token ends within this (doc §3.3). */
export const REFRESH_EARLY_MS = 60_000;
/** A connection still `revoking` this long after disconnect or account deletion is scrubbed by the sweep. */
export const REVOKE_GRACE_MS = HOUR_MS;
/** Most rows one sweep run handles; a full batch schedules the next run at once. */
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

const publicStatusValidator = v.union(
  v.literal("not_connected"),
  v.literal("connecting"),
  v.literal("connected"),
  v.literal("needs_reauth"),
  v.literal("unavailable"),
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

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function liveConnection(ctx: Reader, userId: Id<"users">): Promise<Doc<"connections"> | null> {
  return ctx.db
    .query("connections")
    .withIndex("by_userId_provider_deletedAt", (q) =>
      q.eq("userId", userId).eq("provider", EXECUTOR_PROVIDER).eq("deletedAt", undefined),
    )
    .first();
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
  const connection = await liveConnection(ctx, userId);
  const connecting = (await livePendingRows(ctx, userId, 1)).length > 0;
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
 * misconfigured; the status is then `unavailable`.
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
// Connect
// ---------------------------------------------------------------------------

/** The approved caller and how many connect attempts they have left this hour. */
export const connectContext = internalQuery({
  args: { now: v.number() },
  returns: v.object({ userId: v.id("users"), attemptsLeft: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const recent = await ctx.db
      .query("oauthPending")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id).gte("createdAt", args.now - HOUR_MS))
      .take(CONNECT_ATTEMPTS_PER_HOUR);
    return { userId: user._id, attemptsLeft: Math.max(0, CONNECT_ATTEMPTS_PER_HOUR - recent.length) };
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
 * The shared OAuth client for an issuer and redirect URI. With an existing row: refreshes its
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
 * Saves one connect attempt (doc §2.1 step 9) and schedules the sweep for when it expires.
 * "rate_limited" when the person already started `CONNECT_ATTEMPTS_PER_HOUR` this hour.
 */
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
  },
  returns: v.union(v.literal("created"), v.literal("rate_limited")),
  handler: async (ctx, args) => {
    const now = Date.now();
    const recent = await ctx.db
      .query("oauthPending")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId).gte("createdAt", now - HOUR_MS))
      .take(CONNECT_ATTEMPTS_PER_HOUR);
    if (recent.length >= CONNECT_ATTEMPTS_PER_HOUR) {
      return "rate_limited" as const;
    }
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
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    // No cron (see `sweep`): the attempt schedules its own expiry.
    await ctx.scheduler.runAt(expiresAt + 1_000, internal.connections.sweep, {});
    return "created" as const;
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
 * `startExecutorConnect` (doc §2.1 steps 3–10). Approval first, then the switch; with Executor
 * unavailable nothing is fetched. Failures throw `ConvexError` `{ code: "unavailable" |
 * "rate_limited" }` with Tempo's own words; the log line names the failed step's kind only.
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
  const context = await ctx.runQuery(internal.connections.connectContext, { now: deps.now() });
  if (context.attemptsLeft <= 0) {
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
    const created = await ctx.runMutation(internal.connections.createPending, {
      userId: context.userId,
      stateHash,
      codeVerifierCipher: await encryptSecret(key, pkce.verifier, pendingAad(context.userId, stateHash)),
      keyVersion: CONNECTIONS_KEY_VERSION,
      issuer: metadata.issuer,
      resource: config.mcpUrl,
      redirectUri: config.redirectUri,
      clientRowId,
      returnTo: args.returnTo ?? "settings",
    });
    if (created === "rate_limited") {
      throw rateLimitedError();
    }
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
// Callback (connectionsHttp.ts)
// ---------------------------------------------------------------------------

/** Scrubs and tombstones a person's live connect attempts (all of them, or all but `keep`). */
async function cancelPending(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
  keep?: Id<"oauthPending">,
): Promise<number> {
  const rows = await livePendingRows(ctx, userId, 50);
  let count = 0;
  for (const row of rows) {
    if (row._id === keep) continue;
    await ctx.db.patch(row._id, { codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
    count += 1;
  }
  return count;
}

/**
 * Doc §2.4 steps 1–2: finds the attempt by the SHA-256 of `state` and spends it in this same
 * transaction, before any network call: marks it used, scrubs the verifier from the row and
 * tombstones it. Returns what the code exchange needs (the verifier still encrypted). A missing,
 * used or expired attempt is "expired"; a deleted or no longer approved account, or a missing
 * client, is "error" (and no code is exchanged).
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
    };
  },
});

/**
 * Doc §2.4 step 7: stores the encrypted tokens and marks the connection `connected` (one live
 * row per person; a reconnect reuses it). Cancels any other open connect attempt. False when the
 * account is gone, inactive or no longer approved.
 */
export const saveTokens = internalMutation({
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
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || isInactiveAccount(user) || !isApproved(user)) {
      return false;
    }
    const now = Date.now();
    const existing = await liveConnection(ctx, args.userId);
    const fields = {
      status: "connected" as const,
      mcpUrl: args.mcpUrl,
      issuer: args.issuer,
      clientRowId: args.clientRowId,
      ...(args.scope ? { scope: args.scope } : {}),
      connectedAt: now,
      updatedAt: now,
    };
    let connectionId: Id<"connections">;
    if (existing) {
      connectionId = existing._id;
      await ctx.db.patch(connectionId, {
        ...fields,
        scope: args.scope,
        lastErrorAt: undefined,
        refreshLeaseUntil: undefined,
        refreshLeaseToken: undefined,
      });
    } else {
      connectionId = await ctx.db.insert("connections", {
        userId: args.userId,
        provider: EXECUTOR_PROVIDER,
        ...fields,
        createdAt: now,
      });
    }
    const secrets = {
      accessTokenCipher: args.accessTokenCipher,
      ...(args.refreshTokenCipher ? { refreshTokenCipher: args.refreshTokenCipher } : {}),
      ...(args.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: args.accessTokenExpiresAt } : {}),
      keyVersion: args.keyVersion,
      updatedAt: now,
    };
    const current = (await secretsOf(ctx, connectionId)).find((row) => row.deletedAt === undefined);
    if (current) {
      await ctx.db.patch(current._id, {
        ...secrets,
        refreshTokenCipher: args.refreshTokenCipher,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
      });
    } else {
      await ctx.db.insert("connectionSecrets", {
        userId: args.userId,
        connectionId,
        ...secrets,
        createdAt: now,
      });
    }
    await cancelPending(ctx, args.userId, now);
    return true;
  },
});

/**
 * The callback (doc §2.4), as a plain function over a request so tests can drive it. Every
 * answer is `no-store` with no referrer, and every redirect goes to a fixed path on `SITE_URL`
 * with only `?executor=connected|denied|expired|error`: never a code, a state or a token.
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
  const redirect = (returnTo: ReturnTo, result: "connected" | "denied" | "expired" | "error") =>
    new Response(null, { status: 302, headers: { ...headers, Location: callbackRedirect(origin, returnTo, result) } });

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
  const back = (result: "connected" | "denied" | "error") => redirect(pending.returnTo, result);
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
    // 5–6. The exchange, with the verifier and `resource`; Bearer checked in readTokenResponse.
    const tokens = await exchangeCode(deps.fetch, {
      tokenEndpoint: pending.client.tokenEndpoint,
      client: await clientCredentials(key, pending.client),
      code,
      redirectUri: pending.redirectUri,
      codeVerifier,
      resource: pending.resource,
    });
    // 7. Encrypt and save.
    const now = deps.now();
    const saved = await ctx.runMutation(internal.connections.saveTokens, {
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
    });
    return back(saved ? "connected" : "error");
  } catch (error) {
    console.error(`connections.callback: could not finish (${connectionErrorKind(error)})`);
    return back("error");
  }
}

// ---------------------------------------------------------------------------
// Calls: tokens, refresh, rate limit, audit
// ---------------------------------------------------------------------------

/**
 * What one Executor call needs (doc §5.4 `secretsForCall`): the live connection, its
 * ciphertexts (decrypted in the action) and the OAuth client. Internal only.
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
    const connection = await liveConnection(ctx, args.userId);
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
 * Counts one call against the person's `CALLS_PER_HOUR` window (on the connection row, like
 * `mcpTokens`). "gone" when the connection is no longer live and usable.
 */
export const reserveCall = internalMutation({
  args: { connectionId: v.id("connections") },
  returns: v.union(v.literal("ok"), v.literal("rate_limited"), v.literal("gone")),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || (row.status !== "connected" && row.status !== "unavailable")) {
      return "gone" as const;
    }
    const now = Date.now();
    const inWindow = row.windowStartMs !== undefined && now - row.windowStartMs < HOUR_MS;
    const used = inWindow ? (row.windowCount ?? 0) : 0;
    if (used >= CALLS_PER_HOUR) {
      return "rate_limited" as const;
    }
    await ctx.db.patch(row._id, {
      windowStartMs: inWindow ? row.windowStartMs : now,
      windowCount: used + 1,
      updatedAt: now,
    });
    return "ok" as const;
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
 * the tokens: they no longer work, and reconnecting issues new ones. `unavailable` (timeout,
 * 5xx) keeps them; the next success sets `connected` again.
 */
export const markStatus = internalMutation({
  args: { connectionId: v.id("connections"), status: v.union(v.literal("needs_reauth"), v.literal("unavailable")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.connectionId);
    if (!row || row.deletedAt !== undefined || row.status === "needs_reauth") {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: args.status,
      lastErrorAt: now,
      refreshLeaseUntil: undefined,
      refreshLeaseToken: undefined,
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
 * live connection, the per-person limit, a refresh if the token is about to end (one at a time),
 * one `search` with a 15-second deadline, one retry on a network error, one refresh-and-retry on
 * a 401, and an audit row. Only a summary of the answer comes back: no raw results.
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
  const reauth = async (): Promise<ExecutorSearchOutcome> => {
    await ctx.runMutation(internal.connections.markStatus, { connectionId, status: "needs_reauth" });
    return { status: "needs_reauth" };
  };
  if (material.mcpUrl !== config.mcpUrl) {
    // Tokens are bound to the URL they were issued for (doc §1.5): a new URL needs a reconnect.
    return reauth();
  }
  const reserved = await ctx.runMutation(internal.connections.reserveCall, { connectionId });
  if (reserved !== "ok") {
    return { status: reserved === "rate_limited" ? "rate_limited" : "not_connected" };
  }

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
  const unavailable = async (outcome: "error" | "timeout", markConnection: boolean): Promise<ExecutorSearchOutcome> => {
    if (markConnection) {
      await ctx.runMutation(internal.connections.markStatus, { connectionId, status: "unavailable" });
    }
    await audit("auto", outcome);
    return { status: "unavailable" };
  };

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
    // Unreadable ciphertexts (for example a changed key): the person reconnects.
    console.error(`connections.search: tokens could not be read (${connectionErrorKind(error)})`);
    await audit("auto", "unauthorized");
    return reauth();
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
      if (error instanceof OAuthFlowError && (error.kind === "invalid_grant" || error.kind === "invalid_client")) {
        await audit("auto", "unauthorized");
        return reauth();
      }
      return unavailable(error instanceof OAuthFlowError && error.kind === "timeout" ? "timeout" : "error", true);
    }
    const now = deps.now();
    const stored = await ctx.runMutation(internal.connections.storeRefreshed, {
      connectionId,
      leaseToken: lease.leaseToken,
      accessTokenCipher: await encryptSecret(key, tokens.accessToken, tokenAad(userId, "accessToken")),
      ...(tokens.refreshToken
        ? { refreshTokenCipher: await encryptSecret(key, tokens.refreshToken, tokenAad(userId, "refreshToken")) }
        : {}),
      ...(tokens.expiresIn !== undefined ? { accessTokenExpiresAt: now + tokens.expiresIn * 1000 } : {}),
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    });
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
 * Disconnect step 1 (doc §2.5): the live connection becomes `revoking` and is tombstoned at once
 * (the person sees "not connected"), open connect attempts are cancelled, and the sweep is
 * scheduled in case the revoke never finishes. Null when there is nothing to disconnect.
 */
export const beginDisconnect = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ connectionId: v.id("connections") })),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    const now = Date.now();
    await cancelPending(ctx, user._id, now);
    const connection = await liveConnection(ctx, user._id);
    if (!connection) {
      return null;
    }
    await ctx.db.patch(connection._id, {
      status: "revoking",
      refreshLeaseUntil: undefined,
      refreshLeaseToken: undefined,
      deletedAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
    return { connectionId: connection._id };
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

/** Disconnect's last step: scrub, whatever the revoke said. Only a `revoking` connection. */
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
 * Revokes the refresh token, then the access token, at Executor's revocation endpoint (RFC 7009,
 * 5 s each) when Executor is available and offers one; then scrubs. True only when every revoke
 * Tempo sent was confirmed.
 */
async function revokeAndScrub(ctx: Runner, connectionId: Id<"connections">, deps: ConnectionDeps): Promise<boolean> {
  const material = await ctx.runQuery(internal.connections.revokeMaterial, { connectionId });
  let revoked = false;
  const config = executorConfig(deps.env);
  const key = material && config ? await loadConnectionsKey(deps.env) : null;
  const endpoint = material?.client?.revocationEndpoint;
  if (material?.client && key && endpoint) {
    try {
      const client = await clientCredentials(key, material.client);
      const tokens: Array<{ token: string; hint: "refresh_token" | "access_token" }> = [];
      if (material.refreshTokenCipher) {
        tokens.push({
          token: await decryptSecret(key, material.refreshTokenCipher, tokenAad(material.userId, "refreshToken")),
          hint: "refresh_token",
        });
      }
      if (material.accessTokenCipher) {
        tokens.push({
          token: await decryptSecret(key, material.accessTokenCipher, tokenAad(material.userId, "accessToken")),
          hint: "access_token",
        });
      }
      revoked = tokens.length > 0;
      for (const { token, hint } of tokens) {
        const ok = await revokeToken(deps.fetch, { revocationEndpoint: endpoint, client, token, tokenTypeHint: hint });
        revoked = revoked && ok;
      }
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
  await requireApprovedForAi(ctx as ActionCtx);
  const begun = await ctx.runMutation(internal.connections.beginDisconnect, {});
  if (!begun) {
    return { status: "disconnected", revokedAtProvider: false };
  }
  return { status: "disconnected", revokedAtProvider: await revokeAndScrub(ctx, begun.connectionId, deps) };
}

export const disconnect = action({
  args: { provider: v.literal("executor") },
  returns: v.object({ status: v.literal("disconnected"), revokedAtProvider: v.boolean() }),
  handler: async (ctx): Promise<{ status: "disconnected"; revokedAtProvider: boolean }> =>
    disconnectFlow(ctx, defaultConnectionDeps()),
});

/** The person's connections that account deletion marked `revoking`. */
export const revokingConnections = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(v.id("connections")),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(50);
    return rows.filter((row) => row.status === "revoking").map((row) => row._id);
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
  const rows = await ctx.db
    .query("connections")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(50);
  if (!rows.some((row) => row.status === "revoking")) {
    return false;
  }
  await ctx.scheduler.runAfter(0, internal.connections.revokeForAccountDeletion, { userId });
  await ctx.scheduler.runAfter(REVOKE_GRACE_MS + 1_000, internal.connections.sweep, {});
  return true;
}

/**
 * The sweep (doc §5.4): scrubs expired connect attempts and connections still `revoking` an hour
 * after disconnect or account deletion. Bounded; a full batch runs again at once. Idempotent.
 *
 * Not a cron: `convex/pageCleanup.test.ts` holds the app to exactly one cron job, so each connect
 * attempt schedules the sweep for its own expiry and each disconnect or account deletion for the
 * end of its grace hour. The effect matches an hourly sweep for every row that needs one.
 */
export const sweep = internalMutation({
  args: {},
  returns: v.object({ pendingScrubbed: v.number(), connectionsScrubbed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("oauthPending")
      .withIndex("by_deletedAt_expiresAt", (q) => q.eq("deletedAt", undefined).lt("expiresAt", now))
      .take(SWEEP_BATCH);
    for (const row of expired) {
      await ctx.db.patch(row._id, { codeVerifierCipher: undefined, deletedAt: now, updatedAt: now });
    }
    const stuck = await ctx.db
      .query("connections")
      .withIndex("by_status_updatedAt", (q) => q.eq("status", "revoking").lt("updatedAt", now - REVOKE_GRACE_MS))
      .take(SWEEP_BATCH);
    for (const connection of stuck) {
      await scrubConnection(ctx, connection, now, false);
    }
    if (expired.length === SWEEP_BATCH || stuck.length === SWEEP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.connections.sweep, {});
    }
    return { pendingScrubbed: expired.length, connectionsScrubbed: stuck.length };
  },
});
