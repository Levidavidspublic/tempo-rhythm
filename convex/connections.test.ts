import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import * as approval from "./approval";
import * as coach from "./coach";
import * as connections from "./connections";
import http from "./http";
import { PENDING_APPROVAL_MESSAGE } from "./lib/approval";
import { executorEnabled } from "./lib/connections/config";
import { FAKE, SECRETS, SEARCH_TOOL_DEF, type FakeExecutor, fakeExecutor } from "./lib/connections/fakeExecutor.testkit";
import { CRISIS_CARD, crisisCardText } from "./lib/crisisWords";
import * as users from "./users";

/**
 * TEMPO-B07-07 (#989): the Executor connection end to end, against an in-memory Convex and a fake
 * Executor (`fakeExecutor.testkit.ts`). No network: every request goes to the fake, and the real
 * `fetch` is replaced by a trap for the whole file. Every "secret" is a recognizable fake string,
 * and the tests check none of them reaches a return value, a log line, a stored row in clear or
 * a redirect.
 */

type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";
const PENDING = "users:pending";

/** A synthetic 32-byte key for these tests only (bytes 7..38). Not a real secret. */
const TEST_KEY = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 7)));
const SITE = "https://www.tempo.test";
const CONVEX_SITE = "https://tempo-test.convex.site";
const REDIRECT_URI = `${CONVEX_SITE}/connections/executor/callback`;
const ENV = {
  TEMPO_EXECUTOR_ENABLED: "true",
  EXECUTOR_MCP_URL: FAKE.mcpUrl,
  TEMPO_CONNECTIONS_KEY: TEST_KEY,
  SITE_URL: SITE,
  CONVEX_SITE_URL: CONVEX_SITE,
};

function makeWorld() {
  const tables = new Map<string, Map<string, Row>>();
  let nextId = 1;
  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };
  for (const user of [
    { _id: A, email: "a@example.com", approvalStatus: "approved" },
    { _id: B, email: "b@example.com", approvalStatus: "approved" },
    { _id: PENDING, email: "p@example.com", approvalStatus: "pending" },
  ]) {
    table("users").set(user._id, { _creationTime: 0, ...user });
  }
  function builder(rows: Row[]) {
    return {
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const conds: Array<(row: Row) => boolean> = [];
        const order = (a: unknown, b: number | string) =>
          typeof a === "number" && typeof b === "number"
            ? a - b
            : typeof a === "string" && typeof b === "string"
              ? a < b
                ? -1
                : a > b
                  ? 1
                  : 0
              : Number.NaN;
        const cmp = (check: (diff: number) => boolean) => (field: string, value: number | string) => {
          conds.push((row) => check(order(row[field], value)));
          return q;
        };
        const q = {
          eq: (field: string, value: unknown) => {
            conds.push((row) => row[field] === value);
            return q;
          },
          gte: cmp((diff) => diff >= 0),
          lt: cmp((diff) => diff < 0),
        };
        fn(q);
        return builder(rows.filter((row) => conds.every((c) => c(row))));
      },
      order: (direction: "asc" | "desc") => builder(direction === "desc" ? [...rows].reverse() : rows),
      collect: async () => [...rows],
      take: async (n: number) => rows.slice(0, n),
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
    };
  }
  // No `delete`: nothing in these flows may hard-delete.
  const db = {
    normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
    get: async (id: string) => table(id.split(":")[0] as string).get(id) ?? null,
    insert: async (t: string, doc: Record<string, unknown>) => {
      const id = `${t}:${nextId}`;
      const clean = Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined));
      table(t).set(id, { _id: id, _creationTime: nextId, ...clean });
      nextId += 1;
      return id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const t = table(id.split(":")[0] as string);
      const existing = t.get(id);
      if (!existing) throw new Error(`patch on missing row ${id}`);
      const next: Row = { ...existing };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete next[key];
        else next[key] = value;
      }
      t.set(id, next);
    },
    query: (t: string) => builder(Array.from(table(t).values())),
  };
  const scheduled: Array<{ when: "after" | "at"; ms: number; name: string; args: unknown }> = [];
  const scheduler = {
    runAfter: async (ms: number, ref: unknown, args: unknown) => {
      scheduled.push({ when: "after", ms, name: getFunctionName(ref as never), args });
    },
    runAt: async (ms: number, ref: unknown, args: unknown) => {
      scheduled.push({ when: "at", ms, name: getFunctionName(ref as never), args });
    },
  };
  const as = (userId: string | null) =>
    ({
      auth: { getUserIdentity: async () => (userId ? { subject: `${userId}|session` } : null) },
      db,
      scheduler,
    }) as unknown as MutationCtx;
  const handlers: Record<string, unknown> = {
    "approval:assertApprovedForAi": approval.assertApprovedForAi,
    "coach:executorLookupPrecheck": coach.executorLookupPrecheck,
    "coach:saveExecutorLookup": coach.saveExecutorLookup,
  };
  for (const name of [
    "connectContext",
    "upsertOAuthClient",
    "createPending",
    "consumePending",
    "saveTokens",
    "secretsForCall",
    "reserveCall",
    "claimRefresh",
    "releaseRefresh",
    "storeRefreshed",
    "markStatus",
    "recordCall",
    "beginDisconnect",
    "revokeMaterial",
    "finishRevoke",
    "revokingConnections",
  ] as const) {
    // biome-ignore lint/performance/noDynamicNamespaceImportAccess: the handler table is built by name.
    handlers[`connections:${name}`] = connections[name];
  }
  /** An action (or HTTP action, with null) ctx whose runQuery / runMutation run as that user. */
  const actionAs = (userId: string | null) => {
    const dispatch = (ref: unknown, args: unknown) => {
      const handler = handlers[getFunctionName(ref as never)];
      if (!handler) throw new Error(`unexpected call ${getFunctionName(ref as never)}`);
      return run(handler, as(userId), args);
    };
    return { runQuery: dispatch, runMutation: dispatch } as unknown as ActionCtx;
  };
  const rows = (t: string) => Array.from(table(t).values());
  return {
    db,
    as,
    actionAs,
    scheduled,
    rows,
    row: (id: string) => table(id.split(":")[0] as string).get(id),
    /** Every stored row, as one string: for "no plaintext secret at rest" checks. */
    dump: () => JSON.stringify([...tables.entries()].map(([name, t]) => [name, [...t.values()]])),
  };
}

type World = ReturnType<typeof makeWorld>;
// biome-ignore lint/suspicious/noExplicitAny: handler results are inspected field by field below.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<any> };
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as Handler)._handler(ctx, args);

function deps(executor: FakeExecutor, env: Record<string, string | undefined> = ENV): connections.ConnectionDeps {
  return { fetch: executor.fetch, env, now: () => Date.now() };
}

// --- no network, and every console line captured -------------------------------------------

const realFetch = globalThis.fetch;
let networkAttempts = 0;
beforeAll(() => {
  globalThis.fetch = (async () => {
    networkAttempts += 1;
    throw new Error("network is not allowed in these tests");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

const consoleLines: string[] = [];
const spies: Array<ReturnType<typeof spyOn>> = [];
beforeEach(() => {
  consoleLines.length = 0;
  for (const method of ["log", "error", "warn", "info", "debug"] as const) {
    spies.push(
      spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleLines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" "));
      }),
    );
  }
});
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});

/** Asserts no fake secret (and none of `extra`) appears in any of `values` or in the console. */
function expectNoSecrets(values: unknown[], extra: string[] = []) {
  const needles = [...Object.values(SECRETS), ...extra].filter(Boolean);
  const haystacks = [...values.map((value) => (typeof value === "string" ? value : JSON.stringify(value) ?? "")), ...consoleLines];
  for (const needle of needles) {
    for (const hay of haystacks) {
      expect(hay.includes(needle)).toBe(false);
    }
  }
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e,
  );
}

// --- flows --------------------------------------------------------------------------------

async function startConnect(world: World, executor: FakeExecutor, userId = A, returnTo?: "settings" | "coach") {
  const result = await connections.startExecutorConnectFlow(
    world.actionAs(userId),
    returnTo ? { returnTo } : {},
    deps(executor),
  );
  const url = new URL(result.authorizationUrl);
  executor.expectChallenge(url.searchParams.get("code_challenge") as string);
  return { result, url, state: url.searchParams.get("state") as string };
}

async function callback(
  world: World,
  executor: FakeExecutor,
  params: Record<string, string>,
  env: Record<string, string | undefined> = ENV,
) {
  const request = new Request(`${REDIRECT_URI}?${new URLSearchParams(params)}`);
  return connections.handleExecutorCallback(world.actionAs(null), request, deps(executor, env));
}

async function connectFully(world: World, executor: FakeExecutor, userId = A) {
  const { state } = await startConnect(world, executor, userId);
  const response = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
  expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=connected`);
  return { state, response };
}

async function seedConversation(world: World, userId = A) {
  return (await world.db.insert("conversations", { userId, title: "Chat", createdAt: 1, updatedAt: 1 })) as Id<"conversations">;
}

function view(world: World, userId = A, env: Record<string, string | undefined> = ENV) {
  return connections.executorView(world.as(userId) as never, userId as Id<"users">, env);
}

function lookup(
  world: World,
  executor: FakeExecutor,
  conversationId: Id<"conversations">,
  query = "my calendar",
  env: Record<string, string | undefined> = ENV,
  userId = A,
) {
  return coach.runExecutorLookup(world.actionAs(userId), { conversationId, query }, deps(executor, env));
}

function liveConnectionRow(world: World, userId = A) {
  return world.rows("connections").find((r) => r.userId === userId && r.deletedAt === undefined);
}

function secretsRow(world: World, connectionId: string) {
  return world.rows("connectionSecrets").find((r) => r.connectionId === connectionId);
}

// -------------------------------------------------------------------------------------------

describe("the contract", () => {
  test("every contract name exists with its kind; helpers are internal", () => {
    const flags = (fn: unknown) => fn as { isQuery?: boolean; isAction?: boolean; isMutation?: boolean; isPublic?: boolean; isInternal?: boolean };
    expect(flags(connections.list)).toMatchObject({ isQuery: true, isPublic: true });
    expect(flags(connections.status)).toMatchObject({ isQuery: true, isPublic: true });
    expect(flags(connections.startExecutorConnect)).toMatchObject({ isAction: true, isPublic: true });
    expect(flags(connections.disconnect)).toMatchObject({ isAction: true, isPublic: true });
    expect(flags(coach.lookUpInExecutor)).toMatchObject({ isAction: true, isPublic: true });
    for (const name of [
      "connectContext",
      "upsertOAuthClient",
      "createPending",
      "consumePending",
      "saveTokens",
      "secretsForCall",
      "reserveCall",
      "claimRefresh",
      "releaseRefresh",
      "storeRefreshed",
      "markStatus",
      "recordCall",
      "beginDisconnect",
      "revokeMaterial",
      "finishRevoke",
      "revokingConnections",
      "revokeForAccountDeletion",
      "sweep",
    ] as const) {
      // biome-ignore lint/performance/noDynamicNamespaceImportAccess: each name is checked in turn.
      const fn = flags(connections[name]);
      expect(fn.isInternal).toBe(true);
      expect(fn.isPublic).toBeUndefined();
    }
    expect(flags(coach.executorLookupPrecheck).isInternal).toBe(true);
    expect(flags(coach.saveExecutorLookup).isInternal).toBe(true);
  });

  test("the callback route is registered next to the existing routes", () => {
    const routes = http.getRoutes().map(([path, method]) => `${method} ${path}`);
    expect(routes).toContain("GET /connections/executor/callback");
    for (const existing of ["POST /mcp", "GET /mcp", "DELETE /mcp", "OPTIONS /mcp", "POST /api/revenuecat-webhook"]) {
      expect(routes).toContain(existing);
    }
  });
});

describe("Executor is unavailable unless it is switched on and configured", () => {
  const variants: Array<[string, Record<string, string | undefined>]> = [
    ["no key", { ...ENV, TEMPO_CONNECTIONS_KEY: undefined }],
    ["a key that is not 32 bytes", { ...ENV, TEMPO_CONNECTIONS_KEY: btoa("short") }],
    ["the switch off", { ...ENV, TEMPO_EXECUTOR_ENABLED: "false" }],
    ["the switch missing", { ...ENV, TEMPO_EXECUTOR_ENABLED: undefined }],
    ["no MCP URL", { ...ENV, EXECUTOR_MCP_URL: undefined }],
    ["an http MCP URL", { ...ENV, EXECUTOR_MCP_URL: "http://mcp.executor.test/mcp" }],
    ["no SITE_URL", { ...ENV, SITE_URL: undefined }],
  ];

  for (const [label, env] of variants) {
    test(`${label}: status unavailable, enabled false, and nothing is fetched`, async () => {
      const world = makeWorld();
      const executor = fakeExecutor();
      expect(executorEnabled(env)).toBe(false);
      const state = await view(world, A, env);
      expect(state.status).toBe("unavailable");
      expect(state.enabled).toBe(false);

      const started = await rejection(connections.startExecutorConnectFlow(world.actionAs(A), {}, deps(executor, env)));
      expect(started).toBeInstanceOf(ConvexError);
      expect((started as ConvexError<{ code: string }>).data.code).toBe("unavailable");

      const conversationId = await seedConversation(world);
      expect(await lookup(world, executor, conversationId, "my calendar", env)).toBe("unavailable");

      const response = await callback(world, executor, { code: SECRETS.code, state: "whatever" }, env);
      if (env.SITE_URL) {
        expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=error`);
      } else {
        expect(response.status).toBe(503);
      }
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(executor.calls).toHaveLength(0);
      expect(world.rows("oauthPending")).toHaveLength(0);
      expect(world.rows("messages")).toHaveLength(0);
    });
  }

  test("configured and switched on: enabled, and the queries say not_connected", async () => {
    const world = makeWorld();
    expect(executorEnabled(ENV)).toBe(true);
    expect(await view(world)).toMatchObject({ enabled: true, status: "not_connected", connection: null });
  });

  test("the public queries read this deployment's env, need an approved account, and return no secret", async () => {
    const world = makeWorld();
    const status = await run(connections.status, world.as(A), { provider: "executor" });
    expect(status.enabled).toBe(executorEnabled());
    if (!status.enabled) expect(status.status).toBe("unavailable");
    const list = await run(connections.list, world.as(A), {});
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ provider: "executor", scoped: false });
    await expect(run(connections.status, world.as(PENDING), { provider: "executor" })).rejects.toThrow(
      "ACCOUNT_PENDING_APPROVAL",
    );
    await expect(run(connections.list, world.as(PENDING), {})).rejects.toThrow("ACCOUNT_PENDING_APPROVAL");
  });
});

describe("connect", () => {
  test("a pending account cannot start, and nothing is fetched", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const error = await rejection(connections.startExecutorConnectFlow(world.actionAs(PENDING), {}, deps(executor)));
    expect(String(error)).toContain(PENDING_APPROVAL_MESSAGE);
    expect(executor.calls).toHaveLength(0);
  });

  test("start: discovery, registration and PKCE; only the authorization URL comes back", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { result, url, state } = await startConnect(world, executor);

    expect(Object.keys(result)).toEqual(["authorizationUrl"]);
    expect(url.origin + url.pathname).toBe(FAKE.authorize);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(FAKE.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("resource")).toBe(FAKE.mcpUrl);
    expect(url.searchParams.get("scope")).toBe("offline_access");
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(executor.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST ${FAKE.mcpUrl}`,
      `GET ${FAKE.prm}`,
      `GET ${FAKE.asMetadata}`,
      `POST ${FAKE.register}`,
    ]);

    // One shared client, its secret encrypted.
    const [client] = world.rows("oauthClients");
    expect(client).toMatchObject({ issuer: FAKE.issuer, redirectUri: REDIRECT_URI, clientId: FAKE.clientId, codeChallengeS256: true });
    expect(String(client?.clientSecretCipher)).toMatch(/^v1\./);
    // The pending row keeps the state's hash, never the state, and an encrypted verifier.
    const [pending] = world.rows("oauthPending");
    expect(pending?.stateHash).toBe(createHash("sha256").update(state).digest("hex"));
    expect(String(pending?.codeVerifierCipher)).toMatch(/^v1\./);
    expect(pending).toMatchObject({ userId: A, issuer: FAKE.issuer, resource: FAKE.mcpUrl, returnTo: "settings" });
    expect((pending?.expiresAt as number) - (pending?.createdAt as number)).toBe(connections.PENDING_TTL_MS);
    expect(world.dump()).not.toContain(state);
    expect(world.scheduled).toEqual([
      { when: "at", ms: (pending?.expiresAt as number) + 1_000, name: "connections:sweep", args: {} },
    ]);
    expect((await view(world)).status).toBe("connecting");
    expectNoSecrets([result, world.dump()]);
  });

  test("a second person reuses the registered client: one registration per issuer and redirect URI", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await startConnect(world, executor, A);
    await startConnect(world, executor, B);
    expect(executor.registrations).toBe(1);
    expect(world.rows("oauthClients")).toHaveLength(1);
  });

  test("at most five connect attempts an hour; the sixth calls nothing", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    for (let i = 0; i < connections.CONNECT_ATTEMPTS_PER_HOUR; i += 1) await startConnect(world, executor);
    const before = executor.calls.length;
    const error = await rejection(connections.startExecutorConnectFlow(world.actionAs(A), {}, deps(executor)));
    expect((error as ConvexError<{ code: string }>).data.code).toBe("rate_limited");
    expect(executor.calls).toHaveLength(before);
  });

  test("a mismatched issuer or no S256 stops the connect in Tempo's words; the log names the kind only", async () => {
    for (const options of [{ metadataIssuer: "https://other.test" }, { s256: false }, { prmResource: "https://evil.test/mcp" }]) {
      const world = makeWorld();
      const executor = fakeExecutor(options);
      const error = await rejection(connections.startExecutorConnectFlow(world.actionAs(A), {}, deps(executor)));
      expect((error as ConvexError<{ code: string; message: string }>).data).toEqual({
        code: "unavailable",
        message: "Executor isn't available right now. Nothing changed.",
      });
      expect(world.rows("oauthPending")).toHaveLength(0);
      expect(consoleLines.at(-1)).toMatch(/^connections\.startExecutorConnect: could not start \(OAuthFlowError: (issuer_mismatch|no_pkce|discovery)\)$/);
    }
  });
});

describe("the callback (doc §2.4)", () => {
  test("ok: the code is exchanged with the verifier and resource, tokens are stored encrypted, the browser goes back", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state, response } = await connectFully(world, executor);

    expect(response.status).toBe(302);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    const tokenCall = executor.calls.find((c) => c.url === FAKE.token);
    const form = new URLSearchParams(tokenCall?.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("resource")).toBe(FAKE.mcpUrl);
    expect(form.get("redirect_uri")).toBe(REDIRECT_URI);
    const verifier = form.get("code_verifier") as string;
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenCall?.headers.authorization).toBe(`Basic ${btoa(`${FAKE.clientId}:${SECRETS.clientSecret}`)}`);

    const connection = liveConnectionRow(world);
    expect(connection).toMatchObject({ status: "connected", mcpUrl: FAKE.mcpUrl, issuer: FAKE.issuer, scope: "openid offline_access" });
    const secrets = secretsRow(world, connection?._id as string);
    expect(String(secrets?.accessTokenCipher)).toMatch(/^v1\./);
    expect(String(secrets?.refreshTokenCipher)).toMatch(/^v1\./);
    expect(secrets?.accessTokenExpiresAt).toBeGreaterThan(Date.now() + 3_500_000);
    const [pending] = world.rows("oauthPending");
    expect(pending?.usedAt).toBeNumber();
    expect(pending?.deletedAt).toBeNumber();
    expect(pending?.codeVerifierCipher).toBeUndefined();
    expect(await view(world)).toMatchObject({ status: "connected", times: { connectedAt: connection?.connectedAt } });

    // Nothing secret anywhere: not in the redirect, not at rest in clear, not in a log line.
    expectNoSecrets([response.headers.get("Location"), world.dump()], [verifier, state]);
  });

  test("returnTo coach comes back to the coach page", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state } = await startConnect(world, executor, A, "coach");
    const response = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
    expect(response.headers.get("Location")).toBe(`${SITE}/coach?executor=connected`);
  });

  test("a missing, unknown or already used state is expired, and nothing is sent", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state } = await connectFully(world, executor);
    const tokenCalls = () => executor.calls.filter((c) => c.url === FAKE.token).length;
    expect(tokenCalls()).toBe(1);
    const attempts: Array<Record<string, string>> = [
      { code: SECRETS.code, state },
      { code: SECRETS.code, state: "unknown" },
      { code: SECRETS.code },
    ];
    for (const params of attempts) {
      const response = await callback(world, executor, params);
      expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=expired`);
    }
    expect(tokenCalls()).toBe(1);
  });

  test("an attempt older than ten minutes is expired and scrubbed", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state } = await startConnect(world, executor);
    const [pending] = world.rows("oauthPending");
    await world.db.patch(pending?._id as string, { expiresAt: Date.now() - 1 });
    const response = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
    expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=expired`);
    expect(world.row(pending?._id as string)).toMatchObject({ deletedAt: expect.any(Number) });
    expect(world.row(pending?._id as string)?.codeVerifierCipher).toBeUndefined();
    expect(executor.calls.some((c) => c.url === FAKE.token)).toBe(false);
  });

  test("the person declining is denied; the server's text is never shown or logged", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state } = await startConnect(world, executor);
    const response = await callback(world, executor, {
      error: "access_denied",
      error_description: "SERVER-TEXT about the denial",
      state,
      iss: FAKE.issuer,
    });
    expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=denied`);
    expect(executor.calls.some((c) => c.url === FAKE.token)).toBe(false);
    expect(consoleLines.join("\n")).not.toContain("SERVER-TEXT");
    // The attempt is spent: a replay is expired.
    const again = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
    expect(again.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=expired`);
  });

  test("an iss that does not match, or a missing iss the server promised, is an error before any exchange", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ issSupported: true });
    let { state } = await startConnect(world, executor);
    let response = await callback(world, executor, { code: SECRETS.code, state, iss: "https://evil.test" });
    expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=error`);
    ({ state } = await startConnect(world, executor));
    response = await callback(world, executor, { code: SECRETS.code, state });
    expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=error`);
    expect(executor.calls.some((c) => c.url === FAKE.token)).toBe(false);
    expect(liveConnectionRow(world)).toBeUndefined();
  });

  test("an account whose approval was revoked while it was away gets an error, and nothing is stored", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const { state } = await startConnect(world, executor);
    await world.db.patch(A, { approvalStatus: "revoked" });
    const response = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
    expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=error`);
    expect(executor.calls.some((c) => c.url === FAKE.token)).toBe(false);
    expect(world.rows("connections")).toHaveLength(0);
    expect(world.rows("connectionSecrets")).toHaveLength(0);
  });

  test("a failed or non-Bearer token answer is an error, and nothing is stored", async () => {
    for (const options of [{ tokenError: "invalid_grant" }, { tokenError: "server_error" }, { tokenType: "mac" }]) {
      const world = makeWorld();
      const executor = fakeExecutor(options);
      const { state } = await startConnect(world, executor);
      const response = await callback(world, executor, { code: SECRETS.code, state, iss: FAKE.issuer });
      expect(response.headers.get("Location")).toBe(`${SITE}/settings/integrations?executor=error`);
      expect(world.rows("connections")).toHaveLength(0);
      expect(world.rows("connectionSecrets")).toHaveLength(0);
      expect(consoleLines.at(-1)).toMatch(/^connections\.callback: could not finish \(OAuthFlowError: (invalid_grant|token)\)$/);
      expectNoSecrets([response.headers.get("Location")]);
    }
  });
});

describe("look in my apps (coach.lookUpInExecutor)", () => {
  test("ok: only search runs; the reply is templated and carries apps and counts, no raw results", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);

    expect(await lookup(world, executor, conversationId, "  my calendar ")).toBe("replied");

    expect(executor.mcpMethods()).toEqual(["initialize", "notifications/initialized", "tools/list", "tools/call"]);
    const call = JSON.parse(executor.mcpCalls().at(-1)?.body ?? "{}");
    expect(call.params).toEqual({ name: "search", arguments: { query: "my calendar" } });

    const messages = world.rows("messages").filter((m) => m.conversationId === conversationId);
    expect(messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "my calendar"],
      [
        "assistant",
        "Through Executor I can reach Google Calendar (3 tools) and Gmail (1 tool). I'll ask before I use any of them.",
      ],
    ]);
    expect(messages[1]?.modelUsed).toBe("executor-lookup");
    expect(messages[1]?.toolCalls).toEqual({
      executorLookup: {
        query: "my calendar",
        apps: [
          { name: "Google Calendar", toolCount: 3 },
          { name: "Gmail", toolCount: 1 },
        ],
        total: 4,
      },
    });
    // Search results are not kept beyond that summary.
    expect(world.dump()).not.toContain("events.list");

    const [audit] = world.rows("connectionCalls");
    expect(audit).toMatchObject({
      userId: A,
      kind: "tool_call",
      tool: "search",
      decision: "auto",
      outcome: "ok",
      messageId: messages[1]?._id,
    });
    expect(String(audit?.inputDigest)).toMatch(/^[0-9a-f]{64}$/);
    expect(audit?.resultBytes).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain("my calendar");
    expect(liveConnectionRow(world)?.lastUsedAt).toBeNumber();
    expectNoSecrets([world.dump()]);
  });

  test("the reply is in the person's app language", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    await world.db.insert("userPreferences", {
      userId: A,
      theme: "system",
      locale: "he",
      weekStartsOn: 0,
      timeZone: "Asia/Jerusalem",
      emailReminders: false,
      inAppNotifications: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId, "יומן")).toBe("replied");
    const reply = world.rows("messages").find((m) => m.role === "assistant");
    expect(reply?.content).toBe(
      "דרך Executor יש לי גישה אל Google Calendar (3 כלים) ו-Gmail (כלי אחד). אבקש אישור לפני כל שימוש בהם.",
    );
  });

  test("not connected, or needs_reauth: no call, nothing saved", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId)).toBe("not_connected");
    await connectFully(world, executor);
    await world.db.patch(liveConnectionRow(world)?._id as string, { status: "needs_reauth" });
    const before = executor.calls.length;
    expect(await lookup(world, executor, conversationId)).toBe("needs_reauth");
    expect(executor.calls).toHaveLength(before);
    expect(world.rows("messages")).toHaveLength(0);
  });

  test("the thirty-first lookup in an hour is rate_limited and calls nothing", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    await world.db.patch(liveConnectionRow(world)?._id as string, {
      windowStartMs: Date.now() - 1_000,
      windowCount: connections.CALLS_PER_HOUR,
    });
    const before = executor.calls.length;
    expect(await lookup(world, executor, conversationId)).toBe("rate_limited");
    expect(executor.calls).toHaveLength(before);
    // A new hour opens the window again.
    await world.db.patch(liveConnectionRow(world)?._id as string, { windowStartMs: Date.now() - connections.HOUR_MS - 1 });
    expect(await lookup(world, executor, conversationId)).toBe("replied");
    expect(liveConnectionRow(world)?.windowCount).toBe(1);
  });

  test("a search the server does not mark read-only is refused by policy, audited as blocked, never called", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ tools: [{ ...SEARCH_TOOL_DEF, annotations: { readOnlyHint: false } }] });
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId)).toBe("unavailable");
    expect(executor.mcpMethods()).not.toContain("tools/call");
    expect(world.rows("connectionCalls")).toEqual([expect.objectContaining({ decision: "blocked", outcome: "error" })]);
    expect(world.rows("messages")).toHaveLength(0);
  });

  test("the coach runs search only, even when call, execute and skills are offered as read-only", async () => {
    const world = makeWorld();
    const readOnly = { readOnlyHint: true, destructiveHint: false };
    const executor = fakeExecutor({
      tools: [
        { name: "call", annotations: readOnly },
        { name: "execute", annotations: readOnly },
        { name: "skills", annotations: readOnly },
        SEARCH_TOOL_DEF,
      ],
    });
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId)).toBe("replied");
    const toolCalls = executor.mcpCalls().filter((c) => JSON.parse(c.body).method === "tools/call");
    expect(toolCalls.map((c) => JSON.parse(c.body).params.name)).toEqual(["search"]);
  });

  test("a network error is retried once; past that the connection is unavailable until the next success", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    executor.options.networkFailures = 1;
    expect(await lookup(world, executor, conversationId)).toBe("replied");

    executor.options.networkFailures = 2;
    expect(await lookup(world, executor, conversationId)).toBe("unavailable");
    expect(liveConnectionRow(world)?.status).toBe("unavailable");
    expect((await view(world)).status).toBe("unavailable");
    expect(world.rows("connectionCalls").at(-1)).toMatchObject({ outcome: "error" });

    expect(await lookup(world, executor, conversationId)).toBe("replied");
    expect(liveConnectionRow(world)?.status).toBe("connected");
  });

  test("a timeout or a 5xx is unavailable; Executor's 429 is rate_limited; an unreadable answer saves nothing", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);

    executor.options.mcpStatus = 503;
    expect(await lookup(world, executor, conversationId)).toBe("unavailable");
    expect(liveConnectionRow(world)?.status).toBe("unavailable");

    executor.options.mcpStatus = 429;
    expect(await lookup(world, executor, conversationId)).toBe("rate_limited");
    expect(world.rows("connectionCalls").at(-1)).toMatchObject({ outcome: "rate_limited" });

    executor.options.mcpStatus = undefined;
    executor.options.searchResult = { content: [{ type: "text", text: "Here are some tools." }] };
    expect(await lookup(world, executor, conversationId)).toBe("unavailable");
    expect(world.rows("messages")).toHaveLength(0);
    expect(consoleLines).toContain("connections.search: the search answer could not be read");
  });

  test("crisis words never reach Executor: the person gets the resources card", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    const before = executor.calls.length;
    expect(await lookup(world, executor, conversationId, "I want to kill myself")).toBe("replied");
    expect(executor.calls).toHaveLength(before);
    const messages = world.rows("messages");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1]?.content).toBe(crisisCardText(CRISIS_CARD));
    expect(messages[1]?.toolCalls).toBeUndefined();
  });

  test("busy while a coach reply holds the turn; only the owner's live chat; approved accounts only", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    await world.db.insert("messages", {
      conversationId,
      role: "user",
      content: "hello",
      toolCalls: { coachClaimUntil: Date.now() + 60_000, coachClaim: "claim-1" },
      createdAt: 5,
    });
    const before = executor.calls.length;
    expect(await lookup(world, executor, conversationId)).toBe("busy");
    expect(executor.calls).toHaveLength(before);

    const other = await seedConversation(world, B);
    await expect(lookup(world, executor, other)).rejects.toThrow();
    await expect(lookup(world, executor, conversationId, "x", ENV, PENDING)).rejects.toThrow("ACCOUNT_PENDING_APPROVAL");
    const blank = await rejection(lookup(world, executor, conversationId, "   "));
    expect((blank as ConvexError<{ code: string }>).data.code).toBe("invalid_query");
  });

  test("a changed MCP URL needs a reconnect, and the old tokens are scrubbed", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    const before = executor.calls.length;
    expect(await lookup(world, executor, conversationId, "x", { ...ENV, EXECUTOR_MCP_URL: "https://mcp2.executor.test/mcp" })).toBe(
      "needs_reauth",
    );
    expect(executor.calls).toHaveLength(before);
    const connection = liveConnectionRow(world);
    expect(connection?.status).toBe("needs_reauth");
    expect(secretsRow(world, connection?._id as string)?.accessTokenCipher).toBeUndefined();
  });
});

describe("refresh", () => {
  test("a token about to end is refreshed first, with the resource, and the new tokens replace the old", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ expiresIn: 30 });
    await connectFully(world, executor);
    const connection = liveConnectionRow(world);
    const oldCipher = secretsRow(world, connection?._id as string)?.refreshTokenCipher;
    const conversationId = await seedConversation(world);

    expect(await lookup(world, executor, conversationId)).toBe("replied");
    expect(executor.refreshes).toBe(1);
    const refresh = new URLSearchParams(executor.calls.find((c) => c.body.includes("grant_type=refresh_token"))?.body);
    expect(refresh.get("resource")).toBe(FAKE.mcpUrl);
    expect(executor.mcpCalls().every((c) => c.headers.authorization === `Bearer ${SECRETS.access2}`)).toBe(true);
    const secrets = secretsRow(world, connection?._id as string);
    expect(secrets?.refreshTokenCipher).not.toBe(oldCipher);
    expect(secrets?.accessTokenExpiresAt).toBeGreaterThan(Date.now() + 3_500_000);
    expect(liveConnectionRow(world)?.refreshLeaseToken).toBeUndefined();
    expectNoSecrets([world.dump()]);
  });

  test("a refused refresh means needs_reauth, and the tokens are scrubbed", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ expiresIn: 30, refreshError: "invalid_grant" });
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId)).toBe("needs_reauth");
    const connection = liveConnectionRow(world);
    expect(connection?.status).toBe("needs_reauth");
    const secrets = secretsRow(world, connection?._id as string);
    expect(secrets?.accessTokenCipher).toBeUndefined();
    expect(secrets?.refreshTokenCipher).toBeUndefined();
    expect((await view(world)).status).toBe("needs_reauth");
    expect(executor.mcpCalls()).toHaveLength(0);
    expect(world.rows("connectionCalls").at(-1)).toMatchObject({ outcome: "unauthorized" });
  });

  test("one refresh at a time: a held lease answers busy and sends nothing", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ expiresIn: 30 });
    await connectFully(world, executor);
    await world.db.patch(liveConnectionRow(world)?._id as string, { refreshLeaseUntil: Date.now() + 20_000, refreshLeaseToken: "other" });
    const conversationId = await seedConversation(world);
    expect(await lookup(world, executor, conversationId)).toBe("busy");
    expect(executor.refreshes).toBe(0);
    expect(executor.mcpCalls()).toHaveLength(0);
  });

  test("a 401 is refreshed once and retried once; a second 401 is needs_reauth", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const conversationId = await seedConversation(world);
    executor.options.unauthorizedTimes = 1;
    expect(await lookup(world, executor, conversationId)).toBe("replied");
    expect(executor.refreshes).toBe(1);

    executor.options.unauthorizedTimes = 5;
    expect(await lookup(world, executor, conversationId)).toBe("needs_reauth");
    expect(executor.refreshes).toBe(2);
    expect(liveConnectionRow(world)?.status).toBe("needs_reauth");
  });
});

describe("disconnect", () => {
  test("revokes the refresh token then the access token, scrubs every ciphertext, and audits", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const connection = liveConnectionRow(world);

    const result = await connections.disconnectFlow(world.actionAs(A), deps(executor));
    expect(result).toEqual({ status: "disconnected", revokedAtProvider: true });
    expect(executor.revoked).toEqual([
      { token: SECRETS.refresh1, hint: "refresh_token" },
      { token: SECRETS.access1, hint: "access_token" },
    ]);
    const after = world.row(connection?._id as string);
    expect(after).toMatchObject({ status: "disconnected", revokedAtProvider: true, deletedAt: expect.any(Number) });
    const secrets = secretsRow(world, connection?._id as string);
    expect(secrets?.accessTokenCipher).toBeUndefined();
    expect(secrets?.refreshTokenCipher).toBeUndefined();
    expect(secrets?.deletedAt).toBeNumber();
    expect(world.rows("connectionCalls").at(-1)).toMatchObject({ kind: "disconnect", outcome: "revoked", userId: A });
    expect((await view(world)).status).toBe("not_connected");
    expect(world.scheduled.some((s) => s.name === "connections:sweep" && s.ms === connections.REVOKE_GRACE_MS + 1_000)).toBe(true);
    expectNoSecrets([result, world.dump()]);
  });

  test("without a revocation endpoint, or with Executor switched off, it still scrubs (revokedAtProvider false)", async () => {
    for (const [options, env] of [
      [{ revocation: false }, ENV],
      [{}, { ...ENV, TEMPO_EXECUTOR_ENABLED: "false" }],
    ] as const) {
      const world = makeWorld();
      const executor = fakeExecutor(options);
      await connectFully(world, executor);
      const before = executor.calls.length;
      const connection = liveConnectionRow(world);
      expect(await connections.disconnectFlow(world.actionAs(A), deps(executor, env))).toEqual({
        status: "disconnected",
        revokedAtProvider: false,
      });
      expect(executor.calls).toHaveLength(before);
      expect(secretsRow(world, connection?._id as string)?.accessTokenCipher).toBeUndefined();
      expect(world.row(connection?._id as string)?.status).toBe("disconnected");
    }
  });

  test("nothing to disconnect is fine; open connect attempts are cancelled; pending accounts can't", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await startConnect(world, executor);
    expect(await connections.disconnectFlow(world.actionAs(A), deps(executor))).toEqual({
      status: "disconnected",
      revokedAtProvider: false,
    });
    expect(world.rows("oauthPending")[0]).toMatchObject({ deletedAt: expect.any(Number) });
    expect(world.rows("oauthPending")[0]?.codeVerifierCipher).toBeUndefined();
    expect((await view(world)).status).toBe("not_connected");
    await expect(connections.disconnectFlow(world.actionAs(PENDING), deps(executor))).rejects.toThrow("ACCOUNT_PENDING_APPROVAL");
  });
});

describe("account deletion and the sweep", () => {
  test("deleteMyAccount marks the connection revoking, scrubs connect attempts, schedules the revoke and the sweep", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    await startConnect(world, executor);
    world.scheduled.length = 0;
    const connection = liveConnectionRow(world);

    await run(users.deleteMyAccount, world.as(A), {});
    expect(world.row(connection?._id as string)).toMatchObject({ status: "revoking", deletedAt: expect.any(Number) });
    expect(world.rows("oauthPending").every((p) => p.deletedAt !== undefined && p.codeVerifierCipher === undefined)).toBe(true);
    expect(world.scheduled).toEqual([
      { when: "after", ms: 0, name: "connections:revokeForAccountDeletion", args: { userId: A } },
      { when: "after", ms: connections.REVOKE_GRACE_MS + 1_000, name: "connections:sweep", args: {} },
    ]);

    // The scheduled revoke: revoke at Executor, then scrub. The audit row is born tombstoned.
    expect(await connections.revokeForAccountDeletionFlow(world.actionAs(null), A as Id<"users">, deps(executor))).toBe(1);
    expect(executor.revoked.map((r) => r.hint)).toEqual(["refresh_token", "access_token"]);
    expect(world.row(connection?._id as string)).toMatchObject({ status: "disconnected", revokedAtProvider: true });
    expect(secretsRow(world, connection?._id as string)?.refreshTokenCipher).toBeUndefined();
    expect(world.rows("connectionCalls").at(-1)).toMatchObject({ kind: "disconnect", deletedAt: expect.any(Number) });
    expectNoSecrets([world.dump()]);
  });

  test("an account with no connection schedules nothing", async () => {
    const world = makeWorld();
    await run(users.deleteMyAccount, world.as(A), {});
    expect(world.scheduled).toEqual([]);
  });

  test("the sweep scrubs connections still revoking after an hour and expired connect attempts, and is idempotent", async () => {
    const world = makeWorld();
    const executor = fakeExecutor();
    await connectFully(world, executor);
    const connection = liveConnectionRow(world);
    await run(users.deleteMyAccount, world.as(A), {});
    await world.db.patch(connection?._id as string, { updatedAt: Date.now() - connections.REVOKE_GRACE_MS - 1 });
    await startConnect(world, executor, B);
    const pendingB = world.rows("oauthPending").find((p) => p.userId === B);
    await world.db.patch(pendingB?._id as string, { expiresAt: Date.now() - 1 });

    const swept = await run(connections.sweep, world.as(null), {});
    expect(swept).toEqual({ pendingScrubbed: 1, connectionsScrubbed: 1 });
    expect(world.row(connection?._id as string)).toMatchObject({ status: "disconnected", revokedAtProvider: false });
    expect(secretsRow(world, connection?._id as string)?.accessTokenCipher).toBeUndefined();
    expect(world.row(pendingB?._id as string)?.codeVerifierCipher).toBeUndefined();
    expect(world.row(pendingB?._id as string)?.deletedAt).toBeNumber();
    expect(await run(connections.sweep, world.as(null), {})).toEqual({ pendingScrubbed: 0, connectionsScrubbed: 0 });
    // A scrubbed connection is not revoked again later.
    expect(await connections.revokeForAccountDeletionFlow(world.actionAs(null), A as Id<"users">, deps(executor))).toBe(0);
    expect(executor.revoked).toEqual([]);
  });
});

describe("no secret ever leaves Convex", () => {
  test("a whole journey, with failures, logs and returns no token, code, verifier, state or client secret", async () => {
    const world = makeWorld();
    const executor = fakeExecutor({ expiresIn: 30 });
    const returned: unknown[] = [];
    const { state, response } = await connectFully(world, executor);
    returned.push(response.headers.get("Location"));
    const verifier = new URLSearchParams(executor.calls.find((c) => c.url === FAKE.token)?.body).get("code_verifier") as string;
    const conversationId = await seedConversation(world);
    returned.push(await lookup(world, executor, conversationId));
    executor.options.networkFailures = 3;
    returned.push(await lookup(world, executor, conversationId));
    executor.options.unauthorizedTimes = 5;
    returned.push(await lookup(world, executor, conversationId));
    returned.push(await run(connections.list, world.as(A), {}));
    returned.push(await run(connections.status, world.as(A), { provider: "executor" }));
    returned.push(await view(world));
    returned.push(await connections.disconnectFlow(world.actionAs(A), deps(executor)));
    const bad = fakeExecutor({ tokenError: "invalid_grant" });
    const second = await startConnect(world, bad);
    // The authorization URL carries its own state by design; it carries nothing else secret.
    expectNoSecrets([second.result]);
    returned.push((await callback(world, bad, { code: SECRETS.code, state: second.state, iss: FAKE.issuer })).headers.get("Location"));

    expect(consoleLines.length).toBeGreaterThan(0);
    expectNoSecrets([...returned, world.dump()], [verifier, state, second.state]);
    // The redirect back to the app never carries a code, a state or a token.
    for (const location of returned.filter((r): r is string => typeof r === "string" && r.startsWith("http"))) {
      expect(new URL(location).search).toMatch(/^\?executor=(connected|denied|expired|error)$/);
    }
  });

  test("no request in this file reached the network", () => {
    expect(networkAttempts).toBe(0);
  });

  test("every console line in the connection code is fixed text or an error's class and kind", () => {
    const files = [
      "connections.ts",
      "connectionsHttp.ts",
      "lib/connections/config.ts",
      "lib/connections/crypto.ts",
      "lib/connections/oauth.ts",
      "lib/connections/mcpClient.ts",
      "lib/connections/policy.ts",
      "lib/connections/lookup.ts",
    ];
    let lines = 0;
    for (const file of files) {
      const source = readFileSync(join(import.meta.dir, file), "utf8");
      for (const line of source.split("\n").filter((l) => /console\.(log|error|warn|info|debug)\(/.test(l))) {
        lines += 1;
        // The only value a log line may carry is the error's class and kind.
        for (const interpolation of line.match(/\$\{[^}]*\}/g) ?? []) {
          expect(`${file}: ${interpolation}`).toBe(`${file}: \${connectionErrorKind(error)}`);
        }
        expect(line).not.toMatch(/\b(accessToken|refreshToken|codeVerifier|clientSecret|state|code|tokens\.\w+)\b/);
      }
      expect(source).not.toMatch(/\.db\.delete\(/);
    }
    expect(lines).toBeGreaterThan(5);
    const coachSource = readFileSync(join(import.meta.dir, "coach.ts"), "utf8");
    for (const line of coachSource.split("\n").filter((l) => l.includes("console.") && l.includes("lookUpInExecutor"))) {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: this is the source text being looked for.
      expect(line).toContain("${connectionErrorKind(error)}");
    }
  });
});
