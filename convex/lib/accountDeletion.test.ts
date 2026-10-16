import { describe, expect, test } from "bun:test";
import { authTables } from "@convex-dev/auth/server";
import type { WithoutSystemFields } from "convex/server";
import { defineTable } from "convex/server";
import type { GenericValidator } from "convex/values";
import { v } from "convex/values";
import {
  ACCOUNT_RESTORE_GRACE_MS,
  isInactiveAccount,
  pickSignInUser,
  signInRestorePatch,
  softDeleteUserAccount,
  USER_OWNED_TABLES,
} from "./accountDeletion";
import {
  CONVERSATION_CHILD_TABLES,
  findLiveOperationReceipt,
  NOTE_CHILD_TABLES,
  type PagePrivacyDenial,
  PagePrivacyError,
  PROPOSAL_CONTENT_FIELDS,
  PROPOSAL_RECEIPT_FIELDS,
  readLivePageBlocks,
  requireActiveOwner,
  requireLiveAgentThread,
  requireLiveChatRequest,
  requireLiveConversation,
  requireLiveOperation,
  requireLivePage,
  requireLiveProposal,
  requirePendingProposal,
  requireUndoAccess,
} from "./pagePrivacy";
import { makeFakeCtx, run } from "./testFakeCtx";
import * as coach from "../coach";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import * as mcp from "../mcp";
import * as nags from "../nags";
import schema from "../schema";

const asUserId = (id: string) => id as Id<"users">;

function handlerCtx(userId: string, extraUsers: string[] = []) {
  const ctx = makeFakeCtx(userId, extraUsers);
  const query = ctx.db.query;
  ctx.db.query = (table: string) => {
    const builder = query(table);
    const addTerminals = (value: ReturnType<typeof query>) => ({
      ...value,
      first: async () => (await value.collect())[0] ?? null,
      take: async (n: number) => (await value.collect()).slice(0, n),
      unique: async () => (await value.collect())[0] ?? null,
      withIndex: (name: string, fn: (q: unknown) => unknown) =>
        addTerminals(value.withIndex(name, fn)),
    });
    return addTerminals(builder);
  };
  return ctx;
}

describe("isInactiveAccount", () => {
  test("live accounts are active", () => {
    expect(isInactiveAccount({})).toBe(false);
    expect(isInactiveAccount({ isActive: true })).toBe(false);
  });

  test("soft-deleted or deactivated accounts are inactive", () => {
    expect(isInactiveAccount({ deletedAt: 1 })).toBe(true);
    expect(isInactiveAccount({ isActive: false })).toBe(true);
  });
});

describe("signInRestorePatch", () => {
  const deletedAt = 1_700_000_000_000;

  test("restores a soft-deleted account inside 30 days", () => {
    expect(signInRestorePatch({ deletedAt, isActive: false }, deletedAt + 1_000)).toEqual({
      deletedAt: undefined,
      isActive: true,
    });
  });

  test("does not restore admin deactivation or an expired grace window", () => {
    expect(signInRestorePatch({ isActive: false }, deletedAt)).toBeNull();
    expect(signInRestorePatch({ deletedAt, isActive: false }, deletedAt + ACCOUNT_RESTORE_GRACE_MS + 1)).toBeNull();
    expect(signInRestorePatch({ deletedAt }, deletedAt - 1)).toBeNull();
  });

  test("pickSignInUser prefers a live row over a soft-deleted one", () => {
    const live = { id: "live", isActive: true };
    const deleted = { id: "deleted", deletedAt, isActive: false };
    expect(pickSignInUser([deleted, live], deletedAt + 1_000)).toBe(live);
    expect(pickSignInUser([deleted], deletedAt + 1_000)?.id).toBe("deleted");
    expect(pickSignInUser([deleted], deletedAt + ACCOUNT_RESTORE_GRACE_MS + 1)?.id).toBe("deleted");
  });
});

// ---------------------------------------------------------------------------
// Schema-derived lifecycle coverage (#807)
//
// The owned-table set is read from the schema, not from a hand-kept list. Every
// application table with a `userId` must have a typed fixture below, so a table added
// without account-deletion coverage fails typecheck (missing key in OWNED_FIXTURES) or
// the focused tests (set comparison and behavioural run).
// ---------------------------------------------------------------------------

type OwnedTableName = Exclude<
  { [T in TableNames]: "userId" extends keyof Doc<T> ? T : never }[TableNames],
  keyof typeof authTables
>;

type Lifecycle =
  /** Listed in USER_OWNED_TABLES: deletedAt (+ updatedAt when declared) stamped. */
  | "owned-table-soft-delete"
  /** Dedicated soft-delete path (nags, coachSettings, coachProposals). */
  | "additional-soft-delete"
  /** Credential rows are revoked with revokedAt, never deleted. */
  | "token-revoke"
  /** Soft-deleted, and its child messages are soft-deleted with it. */
  | "conversation-cascade"
  /** One row per person; status goes to "inactive". */
  | "subscription-inactive"
  /** Executor connection (#989): becomes "revoking" and is tombstoned; the revoke runs later. */
  | "connection-revoke"
  /** Executor connect attempt (#989): the encrypted PKCE verifier is scrubbed and the row tombstoned. */
  | "pending-scrub";

type OwnedFixture<T extends OwnedTableName> = {
  lifecycle: Lifecycle;
  live: (userId: Id<"users">) => WithoutSystemFields<Doc<T>>;
};

function fixture<T extends OwnedTableName>(
  lifecycle: Lifecycle,
  live: OwnedFixture<T>["live"],
): OwnedFixture<T> {
  return { lifecycle, live };
}

const NO_ID = (table: string) => `${table}:fixture`;

/** Synthetic request ids and digests for page-ledger fixtures. Not real keys or note content. */
const REQUEST_ULID_PREFIX = "01ARZ3NDEKTSV4RRFFQ69G5F";
const fakeRequestId = (n: number) => `req_${REQUEST_ULID_PREFIX}${String(n).padStart(2, "0")}`;
const fakeDigest = (n: number) => String(n).padStart(64, "0");

/** One typed live-row builder per application table that carries `userId`. */
const OWNED_FIXTURES: { [T in OwnedTableName]: OwnedFixture<T> } = {
  tasks: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    title: "task",
    status: "todo",
    priority: "low",
    createdAt: 1,
    updatedAt: 1,
  })),
  notes: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    title: "note",
    body: "body",
    pinned: false,
    periodType: "none",
    createdAt: 1,
    updatedAt: 1,
  })),
  noteBlocks: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    noteId: NO_ID("notes") as Id<"notes">,
    type: "page-meta",
    blockId: "meta",
    v: 1,
    data: { pageType: "plain", tags: [] },
    position: 0,
    createdAt: 1,
    updatedAt: 1,
  })),
  habits: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    name: "habit",
    cadence: "daily",
    currentStreak: 0,
    longestStreak: 0,
    createdAt: 1,
    updatedAt: 1,
  })),
  goals: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    title: "goal",
    progressPercent: 0,
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })),
  memories: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    content: "memory",
    sector: "general",
    salience: 0.5,
    decayRate: 0.1,
    lastAccessed: 1,
    accessCount: 0,
    createdAt: 1,
    updatedAt: 1,
  })),
  calendarEvents: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    title: "event",
    startsAtMs: 1,
    createdAt: 1,
    updatedAt: 1,
  })),
  taskRepeatCfgs: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    repeatCycle: "DAILY",
    repeatEvery: 1,
    weekdays: [],
    deletedInstanceDates: [],
    skipOverdue: true,
    waitForCompletion: false,
    repeatFromCompletionDate: false,
    isPaused: false,
    createdAt: 1,
    updatedAt: 1,
  })),
  dayPlans: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    localDate: "2026-10-11",
    status: "draft",
    createdAt: 1,
    updatedAt: 1,
  })),
  timeBlocks: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    localDate: "2026-10-11",
    title: "block",
    startMinute: 540,
    durationMinutes: 30,
    startsAtMs: 1,
    endsAtMs: 2,
    kind: "focus",
    status: "planned",
    source: "user",
    createdAt: 1,
    updatedAt: 1,
  })),
  habitCheckIns: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    habitId: NO_ID("habits") as Id<"habits">,
    localDate: "2026-10-11",
    checkedAt: 1,
    source: "habits",
    createdAt: 1,
    updatedAt: 1,
  })),
  focusBlocks: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    startedAtMs: 1,
    durationMs: 1,
    createdAt: 1,
    updatedAt: 1,
  })),
  templates: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    name: "template",
    periodType: "none",
    body: "body",
    createdAt: 1,
    updatedAt: 1,
  })),
  userPreferences: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    theme: "system",
    locale: "en",
    weekStartsOn: 0,
    timeZone: "UTC",
    emailReminders: true,
    inAppNotifications: true,
    createdAt: 1,
    updatedAt: 1,
  })),
  notifications: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    title: "title",
    body: "body",
    kind: "system",
    createdAt: 1,
    updatedAt: 1,
  })),
  chatRequests: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    conversationId: NO_ID("conversations") as Id<"conversations">,
    requestKey: "req_1",
    payloadDigest: "0".repeat(64),
    sequence: 0,
    status: "queued",
    agentPromptMessageId: "agent-prompt-1",
    generationEpoch: 0,
    createdAt: 1,
    updatedAt: 1,
  })),
  pageOperations: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    noteId: NO_ID("notes") as Id<"notes">,
    requestId: fakeRequestId(1),
    requestDigest: fakeDigest(1),
    kind: "save",
    source: "ui",
    result: "applied",
    affectsBody: true,
    baseRevision: 0,
    resultRevision: 1,
    baseBodyDigest: fakeDigest(2),
    resultBodyDigest: fakeDigest(3),
    delta: [{ startUtf16: 0, removedLengthUtf16: 0, insertedLengthUtf16: 4 }],
    appliedAtMs: 1,
    undoUntilMs: 2,
    metadataExpiresAtMs: 3,
    createdAt: 1,
    updatedAt: 1,
  })),
  pageOperationPayloads: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    noteId: NO_ID("notes") as Id<"notes">,
    operationId: NO_ID("pageOperations") as Id<"pageOperations">,
    undoUntilMs: 2,
    cleanupDueAtMs: 3,
    payload: {
      state: "available",
      splices: [{ startUtf16: 0, removedText: "", insertedText: "text" }],
    },
    createdAt: 1,
    updatedAt: 1,
  })),
  voiceSessions: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    conversationId: NO_ID("conversations") as Id<"conversations">,
    clientKey: "vk_1",
    status: "ended",
    language: "en",
    startedAt: 1,
    lastRenewalAt: 1,
    endedAt: 2,
    durationMs: 1,
    endReason: "stopped",
    dateKey: "2026-10-15",
    utcDateKey: "2026-10-15",
    grants: 1,
    sentences: 0,
    ttsChars: 0,
    createdAt: 1,
    updatedAt: 1,
  })),
  coachWebSearches: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    utcDateKey: "2026-10-16",
    createdAt: 1,
    updatedAt: 1,
  })),
  pageProposals: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    kind: "add_task_to_today",
    schemaVersion: 1,
    noteId: NO_ID("notes") as Id<"notes">,
    localDate: "2026-10-11",
    conversationId: NO_ID("conversations") as Id<"conversations">,
    sourceRequestKey: "req_1",
    proposalRevision: 0,
    expectedPageRevision: 0,
    blockId: "blk_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    status: "pending",
    proposalExpiresAtMs: 2,
    cleanupDueAtMs: 3,
    metadataExpiresAtMs: 4,
    payload: { state: "available", task: { title: "task", durationMin: 15 } },
    createdAt: 1,
    updatedAt: 1,
  })),
  nags: fixture("additional-soft-delete", (userId) => ({
    userId,
    label: "nag",
    enabled: true,
    phrases: [],
    createdAt: 1,
    updatedAt: 1,
  })),
  coachSettings: fixture("additional-soft-delete", (userId) => ({
    userId,
    dial: 5,
    taskLoad: 2,
    acceptedStreak: 0,
    updatedAt: 1,
  })),
  coachProposals: fixture("additional-soft-delete", (userId) => ({
    userId,
    status: "pending",
    taskIds: [],
    tenSecondAction: "start",
    realism: { ok: true, totalMinutes: 0, availableMinutes: 120, note: "" },
    createdAt: 1,
  })),
  mcpTokens: fixture("token-revoke", (userId) => ({
    userId,
    name: "token",
    tokenHash: `hash-${userId}`,
    prefix: "tmp",
    createdAt: 1,
  })),
  conversations: fixture("conversation-cascade", (userId) => ({
    userId,
    title: "chat",
    createdAt: 1,
    updatedAt: 1,
  })),
  subscriptionStates: fixture("subscription-inactive", (userId) => ({
    userId,
    plan: "pro",
    billingCycle: "monthly",
    status: "active",
    trialUsed: false,
    createdAt: 1,
    updatedAt: 1,
  })),
  connections: fixture("connection-revoke", (userId) => ({
    userId,
    provider: "executor",
    status: "connected",
    mcpUrl: "https://mcp.example.test/mcp",
    issuer: "https://auth.example.test",
    clientRowId: NO_ID("oauthClients") as Id<"oauthClients">,
    connectedAt: 1,
    createdAt: 1,
    updatedAt: 1,
  })),
  connectionSecrets: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    connectionId: NO_ID("connections") as Id<"connections">,
    accessTokenCipher: "v1.fixture.cipher",
    refreshTokenCipher: "v1.fixture.cipher",
    keyVersion: 1,
    createdAt: 1,
    updatedAt: 1,
  })),
  oauthPending: fixture("pending-scrub", (userId) => ({
    userId,
    provider: "executor",
    stateHash: fakeDigest(4),
    codeVerifierCipher: "v1.fixture.cipher",
    keyVersion: 1,
    issuer: "https://auth.example.test",
    resource: "https://mcp.example.test/mcp",
    redirectUri: "https://example.convex.site/connections/executor/callback",
    clientRowId: NO_ID("oauthClients") as Id<"oauthClients">,
    returnTo: "settings",
    expiresAt: 2,
    createdAt: 1,
    updatedAt: 1,
  })),
  connectionCalls: fixture("owned-table-soft-delete", (userId) => ({
    userId,
    connectionId: NO_ID("connections") as Id<"connections">,
    kind: "tool_call",
    tool: "search",
    decision: "auto",
    outcome: "ok",
    createdAt: 1,
    updatedAt: 1,
  })),
};

/** Tables with no `userId` that are not part of the auth library, and why that is fine. */
const NON_USER_ID_TABLES = {
  users: "the account row; softDeleteUserAccount patches it directly",
  messages: "parent-owned through conversationId; soft-deleted with its conversation",
  oauthClients:
    "one OAuth client per issuer and redirect URI, shared by the deployment (#989); holds no person's data",
} as const;

type TableDefinitionShape = {
  validator: GenericValidator;
  " indexes"(): { indexDescriptor: string; fields: string[] }[];
};

const schemaTables = schema.tables as unknown as Record<string, TableDefinitionShape>;

function fieldMaps(validator: GenericValidator): Record<string, GenericValidator>[] {
  if (validator.kind === "object") {
    return [validator.fields];
  }
  if (validator.kind === "union") {
    return validator.members.flatMap(fieldMaps);
  }
  return [];
}

/** Application tables with a `userId` field in any variant, minus the excluded names. */
function deriveOwnedTableNames(
  tables: Record<string, { validator: GenericValidator }>,
  excluded: ReadonlySet<string>,
): string[] {
  return Object.entries(tables)
    .filter(([name]) => !excluded.has(name))
    .filter(([, table]) => fieldMaps(table.validator).some((fields) => "userId" in fields))
    .map(([name]) => name)
    .sort();
}

const AUTH_TABLE_NAMES: ReadonlySet<string> = new Set(Object.keys(authTables));
const FIXTURE_TABLE_NAMES = Object.keys(OWNED_FIXTURES).sort();

function declaredFieldNames(table: string): Set<string> {
  return new Set(fieldMaps(schemaTables[table].validator).flatMap((fields) => Object.keys(fields)));
}

function indexesOf(table: string) {
  return schemaTables[table][" indexes"]();
}

function describeValidator(validator: GenericValidator): string {
  switch (validator.kind) {
    case "id":
      return `id:${validator.tableName}`;
    case "literal":
      return `literal:${String(validator.value)}`;
    case "union":
      return `union(${validator.members.map(describeValidator).join("|")})`;
    default:
      return validator.kind;
  }
}

/** `name -> kind`, with a trailing `?` for optional fields. Top-level object tables only. */
function fieldShape(table: string): Record<string, string> {
  const maps = fieldMaps(schemaTables[table].validator);
  expect(maps).toHaveLength(1);
  return Object.fromEntries(
    Object.entries(maps[0]).map(([name, field]) => [
      name,
      `${describeValidator(field)}${field.isOptional === "optional" ? "?" : ""}`,
    ]),
  );
}

/** Like `describeValidator`, but descends into objects and arrays so nested shapes are exact. */
function describeDeep(validator: GenericValidator): string {
  switch (validator.kind) {
    case "id":
      return `id:${validator.tableName}`;
    case "literal":
      return `literal:${String(validator.value)}`;
    case "array":
      return `array<${describeDeep(validator.element)}>`;
    case "object":
      return `{${Object.entries(validator.fields)
        .map(
          ([name, field]) =>
            `${name}${field.isOptional === "optional" ? "?" : ""}:${describeDeep(field)}`,
        )
        .join(",")}}`;
    case "union":
      return `union(${validator.members.map(describeDeep).join("|")})`;
    default:
      return validator.kind;
  }
}

/** `name -> deep shape`, with a trailing `?` on optional fields. Top-level object tables only. */
function deepFieldShape(table: string): Record<string, string> {
  const maps = fieldMaps(schemaTables[table].validator);
  expect(maps).toHaveLength(1);
  return Object.fromEntries(
    Object.entries(maps[0]).map(([name, field]) => [
      name,
      `${describeDeep(field)}${field.isOptional === "optional" ? "?" : ""}`,
    ]),
  );
}

/** Every validator kind reachable from a table, so blob-like kinds can be ruled out. */
function reachableKinds(validator: GenericValidator): Set<string> {
  const kinds = new Set<string>([validator.kind]);
  const children: GenericValidator[] =
    validator.kind === "object"
      ? Object.values(validator.fields)
      : validator.kind === "union"
        ? validator.members
        : validator.kind === "array"
          ? [validator.element]
          : [];
  for (const child of children) {
    for (const kind of reachableKinds(child)) {
      kinds.add(kind);
    }
  }
  return kinds;
}

/** Dotted paths of every string-valued leaf, e.g. `payload.splices[].removedText`. */
function stringLeafPaths(validator: GenericValidator, path = ""): string[] {
  switch (validator.kind) {
    case "string":
      return [path];
    case "object":
      return Object.entries(validator.fields).flatMap(([name, field]) =>
        stringLeafPaths(field, path ? `${path}.${name}` : name),
      );
    case "union":
      return validator.members.flatMap((member) => stringLeafPaths(member, path));
    case "array":
      return stringLeafPaths(validator.element, `${path}[]`);
    default:
      return [];
  }
}

function fixtureFor(table: string): {
  lifecycle: Lifecycle;
  live: (userId: Id<"users">) => Record<string, unknown>;
} {
  return (OWNED_FIXTURES as Record<string, ReturnType<typeof fixtureFor>>)[table];
}

/** A copy of `row` that softDeleteUserAccount must leave exactly as it is. */
function alreadyHandled(
  lifecycle: Lifecycle,
  row: Record<string, unknown>,
  at: number,
): Record<string, unknown> | null {
  switch (lifecycle) {
    case "token-revoke":
      return { ...row, tokenHash: `${String(row.tokenHash)}-revoked`, revokedAt: at };
    case "subscription-inactive":
      return null;
    default:
      return { ...row, deletedAt: at };
  }
}

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !Object.is(before[key], after[key])).sort();
}

/** Fake ctx where hard deletes, component calls and scheduling are trapped and recorded. */
function lifecycleCtx(userId: string, extraUsers: string[] = []) {
  const ctx = handlerCtx(userId, extraUsers);
  const forbiddenCalls: string[] = [];
  const trap =
    (name: string) =>
    (..._args: unknown[]) => {
      forbiddenCalls.push(name);
      throw new Error(`${name} must not be called by account soft deletion`);
    };
  ctx.db.delete = trap("db.delete");
  ctx.runQuery = trap("runQuery");
  ctx.runMutation = trap("runMutation");
  ctx.runAction = trap("runAction");
  ctx.scheduler = { runAfter: trap("scheduler.runAfter"), runAt: trap("scheduler.runAt") };
  return { ctx, forbiddenCalls };
}

async function readAll(ctx: ReturnType<typeof handlerCtx>, ids: readonly string[]) {
  return Promise.all(ids.map((id) => ctx.db.get(id)));
}

describe("account lifecycle coverage is derived from the schema", () => {
  test("every application table with userId has a typed lifecycle fixture", () => {
    const derived = deriveOwnedTableNames(schemaTables, AUTH_TABLE_NAMES);
    expect(derived).toEqual(FIXTURE_TABLE_NAMES);
    expect(derived).toContain("chatRequests");
    expect(derived).toContain("noteBlocks");
    expect(derived).toContain("pageOperations");
    expect(derived).toContain("pageOperationPayloads");
    expect(derived).toContain("pageProposals");
  });

  test("excluding authTables is not vacuous, and the account and parent-owned tables are explicit", () => {
    const withAuth = deriveOwnedTableNames(schemaTables, new Set());
    expect(withAuth).toContain("authSessions");
    expect(withAuth).toContain("authAccounts");
    for (const name of Object.keys(authTables).filter((table) => table !== "users")) {
      expect(FIXTURE_TABLE_NAMES).not.toContain(name);
    }

    const owned = new Set(deriveOwnedTableNames(schemaTables, AUTH_TABLE_NAMES));
    const unclassified = Object.keys(schemaTables).filter(
      (name) =>
        !owned.has(name) &&
        !(AUTH_TABLE_NAMES.has(name) && name !== "users") &&
        !(name in NON_USER_ID_TABLES),
    );
    expect(unclassified).toEqual([]);
    expect(Object.keys(NON_USER_ID_TABLES).sort()).toEqual(["messages", "oauthClients", "users"]);
    expect(declaredFieldNames("oauthClients").has("userId")).toBe(false);
    expect(declaredFieldNames("messages").has("conversationId")).toBe(true);
    expect(declaredFieldNames("messages").has("userId")).toBe(false);
  });

  test("a newly added owned table without a fixture is reported as uncovered", () => {
    const withNewTable = {
      ...schemaTables,
      brandNewOwned: { validator: defineTable({ userId: v.id("users"), label: v.string() }).validator },
      brandNewUnion: {
        validator: defineTable(
          v.union(
            v.object({ kind: v.literal("a"), userId: v.id("users") }),
            v.object({ kind: v.literal("b"), n: v.number() }),
          ),
        ).validator,
      },
      brandNewChild: { validator: defineTable({ parentId: v.string() }).validator },
    };
    const uncovered = deriveOwnedTableNames(withNewTable, AUTH_TABLE_NAMES).filter(
      (name) => !FIXTURE_TABLE_NAMES.includes(name),
    );
    expect(uncovered).toEqual(["brandNewOwned", "brandNewUnion"]);
  });

  test("USER_OWNED_TABLES is exactly the generic soft-delete fixtures", () => {
    const generic = FIXTURE_TABLE_NAMES.filter(
      (name) => fixtureFor(name).lifecycle === "owned-table-soft-delete",
    );
    const exported: string[] = [...USER_OWNED_TABLES].sort();
    expect(exported).toEqual(generic);
    expect(USER_OWNED_TABLES).toContain("chatRequests");
    expect(USER_OWNED_TABLES).toContain("noteBlocks");
    expect(USER_OWNED_TABLES).toContain("pageOperations");
    expect(USER_OWNED_TABLES).toContain("pageOperationPayloads");
    expect(USER_OWNED_TABLES).toContain("pageProposals");
    expect(USER_OWNED_TABLES).toContain("connectionSecrets");
    expect(USER_OWNED_TABLES).toContain("connectionCalls");
  });

  test("each lifecycle's tables declare the fields and by_userId index deletion relies on", () => {
    for (const name of FIXTURE_TABLE_NAMES) {
      const { lifecycle } = fixtureFor(name);
      const fields = declaredFieldNames(name);
      expect(indexesOf(name).some((index) => index.indexDescriptor === "by_userId")).toBe(true);
      if (lifecycle === "token-revoke") {
        expect(fields.has("revokedAt")).toBe(true);
      } else if (lifecycle === "subscription-inactive") {
        expect(fields.has("status")).toBe(true);
        expect(fields.has("updatedAt")).toBe(true);
      } else {
        expect(fields.has("deletedAt")).toBe(true);
      }
      if (lifecycle === "connection-revoke") {
        expect(fields.has("status")).toBe(true);
        expect(fields.has("updatedAt")).toBe(true);
      }
      if (lifecycle === "pending-scrub") {
        expect(fields.has("codeVerifierCipher")).toBe(true);
        expect(fields.has("updatedAt")).toBe(true);
      }
    }
  });

  test("every owned fixture is deleted, isolated from a second user, and idempotent", async () => {
    const { ctx, forbiddenCalls } = lifecycleCtx("users:a", ["users:b"]);
    const now = 1_800_000_000_000;
    const earlier = now - 10;
    const userA = asUserId("users:a");
    const userB = asUserId("users:b");

    const liveA = new Map<string, string>();
    const handledA = new Map<string, string>();
    const liveB = new Map<string, string>();
    for (const table of FIXTURE_TABLE_NAMES) {
      const fx = fixtureFor(table);
      liveA.set(table, await ctx.db.insert(table, fx.live(userA)));
      liveB.set(table, await ctx.db.insert(table, fx.live(userB)));
      const handled = alreadyHandled(fx.lifecycle, fx.live(userA), earlier);
      if (handled) {
        handledA.set(table, await ctx.db.insert(table, handled));
      }
    }
    const messageA = await ctx.db.insert("messages", {
      conversationId: liveA.get("conversations"),
      role: "user",
      content: "hello",
      createdAt: 1,
    });
    const messageB = await ctx.db.insert("messages", {
      conversationId: liveB.get("conversations"),
      role: "user",
      content: "hello",
      createdAt: 1,
    });

    const beforeLiveA = new Map<string, Record<string, unknown>>();
    for (const [table, id] of liveA) {
      beforeLiveA.set(table, { ...(await ctx.db.get(id)) });
    }
    const handledIds = [...handledA.values()];
    const isolatedIds = [...liveB.values(), messageB, "users:b"];
    const beforeHandled = await readAll(ctx, handledIds);
    const beforeIsolated = await readAll(ctx, isolatedIds);

    // One count for the account row, one per live owned fixture row, one for the message.
    const result = await softDeleteUserAccount(ctx, userA, now);
    expect(result).toEqual({ deletedCount: 1 + FIXTURE_TABLE_NAMES.length + 1 });

    for (const table of FIXTURE_TABLE_NAMES) {
      const { lifecycle } = fixtureFor(table);
      const before = beforeLiveA.get(table) as Record<string, unknown>;
      const after = await ctx.db.get(liveA.get(table) as string);
      if (lifecycle === "token-revoke") {
        expect(after.revokedAt, table).toBe(now);
        expect(changedKeys(before, after), table).toEqual(["revokedAt"]);
      } else if (lifecycle === "subscription-inactive") {
        expect(after.status, table).toBe("inactive");
        expect(changedKeys(before, after), table).toEqual(["status", "updatedAt"]);
        expect(after.updatedAt, table).toBe(now);
      } else if (lifecycle === "connection-revoke") {
        expect(after.status, table).toBe("revoking");
        expect(after.deletedAt, table).toBe(now);
        expect(after.updatedAt, table).toBe(now);
        expect(changedKeys(before, after), table).toEqual(["deletedAt", "status", "updatedAt"]);
      } else if (lifecycle === "pending-scrub") {
        expect(after.codeVerifierCipher, table).toBeUndefined();
        expect(after.deletedAt, table).toBe(now);
        expect(after.updatedAt, table).toBe(now);
        expect(changedKeys(before, after), table).toEqual(["codeVerifierCipher", "deletedAt", "updatedAt"]);
      } else {
        const stampsUpdatedAt = declaredFieldNames(table).has("updatedAt");
        expect(after.deletedAt, table).toBe(now);
        if (stampsUpdatedAt) {
          expect(after.updatedAt, table).toBe(now);
        }
        expect(changedKeys(before, after), table).toEqual(
          stampsUpdatedAt ? ["deletedAt", "updatedAt"] : ["deletedAt"],
        );
      }
    }

    expect((await ctx.db.get(messageA)).deletedAt).toBe(now);
    expect(await ctx.db.get("users:a")).toMatchObject({ deletedAt: now, isActive: false, updatedAt: now });
    expect(await readAll(ctx, handledIds)).toEqual(beforeHandled);
    expect(await readAll(ctx, isolatedIds)).toEqual(beforeIsolated);
    expect(forbiddenCalls).toEqual([]);

    const allIds = [...liveA.values(), ...handledIds, ...isolatedIds, messageA, "users:a"];
    const afterFirst = await readAll(ctx, allIds);
    expect(await softDeleteUserAccount(ctx, userA, now + 1)).toEqual({ deletedCount: 0 });
    expect(await readAll(ctx, allIds)).toEqual(afterFirst);
    expect(forbiddenCalls).toEqual([]);
  });
});

describe("chat request and page block account lifecycle", () => {
  const now = 1_800_000_000_000;
  const earlier = now - 10;

  async function seed() {
    const { ctx, forbiddenCalls } = lifecycleCtx("users:a", ["users:b"]);
    const userA = asUserId("users:a");
    const userB = asUserId("users:b");
    const conversationA = await ctx.db.insert("conversations", {
      userId: userA,
      title: "chat",
      createdAt: 1,
      updatedAt: 1,
      agentThreadId: "agent-thread-a",
      nextChatSequence: 3,
      chatGenerationEpoch: 2,
    });
    const conversationB = await ctx.db.insert("conversations", {
      userId: userB,
      title: "other chat",
      createdAt: 1,
      updatedAt: 1,
      agentThreadId: "agent-thread-b",
    });
    const request = (
      userId: Id<"users">,
      conversationId: string,
      requestKey: string,
      sequence: number,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      conversationId,
      requestKey,
      payloadDigest: `${sequence}`.padStart(64, "0"),
      sequence,
      status: "queued",
      agentPromptMessageId: `agent-prompt-${requestKey}`,
      generationEpoch: 2,
      createdAt: 1,
      updatedAt: 5,
      ...overrides,
    });
    const queued = await ctx.db.insert("chatRequests", request(userA, conversationA, "queued_1", 2));
    const running = await ctx.db.insert(
      "chatRequests",
      request(userA, conversationA, "running_1", 1, {
        status: "running",
        generationLeaseExpiresAtMs: now + 60_000,
      }),
    );
    const completed = await ctx.db.insert(
      "chatRequests",
      request(userA, conversationA, "done_1", 0, {
        status: "completed",
        agentResultMessageId: "agent-result-done_1",
      }),
    );
    const alreadyDeleted = await ctx.db.insert(
      "chatRequests",
      request(userA, conversationA, "gone_1", 3, { status: "cancelled", deletedAt: earlier, updatedAt: earlier }),
    );
    const requestB = await ctx.db.insert(
      "chatRequests",
      request(userB, conversationB, "running_1", 1, { status: "running" }),
    );
    await ctx.db.patch(conversationA, { activeChatRequestId: running });

    const block = (userId: Id<"users">, noteId: string, extra: Record<string, unknown>) => ({
      userId,
      noteId,
      position: 0,
      createdAt: 1,
      updatedAt: 5,
      ...extra,
    });
    const blockMeta = await ctx.db.insert(
      "noteBlocks",
      block(userA, "notes:a", {
        type: "page-meta",
        blockId: "meta",
        v: 1,
        data: { pageType: "plain", tags: [] },
      }),
    );
    const blockBroken = await ctx.db.insert(
      "noteBlocks",
      block(userA, "notes:a", { type: "broken", errorCode: "malformed_json" }),
    );
    const blockAlreadyDeleted = await ctx.db.insert(
      "noteBlocks",
      block(userA, "notes:a", {
        type: "broken",
        errorCode: "invalid_data",
        deletedAt: earlier,
        updatedAt: earlier,
      }),
    );
    const blockB = await ctx.db.insert(
      "noteBlocks",
      block(userB, "notes:b", { type: "broken", errorCode: "malformed_json" }),
    );

    return {
      ctx,
      forbiddenCalls,
      userA,
      conversationA,
      conversationB,
      running,
      liveRequests: [queued, running, completed],
      alreadyDeleted,
      requestB,
      liveBlocks: [blockMeta, blockBroken],
      blockAlreadyDeleted,
      blockB,
    };
  }

  test("chatRequests and noteBlocks are tombstoned with one timestamp and nothing else changes", async () => {
    const s = await seed();
    const before = await readAll(s.ctx, [...s.liveRequests, ...s.liveBlocks]);

    // Account, 3 live requests, 2 live blocks and the conversation.
    expect(await softDeleteUserAccount(s.ctx, s.userA, now)).toEqual({ deletedCount: 1 + 3 + 2 + 1 });

    const after = await readAll(s.ctx, [...s.liveRequests, ...s.liveBlocks]);
    after.forEach((row, index) => {
      expect(row.deletedAt).toBe(now);
      expect(row.updatedAt).toBe(now);
      expect(changedKeys(before[index], row)).toEqual(["deletedAt", "updatedAt"]);
    });

    // Statuses and Agent links are untouched: no cancellation is faked and nothing is cleared.
    expect(after.map((row) => row.status ?? row.type)).toEqual([
      "queued",
      "running",
      "completed",
      "page-meta",
      "broken",
    ]);
    expect(after[0].agentPromptMessageId).toBe("agent-prompt-queued_1");
    expect(after[2].agentResultMessageId).toBe("agent-result-done_1");
    expect(after[1].generationLeaseExpiresAtMs).toBe(now + 60_000);
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("already-deleted rows keep their timestamps and a second user's rows are untouched", async () => {
    const s = await seed();
    const keep = [s.alreadyDeleted, s.blockAlreadyDeleted, s.requestB, s.blockB, s.conversationB];
    const before = await readAll(s.ctx, keep);
    await softDeleteUserAccount(s.ctx, s.userA, now);
    expect(await readAll(s.ctx, keep)).toEqual(before);
    expect((await s.ctx.db.get(s.alreadyDeleted)).deletedAt).toBe(earlier);
    expect((await s.ctx.db.get(s.alreadyDeleted)).updatedAt).toBe(earlier);
    expect((await s.ctx.db.get(s.requestB)).deletedAt).toBeUndefined();
    expect((await s.ctx.db.get(s.blockB)).deletedAt).toBeUndefined();
  });

  test("repeated deletion preserves the first deletion timestamp", async () => {
    const s = await seed();
    const ids = [...s.liveRequests, ...s.liveBlocks, s.alreadyDeleted, s.blockAlreadyDeleted];
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const afterFirst = await readAll(s.ctx, ids);
    expect(await softDeleteUserAccount(s.ctx, s.userA, now + 5_000)).toEqual({ deletedCount: 0 });
    expect(await readAll(s.ctx, ids)).toEqual(afterFirst);
  });

  test("Agent-linked conversation references stay intact and no component delete runs", async () => {
    const s = await seed();
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const conversation = await s.ctx.db.get(s.conversationA);
    expect(conversation).toMatchObject({
      deletedAt: now,
      agentThreadId: "agent-thread-a",
      nextChatSequence: 3,
      chatGenerationEpoch: 2,
      activeChatRequestId: s.running,
    });
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("account restoration does not restore tombstoned chat requests or page blocks", async () => {
    const s = await seed();
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const restore = signInRestorePatch(await s.ctx.db.get("users:a"), now + 1);
    expect(restore).not.toBeNull();
    await s.ctx.db.patch("users:a", restore);
    for (const id of [...s.liveRequests, ...s.liveBlocks]) {
      expect((await s.ctx.db.get(id)).deletedAt).toBe(now);
    }
  });

  test("a legacy conversation without chat fields stays valid and gains none", async () => {
    const legacy: WithoutSystemFields<Doc<"conversations">> = {
      userId: asUserId("users:a"),
      title: "legacy",
      createdAt: 1,
      updatedAt: 1,
    };
    const { ctx } = lifecycleCtx("users:a");
    const id = await ctx.db.insert("conversations", legacy);
    await softDeleteUserAccount(ctx, asUserId("users:a"), now);
    const after = await ctx.db.get(id);
    expect(Object.keys(after).sort()).toEqual(
      ["_creationTime", "_id", "createdAt", "deletedAt", "title", "updatedAt", "userId"].sort(),
    );
  });
});

describe("chat lifecycle schema contract (#807)", () => {
  const LEGACY_CONVERSATION_SHAPE = {
    userId: "id:users",
    title: "string",
    technique: "string?",
    createdAt: "float64",
    updatedAt: "float64",
    deletedAt: "float64?",
  };
  const CHAT_CONVERSATION_FIELDS = {
    agentThreadId: "string?",
    nextChatSequence: "float64?",
    chatGenerationEpoch: "float64?",
    activeChatRequestId: "id:chatRequests?",
  };

  test("conversations gain exactly four optional fields and keep every legacy field and index", () => {
    expect(fieldShape("conversations")).toEqual({
      ...LEGACY_CONVERSATION_SHAPE,
      ...CHAT_CONVERSATION_FIELDS,
    });
    for (const shape of Object.values(CHAT_CONVERSATION_FIELDS)) {
      expect(shape.endsWith("?")).toBe(true);
    }
    expect(indexesOf("conversations")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_updatedAt", fields: ["userId", "updatedAt"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
    ]);
  });

  test("a legacy conversation row validates: every field it lacks is optional", () => {
    const legacyKeys = ["userId", "title", "createdAt", "updatedAt"];
    const [fields] = fieldMaps(schemaTables.conversations.validator);
    const required = Object.entries(fields)
      .filter(([, field]) => field.isOptional === "required")
      .map(([name]) => name)
      .sort();
    expect(required).toEqual([...legacyKeys].sort());
  });

  test("chatRequests is one content-free table with the agreed fields", () => {
    expect(fieldShape("chatRequests")).toEqual({
      userId: "id:users",
      conversationId: "id:conversations",
      requestKey: "string",
      payloadDigest: "string",
      sequence: "float64",
      status:
        "union(literal:queued|literal:running|literal:completed|literal:failed|literal:cancelled)",
      agentPromptMessageId: "string",
      generationEpoch: "float64",
      createdAt: "float64",
      updatedAt: "float64",
      agentResultMessageId: "string?",
      generationLeaseExpiresAtMs: "float64?",
      deletedAt: "float64?",
    });
    const contentFields = ["prompt", "reply", "content", "text", "body", "error", "payload"];
    for (const field of declaredFieldNames("chatRequests")) {
      expect(contentFields).not.toContain(field);
    }
  });

  test("chatRequests has the five ordinary indexes in order", () => {
    expect(indexesOf("chatRequests")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      {
        indexDescriptor: "by_userId_conversationId_requestKey",
        fields: ["userId", "conversationId", "requestKey"],
      },
      {
        indexDescriptor: "by_userId_conversationId_deletedAt_sequence",
        fields: ["userId", "conversationId", "deletedAt", "sequence"],
      },
      {
        indexDescriptor: "by_userId_conversationId_deletedAt_status_sequence",
        fields: ["userId", "conversationId", "deletedAt", "status", "sequence"],
      },
    ]);
  });

  test("memories keeps its indexes and adds the bounded live-memory index", () => {
    expect(indexesOf("memories")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_salience", fields: ["userId", "salience"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      {
        indexDescriptor: "by_userId_deletedAt_salience_updatedAt",
        fields: ["userId", "deletedAt", "salience", "updatedAt"],
      },
    ]);
    // Exact owner + live prefix first, then the descending salience/updatedAt order.
    const added = indexesOf("memories").at(-1);
    expect(added?.fields.slice(0, 2)).toEqual(["userId", "deletedAt"]);
    expect(added?.fields.slice(2)).toEqual(["salience", "updatedAt"]);
  });
});

const PAGE_LEDGER_TABLES = ["pageOperations", "pageOperationPayloads", "pageProposals"] as const;

describe("page ledger account lifecycle (#828)", () => {
  const now = 1_800_000_000_000;
  const earlier = now - 10;
  const appliedAt = now - 1_000_000;

  async function seed() {
    const { ctx, forbiddenCalls } = lifecycleCtx("users:a", ["users:b"]);
    const userA = asUserId("users:a");
    const userB = asUserId("users:b");

    // Legacy notes: no `revision` key anywhere. Deleting the account must not add one.
    const note = (userId: Id<"users">) => ({
      userId,
      title: "note",
      body: "body",
      pinned: false,
      periodType: "none",
      createdAt: 1,
      updatedAt: 5,
    });
    const noteA = await ctx.db.insert("notes", note(userA));
    const noteB = await ctx.db.insert("notes", note(userB));

    const operation = (
      userId: Id<"users">,
      noteId: string,
      n: number,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      noteId,
      requestId: fakeRequestId(n),
      requestDigest: fakeDigest(n),
      kind: "save",
      source: "ui",
      result: "applied",
      affectsBody: true,
      baseRevision: n,
      resultRevision: n + 1,
      baseBodyDigest: fakeDigest(n + 100),
      resultBodyDigest: fakeDigest(n + 101),
      delta: [{ startUtf16: 0, removedLengthUtf16: 1, insertedLengthUtf16: 2 }],
      appliedAtMs: appliedAt,
      undoUntilMs: appliedAt + 7,
      metadataExpiresAtMs: appliedAt + 11,
      createdAt: appliedAt,
      updatedAt: appliedAt,
      ...overrides,
    });
    const opApplied = await ctx.db.insert("pageOperations", operation(userA, noteA, 1));
    const opUndo = await ctx.db.insert(
      "pageOperations",
      operation(userA, noteA, 2, {
        kind: "undo",
        undoOfOperationId: opApplied,
        undoUntilMs: undefined,
      }),
    );
    await ctx.db.patch(opApplied, { undoneAtMs: appliedAt + 3, undoneByOperationId: opUndo });
    const opNoop = await ctx.db.insert(
      "pageOperations",
      operation(userA, noteA, 3, {
        result: "noop",
        affectsBody: false,
        baseRevision: 2,
        resultRevision: 2,
        resultBodyDigest: fakeDigest(103),
        delta: [],
        undoUntilMs: undefined,
      }),
    );
    const opAlreadyDeleted = await ctx.db.insert(
      "pageOperations",
      operation(userA, noteA, 4, { deletedAt: earlier, updatedAt: earlier }),
    );
    const opB = await ctx.db.insert("pageOperations", operation(userB, noteB, 1));

    const payload = (
      userId: Id<"users">,
      noteId: string,
      operationId: string,
      state: Record<string, unknown>,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      noteId,
      operationId,
      undoUntilMs: appliedAt + 7,
      cleanupDueAtMs: appliedAt + 9,
      payload: state,
      createdAt: appliedAt,
      updatedAt: appliedAt,
      ...overrides,
    });
    const available = {
      state: "available",
      splices: [{ startUtf16: 4, removedText: "synthetic-old", insertedText: "synthetic-new" }],
    };
    const expired = { state: "expired", expiredAtMs: appliedAt + 10 };
    const payloadAvailable = await ctx.db.insert(
      "pageOperationPayloads",
      payload(userA, noteA, opApplied, available),
    );
    const payloadExpired = await ctx.db.insert(
      "pageOperationPayloads",
      payload(userA, noteA, opNoop, expired),
    );
    const payloadAlreadyDeleted = await ctx.db.insert(
      "pageOperationPayloads",
      payload(userA, noteA, opAlreadyDeleted, available, { deletedAt: earlier, updatedAt: earlier }),
    );
    const payloadB = await ctx.db.insert(
      "pageOperationPayloads",
      payload(userB, noteB, opB, available),
    );

    const proposal = (
      userId: Id<"users">,
      noteId: string,
      conversationId: string,
      key: string,
      status: string,
      state: Record<string, unknown>,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      kind: "add_task_to_today",
      schemaVersion: 1,
      noteId,
      localDate: "2026-10-11",
      conversationId,
      sourceRequestKey: key,
      proposalRevision: 0,
      expectedPageRevision: 1,
      blockId: "blk_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      status,
      proposalExpiresAtMs: appliedAt + 5,
      cleanupDueAtMs: appliedAt + 6,
      metadataExpiresAtMs: appliedAt + 13,
      payload: state,
      createdAt: appliedAt,
      updatedAt: appliedAt,
      ...overrides,
    });
    const taskAvailable = {
      state: "available",
      task: { title: "Synthetic task", durationMin: 15 },
    };
    const taskExpired = { state: "expired", expiredAtMs: appliedAt + 12 };
    const conversationA = NO_ID("conversations");
    const conversationB = "conversations:other";
    const proposalPending = await ctx.db.insert(
      "pageProposals",
      proposal(userA, noteA, conversationA, "pending_1", "pending", taskAvailable),
    );
    const proposalConfirmed = await ctx.db.insert(
      "pageProposals",
      proposal(userA, noteA, conversationA, "confirmed_1", "confirmed", taskExpired, {
        decidedAtMs: appliedAt + 2,
        confirmedOperationId: opApplied,
        confirmDigest: fakeDigest(9),
      }),
    );
    const proposalRejected = await ctx.db.insert(
      "pageProposals",
      proposal(userA, noteA, conversationA, "rejected_1", "rejected", taskExpired, {
        decidedAtMs: appliedAt + 2,
      }),
    );
    const proposalExpired = await ctx.db.insert(
      "pageProposals",
      proposal(userA, noteA, conversationA, "expired_1", "expired", taskExpired),
    );
    const proposalAlreadyDeleted = await ctx.db.insert(
      "pageProposals",
      proposal(userA, noteA, conversationA, "gone_1", "cancelled", taskExpired, {
        deletedAt: earlier,
        updatedAt: earlier,
      }),
    );
    const proposalB = await ctx.db.insert(
      "pageProposals",
      proposal(userB, noteB, conversationB, "pending_1", "pending", taskAvailable),
    );

    return {
      ctx,
      forbiddenCalls,
      userA,
      noteA,
      liveOperations: [opApplied, opUndo, opNoop],
      livePayloads: [payloadAvailable, payloadExpired],
      liveProposals: [proposalPending, proposalConfirmed, proposalRejected, proposalExpired],
      alreadyDeleted: [opAlreadyDeleted, payloadAlreadyDeleted, proposalAlreadyDeleted],
      foreign: [opB, payloadB, proposalB, noteB],
      payloadAvailable,
      payloadExpired,
      proposalConfirmed,
    };
  }

  const liveLedgerIds = (s: Awaited<ReturnType<typeof seed>>) => [
    ...s.liveOperations,
    ...s.livePayloads,
    ...s.liveProposals,
  ];

  test("operations, payloads and proposals are tombstoned with one timestamp and nothing else changes", async () => {
    const s = await seed();
    const ids = liveLedgerIds(s);
    const before = await readAll(s.ctx, ids);
    const beforeNote = await s.ctx.db.get(s.noteA);

    // Account row, the legacy note, 3 operations, 2 payloads and 4 proposals.
    expect(await softDeleteUserAccount(s.ctx, s.userA, now)).toEqual({
      deletedCount: 1 + 1 + ids.length,
    });

    const after = await readAll(s.ctx, ids);
    after.forEach((row, index) => {
      expect(row.deletedAt).toBe(now);
      expect(row.updatedAt).toBe(now);
      expect(changedKeys(before[index], row)).toEqual(["deletedAt", "updatedAt"]);
    });

    // The legacy note is tombstoned like any note and does not gain a revision.
    const afterNote = await s.ctx.db.get(s.noteA);
    expect(changedKeys(beforeNote, afterNote)).toEqual(["deletedAt", "updatedAt"]);
    expect("revision" in afterNote).toBe(false);

    // No hard delete, Agent or component call, or scheduled cleanup.
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("available and expired payload variants keep their fragments, markers and expiry metadata", async () => {
    const s = await seed();
    const [availableBefore, expiredBefore] = await readAll(s.ctx, [
      s.payloadAvailable,
      s.payloadExpired,
    ]);
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const [availableAfter, expiredAfter] = await readAll(s.ctx, [
      s.payloadAvailable,
      s.payloadExpired,
    ]);

    // Soft deletion is a tombstone, not cleanup: the available form is not rewritten to expired
    // and its fragments are not erased.
    expect(availableAfter.payload).toEqual(availableBefore.payload);
    expect(availableAfter.payload.state).toBe("available");
    expect(availableAfter.payload.splices).toHaveLength(1);
    expect(expiredAfter.payload).toEqual(expiredBefore.payload);
    expect(expiredAfter.payload.state).toBe("expired");
    expect("splices" in expiredAfter.payload).toBe(false);
    for (const [beforeRow, afterRow] of [
      [availableBefore, availableAfter],
      [expiredBefore, expiredAfter],
    ]) {
      expect(afterRow.undoUntilMs).toBe(beforeRow.undoUntilMs);
      expect(afterRow.cleanupDueAtMs).toBe(beforeRow.cleanupDueAtMs);
      expect(afterRow.operationId).toBe(beforeRow.operationId);
      expect(afterRow.noteId).toBe(beforeRow.noteId);
    }
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("operation receipts and proposals keep their links, statuses and expiry metadata", async () => {
    const s = await seed();
    const ids = [...s.liveOperations, ...s.liveProposals];
    const before = await readAll(s.ctx, ids);
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const after = await readAll(s.ctx, ids);
    const keep = [
      "status",
      "payload",
      "result",
      "kind",
      "affectsBody",
      "undoUntilMs",
      "undoneAtMs",
      "undoneByOperationId",
      "undoOfOperationId",
      "confirmedOperationId",
      "confirmDigest",
      "decidedAtMs",
      "proposalExpiresAtMs",
      "cleanupDueAtMs",
      "metadataExpiresAtMs",
    ];
    after.forEach((row, index) => {
      for (const key of keep) {
        expect(row[key], `${row._id}.${key}`).toEqual(before[index][key]);
      }
    });
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("already-deleted rows keep their timestamps and foreign-user rows are untouched", async () => {
    const s = await seed();
    const keep = [...s.alreadyDeleted, ...s.foreign];
    const before = await readAll(s.ctx, keep);
    await softDeleteUserAccount(s.ctx, s.userA, now);
    expect(await readAll(s.ctx, keep)).toEqual(before);
    for (const id of s.alreadyDeleted) {
      const row = await s.ctx.db.get(id);
      expect(row.deletedAt).toBe(earlier);
      expect(row.updatedAt).toBe(earlier);
    }
    for (const id of s.foreign) {
      expect((await s.ctx.db.get(id)).deletedAt).toBeUndefined();
    }
  });

  test("repeated deletion preserves the first deletion timestamp", async () => {
    const s = await seed();
    const ids = [...liveLedgerIds(s), ...s.alreadyDeleted];
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const afterFirst = await readAll(s.ctx, ids);
    expect(await softDeleteUserAccount(s.ctx, s.userA, now + 5_000)).toEqual({ deletedCount: 0 });
    expect(await readAll(s.ctx, ids)).toEqual(afterFirst);
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("account restoration does not resurrect tombstoned rows or expired Undo and proposal eligibility", async () => {
    const s = await seed();
    const ids = [...liveLedgerIds(s), ...s.alreadyDeleted];
    const before = await readAll(s.ctx, ids);
    await softDeleteUserAccount(s.ctx, s.userA, now);
    const restore = signInRestorePatch(await s.ctx.db.get("users:a"), now + 1);
    expect(restore).not.toBeNull();
    await s.ctx.db.patch("users:a", restore);

    const after = await readAll(s.ctx, ids);
    after.forEach((row, index) => {
      // Restoring the account row restores nothing else: live rows stay tombstoned at the
      // account deletion time and independently deleted children keep their earlier time.
      expect(row.deletedAt).toBe(before[index].deletedAt ?? now);
      expect(row.payload).toEqual(before[index].payload);
      expect(row.status).toBe(before[index].status);
      expect(row.undoUntilMs).toBe(before[index].undoUntilMs);
      expect(row.cleanupDueAtMs).toBe(before[index].cleanupDueAtMs);
    });
    expect((await s.ctx.db.get(s.payloadExpired)).payload.state).toBe("expired");
    expect((await s.ctx.db.get(s.proposalConfirmed)).payload.state).toBe("expired");
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("with no page-ledger rows the deletion count and behaviour are unchanged", async () => {
    const { ctx, forbiddenCalls } = lifecycleCtx("users:a");
    const noteId = await ctx.db.insert("notes", {
      userId: asUserId("users:a"),
      title: "legacy",
      body: "body",
      pinned: false,
      periodType: "none",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await softDeleteUserAccount(ctx, asUserId("users:a"), now)).toEqual({ deletedCount: 2 });
    expect((await ctx.db.get(noteId)).deletedAt).toBe(now);
    expect(forbiddenCalls).toEqual([]);
  });
});

describe("page ledger schema contract (#828)", () => {
  const LEGACY_NOTE_SHAPE = {
    userId: "id:users",
    title: "string",
    body: "string",
    pinned: "boolean",
    periodType: "union(literal:daily|literal:weekly|literal:monthly|literal:none)",
    pageType: "union(literal:daily|literal:weekly|literal:project|literal:plain|literal:template)?",
    date: "string?",
    aiGenerated: "boolean?",
    createdAt: "float64",
    updatedAt: "float64",
    deletedAt: "float64?",
  };

  test("notes gains exactly one optional revision and keeps every legacy field and index", () => {
    expect(deepFieldShape("notes")).toEqual({ ...LEGACY_NOTE_SHAPE, revision: "float64?" });
    expect(indexesOf("notes")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_pinned", fields: ["userId", "pinned"] },
      { indexDescriptor: "by_userId_updatedAt", fields: ["userId", "updatedAt"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      {
        indexDescriptor: "by_userId_deletedAt_pageType_date",
        fields: ["userId", "deletedAt", "pageType", "date"],
      },
    ]);
  });

  test("a legacy note row validates: revision is optional and body stays the canonical required text", () => {
    const [fields] = fieldMaps(schemaTables.notes.validator);
    expect(fields.revision.isOptional).toBe("optional");
    expect(fields.body.isOptional).toBe("required");
    const required = Object.entries(fields)
      .filter(([, field]) => field.isOptional === "required")
      .map(([name]) => name)
      .sort();
    expect(required).toEqual(
      ["body", "createdAt", "periodType", "pinned", "title", "updatedAt", "userId"].sort(),
    );
  });

  test("pageOperations is one content-free table with the agreed fields and indexes", () => {
    expect(deepFieldShape("pageOperations")).toEqual({
      userId: "id:users",
      noteId: "id:notes",
      requestId: "string",
      requestDigest: "string",
      kind: "union(literal:save|literal:patch_block|literal:add_task|literal:undo)",
      source: "union(literal:ui|literal:coach|literal:mcp|literal:legacy)",
      result: "union(literal:applied|literal:noop)",
      affectsBody: "boolean",
      baseRevision: "float64",
      resultRevision: "float64",
      baseBodyDigest: "string",
      resultBodyDigest: "string",
      delta: "array<{startUtf16:float64,removedLengthUtf16:float64,insertedLengthUtf16:float64}>",
      appliedAtMs: "float64",
      undoUntilMs: "float64?",
      undoneAtMs: "float64?",
      undoneByOperationId: "id:pageOperations?",
      undoOfOperationId: "id:pageOperations?",
      proposalId: "id:pageProposals?",
      metadataExpiresAtMs: "float64",
      createdAt: "float64",
      updatedAt: "float64",
      deletedAt: "float64?",
    });
    expect(indexesOf("pageOperations")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      { indexDescriptor: "by_userId_requestId", fields: ["userId", "requestId"] },
      {
        indexDescriptor: "by_userId_noteId_affectsBody_resultRevision",
        fields: ["userId", "noteId", "affectsBody", "resultRevision"],
      },
      { indexDescriptor: "by_metadataExpiresAtMs", fields: ["metadataExpiresAtMs"] },
    ]);
  });

  test("pageOperationPayloads is a strict available or expired union with the agreed indexes", () => {
    expect(deepFieldShape("pageOperationPayloads")).toEqual({
      userId: "id:users",
      noteId: "id:notes",
      operationId: "id:pageOperations",
      undoUntilMs: "float64",
      cleanupDueAtMs: "float64",
      payload:
        "union({state:literal:available,splices:array<{startUtf16:float64,removedText:string,insertedText:string}>}|{state:literal:expired,expiredAtMs:float64})",
      createdAt: "float64",
      updatedAt: "float64",
      deletedAt: "float64?",
    });
    expect(indexesOf("pageOperationPayloads")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      { indexDescriptor: "by_userId_operationId", fields: ["userId", "operationId"] },
      {
        indexDescriptor: "by_userId_noteId_deletedAt",
        fields: ["userId", "noteId", "deletedAt"],
      },
      { indexDescriptor: "by_cleanupDueAtMs", fields: ["cleanupDueAtMs"] },
    ]);
  });

  test("pageProposals is one pending add-task action with the agreed fields and indexes", () => {
    expect(deepFieldShape("pageProposals")).toEqual({
      userId: "id:users",
      kind: "literal:add_task_to_today",
      schemaVersion: "literal:1",
      noteId: "id:notes",
      localDate: "string",
      conversationId: "id:conversations",
      sourceRequestKey: "string",
      sourceAgentPromptId: "string?",
      proposalRevision: "float64",
      expectedPageRevision: "float64",
      blockId: "string",
      status:
        "union(literal:pending|literal:confirmed|literal:rejected|literal:cancelled|literal:expired)",
      proposalExpiresAtMs: "float64",
      cleanupDueAtMs: "float64",
      metadataExpiresAtMs: "float64",
      payload:
        "union({state:literal:available,task:{title:string,durationMin:float64}}|{state:literal:expired,expiredAtMs:float64})",
      decidedAtMs: "float64?",
      confirmedOperationId: "id:pageOperations?",
      confirmDigest: "string?",
      createdAt: "float64",
      updatedAt: "float64",
      deletedAt: "float64?",
    });
    expect(indexesOf("pageProposals")).toEqual([
      { indexDescriptor: "by_userId", fields: ["userId"] },
      { indexDescriptor: "by_userId_deletedAt", fields: ["userId", "deletedAt"] },
      {
        indexDescriptor: "by_userId_noteId_deletedAt",
        fields: ["userId", "noteId", "deletedAt"],
      },
      {
        indexDescriptor: "by_userId_conversationId_sourceRequestKey",
        fields: ["userId", "conversationId", "sourceRequestKey"],
      },
      { indexDescriptor: "by_cleanupDueAtMs", fields: ["cleanupDueAtMs"] },
      { indexDescriptor: "by_metadataExpiresAtMs", fields: ["metadataExpiresAtMs"] },
    ]);
  });

  test("every new table carries the owner, audit and soft-delete fields and the owner indexes", () => {
    for (const table of PAGE_LEDGER_TABLES) {
      const [fields] = fieldMaps(schemaTables[table].validator);
      expect(fields.userId.kind, table).toBe("id");
      expect(fields.createdAt.isOptional, table).toBe("required");
      expect(fields.updatedAt.isOptional, table).toBe("required");
      expect(fields.deletedAt.isOptional, table).toBe("optional");
      const names = indexesOf(table).map((index) => index.indexDescriptor);
      expect(names, table).toContain("by_userId");
      expect(names, table).toContain("by_userId_deletedAt");
      expect(fixtureFor(table).lifecycle, table).toBe("owned-table-soft-delete");
    }
  });

  test("no unknown-content blobs, and source text appears only in the private payload table", () => {
    for (const table of PAGE_LEDGER_TABLES) {
      const kinds = reachableKinds(schemaTables[table].validator);
      for (const blob of ["any", "record", "bytes", "int64"]) {
        expect(kinds.has(blob), `${table} must not use ${blob}`).toBe(false);
      }
    }
    const strings = Object.fromEntries(
      PAGE_LEDGER_TABLES.map((table) => [
        table,
        stringLeafPaths(schemaTables[table].validator).sort(),
      ]),
    );
    expect(strings.pageOperations).toEqual([
      "baseBodyDigest",
      "requestDigest",
      "requestId",
      "resultBodyDigest",
    ]);
    expect(strings.pageOperationPayloads).toEqual([
      "payload.splices[].insertedText",
      "payload.splices[].removedText",
    ]);
    expect(strings.pageProposals).toEqual([
      "blockId",
      "confirmDigest",
      "localDate",
      "payload.task.title",
      "sourceAgentPromptId",
      "sourceRequestKey",
    ]);
    // No copied prompt, reply, memory, audio, error or whole-body field anywhere.
    const forbidden = [
      "prompt",
      "reply",
      "content",
      "text",
      "body",
      "error",
      "memory",
      "audio",
      "snapshot",
    ];
    for (const table of PAGE_LEDGER_TABLES) {
      for (const field of declaredFieldNames(table)) {
        expect(forbidden, `${table}.${field}`).not.toContain(field);
      }
    }
  });

  test("Agent ids stay strings and are never cast to host table ids", () => {
    const [fields] = fieldMaps(schemaTables.pageProposals.validator);
    expect(fields.sourceAgentPromptId.kind).toBe("string");
    expect(fields.sourceRequestKey.kind).toBe("string");
    expect(fields.conversationId.kind).toBe("id");
    // chatRequests is resolved through (owner, conversation, key), not stored as an id.
    expect(declaredFieldNames("pageProposals").has("chatRequestId")).toBe(false);
  });

  test("payload variants are strict unions at the type level", () => {
    type OperationPayload = Doc<"pageOperationPayloads">["payload"];
    type ProposalPayload = Doc<"pageProposals">["payload"];
    const operationPayloads: OperationPayload[] = [
      { state: "available", splices: [{ startUtf16: 0, removedText: "a", insertedText: "b" }] },
      { state: "expired", expiredAtMs: 1 },
      // @ts-expect-error an expired marker carries no fragments
      { state: "expired", expiredAtMs: 1, splices: [] },
      // @ts-expect-error an available payload has no expiry marker and needs its splices
      { state: "available", expiredAtMs: 1 },
    ];
    const proposalPayloads: ProposalPayload[] = [
      { state: "available", task: { title: "t", durationMin: 15 } },
      { state: "expired", expiredAtMs: 1 },
      // @ts-expect-error an expired marker carries no task content
      { state: "expired", expiredAtMs: 1, task: { title: "t", durationMin: 15 } },
    ];
    expect(operationPayloads).toHaveLength(4);
    expect(proposalPayloads).toHaveLength(3);
  });
});

describe("softDeleteUserAccount", () => {
  test("deletes all owned data, revokes tokens, and remains isolated and idempotent", async () => {
    const ctx = handlerCtx("users:a", ["users:b"]);
    const now = 1_800_000_000_000;
    const taskA = await ctx.db.insert("tasks", { userId: "users:a", deletedAt: undefined });
    const taskB = await ctx.db.insert("tasks", { userId: "users:b", deletedAt: undefined });
    const nagA = await ctx.db.insert("nags", { userId: "users:a", deletedAt: undefined });
    const oldDeletedAt = now - 10;
    const alreadyDeletedNag = await ctx.db.insert("nags", {
      userId: "users:a",
      deletedAt: oldDeletedAt,
    });
    const settingsA = await ctx.db.insert("coachSettings", {
      userId: "users:a",
      dial: 9,
      taskLoad: 4,
      acceptedStreak: 3,
      updatedAt: 1,
    });
    const proposalA = await ctx.db.insert("coachProposals", {
      userId: "users:a",
      status: "pending",
      taskIds: [],
      tenSecondAction: "start",
      realism: { ok: true, totalMinutes: 0, availableMinutes: 120, note: "" },
      createdAt: 1,
    });
    const tokenA = await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "old-token",
      name: "old",
      prefix: "old",
      createdAt: 1,
    });
    const alreadyRevoked = await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "revoked-token",
      name: "revoked",
      prefix: "revoked",
      createdAt: 1,
      revokedAt: oldDeletedAt,
    });
    const tokenB = await ctx.db.insert("mcpTokens", {
      userId: "users:b",
      tokenHash: "other-token",
      name: "other",
      prefix: "other",
      createdAt: 1,
    });

    expect(await softDeleteUserAccount(ctx, asUserId("users:a"), now)).toEqual({ deletedCount: 6 });
    expect(await softDeleteUserAccount(ctx, asUserId("users:a"), now + 1)).toEqual({
      deletedCount: 0,
    });

    for (const id of [taskA, nagA, settingsA, proposalA]) {
      expect((await ctx.db.get(id)).deletedAt).toBe(now);
    }
    expect((await ctx.db.get(tokenA)).revokedAt).toBe(now);
    expect((await ctx.db.get(alreadyDeletedNag)).deletedAt).toBe(oldDeletedAt);
    expect((await ctx.db.get(alreadyRevoked)).revokedAt).toBe(oldDeletedAt);
    expect((await ctx.db.get(taskB)).deletedAt).toBeUndefined();
    expect((await ctx.db.get(tokenB)).revokedAt).toBeUndefined();
  });

  test("restoring the account does not restore deleted coach/nag data or old MCP credentials", async () => {
    const ctx = handlerCtx("users:a");
    const now = 1_800_000_000_000;
    const nagId = await ctx.db.insert("nags", {
      userId: "users:a",
      label: "old nag",
      enabled: true,
      phrases: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("coachSettings", {
      userId: "users:a",
      dial: 9,
      taskLoad: 4,
      acceptedStreak: 3,
      updatedAt: 1,
    });
    const proposalId = await ctx.db.insert("coachProposals", {
      userId: "users:a",
      status: "pending",
      taskIds: [],
      tenSecondAction: "start",
      realism: { ok: true, totalMinutes: 0, availableMinutes: 120, note: "" },
      createdAt: 1,
    });
    await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "old-token",
      name: "old",
      prefix: "old",
      createdAt: 1,
    });

    await softDeleteUserAccount(ctx, asUserId("users:a"), now);
    expect(await run(mcp.resolveToken, ctx, { tokenHash: "old-token" })).toBeNull();

    const user = await ctx.db.get("users:a");
    const restore = signInRestorePatch(user, now + 1);
    expect(restore).not.toBeNull();
    await ctx.db.patch("users:a", restore);

    expect(await run(mcp.resolveToken, ctx, { tokenHash: "old-token" })).toBeNull();
    expect(await run(nags.list, ctx, {})).toEqual([]);
    expect(await run(coach.getSettings, ctx, {})).toEqual({
      dial: 5,
      taskLoad: 2,
      panicUntil: null,
      acceptedStreak: 0,
    });
    expect(await run(coach.currentProposal, ctx, {})).toBeNull();
    await expect(
      run(coach.decideProposal, ctx, { proposalId, decision: "reject" }),
    ).rejects.toThrow("Proposal not found");
    expect((await ctx.db.get(nagId)).deletedAt).toBe(now);
  });
});

describe("page privacy guards (#808)", () => {
  const appliedAt = 1_800_000_000_000;
  const undoWindowMs = 300_000;
  const proposalWindowMs = 86_400_000;
  const inWindow = appliedAt + 1_000;
  const lastGoodMs = appliedAt + undoWindowMs - 1;
  const closedMs = appliedAt + undoWindowMs;
  const deletedAt = appliedAt + 2_000;

  async function seed() {
    const { ctx, forbiddenCalls } = lifecycleCtx("users:a", ["users:b"]);
    const userA = asUserId("users:a");
    const userB = asUserId("users:b");

    const note = (userId: Id<"users">, title: string) => ({
      userId,
      title,
      body: "synthetic body",
      pinned: false,
      periodType: "none",
      createdAt: 1,
      updatedAt: 5,
    });
    const noteA = await ctx.db.insert("notes", note(userA, "page one"));
    const noteA2 = await ctx.db.insert("notes", note(userA, "page two"));
    const noteB = await ctx.db.insert("notes", note(userB, "other page"));

    const conversation = (userId: Id<"users">, agentThreadId?: string) => ({
      userId,
      title: "chat",
      createdAt: 1,
      updatedAt: 1,
      ...(agentThreadId === undefined ? {} : { agentThreadId }),
    });
    const convA = await ctx.db.insert("conversations", conversation(userA, "agent-thread-a"));
    const convNoThread = await ctx.db.insert("conversations", conversation(userA));
    const convB = await ctx.db.insert("conversations", conversation(userB, "agent-thread-b"));

    const chatRequest = (
      userId: Id<"users">,
      conversationId: string,
      requestKey: string,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      conversationId,
      requestKey,
      payloadDigest: fakeDigest(7),
      sequence: 0,
      status: "completed",
      agentPromptMessageId: `agent-prompt-${requestKey}`,
      agentResultMessageId: `agent-result-${requestKey}`,
      generationEpoch: 0,
      createdAt: 1,
      updatedAt: 5,
      ...overrides,
    });
    const reqA = await ctx.db.insert("chatRequests", chatRequest(userA, convA, "key_a"));
    const reqGone = await ctx.db.insert(
      "chatRequests",
      chatRequest(userA, convA, "key_gone", { deletedAt: 3, updatedAt: 3 }),
    );
    // Same key as A's, different owner: lookups must stay owner-scoped.
    const reqB = await ctx.db.insert("chatRequests", chatRequest(userB, convB, "key_a"));
    // Indexes are not unique constraints: two rows for one key must be refused, not guessed at.
    await ctx.db.insert("chatRequests", chatRequest(userA, convA, "key_dup"));
    await ctx.db.insert("chatRequests", chatRequest(userA, convA, "key_dup"));

    const block = (
      userId: Id<"users">,
      noteId: string,
      position: number,
      extra: Record<string, unknown> = {},
    ) => ({
      userId,
      noteId,
      type: "broken",
      errorCode: "malformed_json",
      position,
      createdAt: 1,
      updatedAt: 5,
      ...extra,
    });
    await ctx.db.insert("noteBlocks", block(userA, noteA, 0));
    await ctx.db.insert("noteBlocks", block(userA, noteA, 1));
    await ctx.db.insert("noteBlocks", block(userA, noteA, 2, { deletedAt: 3 }));
    await ctx.db.insert("noteBlocks", block(userA, noteA2, 0));
    await ctx.db.insert("noteBlocks", block(userB, noteB, 0));

    const operation = (
      userId: Id<"users">,
      noteId: string,
      n: number,
      overrides: Record<string, unknown> = {},
    ) => ({
      userId,
      noteId,
      requestId: fakeRequestId(n),
      requestDigest: fakeDigest(n),
      kind: "add_task",
      source: "coach",
      result: "applied",
      affectsBody: true,
      baseRevision: n,
      resultRevision: n + 1,
      baseBodyDigest: fakeDigest(n + 100),
      resultBodyDigest: fakeDigest(n + 101),
      delta: [{ startUtf16: 0, removedLengthUtf16: 0, insertedLengthUtf16: 4 }],
      appliedAtMs: appliedAt,
      undoUntilMs: appliedAt + undoWindowMs,
      metadataExpiresAtMs: appliedAt + 172_800_000,
      createdAt: appliedAt,
      updatedAt: appliedAt,
      ...overrides,
    });
    const available = {
      state: "available",
      splices: [{ startUtf16: 0, removedText: "", insertedText: "synthetic" }],
    };
    const payload = (
      userId: Id<"users">,
      noteId: string,
      operationId: string,
      state: Record<string, unknown> = available,
    ) => ({
      userId,
      noteId,
      operationId,
      undoUntilMs: appliedAt + undoWindowMs,
      // Cleanup is due five minutes after the window, so it has not run at `closedMs`.
      cleanupDueAtMs: appliedAt + 2 * undoWindowMs,
      payload: state,
      createdAt: appliedAt,
      updatedAt: appliedAt,
    });

    const ops: Record<string, string> = {};
    const addOp = async (
      name: string,
      userId: Id<"users">,
      noteId: string,
      n: number,
      overrides: Record<string, unknown> = {},
      payloadState: Record<string, unknown> | null = available,
      payloadNoteId = noteId,
    ) => {
      const id = await ctx.db.insert("pageOperations", operation(userId, noteId, n, overrides));
      if (payloadState) {
        await ctx.db.insert(
          "pageOperationPayloads",
          payload(userId, payloadNoteId, id, payloadState),
        );
      }
      ops[name] = id;
      return id;
    };

    const live = await addOp("live", userA, noteA, 1);
    const receipt = await addOp(
      "undoReceipt",
      userA,
      noteA,
      2,
      { kind: "undo", undoOfOperationId: live, undoUntilMs: undefined },
      null,
    );
    await addOp(
      "done",
      userA,
      noteA,
      3,
      { undoneAtMs: appliedAt + 5, undoneByOperationId: receipt },
      null,
    );
    await addOp("malformed", userA, noteA, 4, { undoneAtMs: appliedAt + 5 }, null);
    // A malformed undo receipt that still carries a window and fragments is not undoable.
    await addOp("undoWithPayload", userA, noteA, 13, { kind: "undo", undoOfOperationId: live });
    await addOp(
      "noop",
      userA,
      noteA,
      5,
      {
        result: "noop",
        affectsBody: false,
        resultRevision: 5,
        resultBodyDigest: fakeDigest(105),
        delta: [],
        undoUntilMs: undefined,
      },
      null,
    );
    await addOp("stale", userA, noteA, 6, {}, { state: "expired", expiredAtMs: appliedAt + 10 });
    await addOp("noPayload", userA, noteA, 7, {}, null);
    await addOp("twoPayloads", userA, noteA, 8);
    await ctx.db.insert("pageOperationPayloads", payload(userA, noteA, ops.twoPayloads));
    await addOp("wrongNote", userA, noteA, 9, {}, available, noteA2);
    ops.foreignPayloadOnly = await ctx.db.insert("pageOperations", operation(userA, noteA, 10));
    await ctx.db.insert("pageOperationPayloads", payload(userB, noteB, ops.foreignPayloadOnly));
    await addOp("onPageTwo", userA, noteA2, 11);
    // Two receipts for one request id.
    await addOp("duplicate", userA, noteA, 12, {}, null);
    await ctx.db.insert("pageOperations", operation(userA, noteA, 12));
    // Same request id as A's "live" operation, other owner.
    await addOp("foreign", userB, noteB, 1);

    const taskAvailable = {
      state: "available",
      task: { title: "Synthetic task", durationMin: 15 },
    };
    const taskExpired = { state: "expired", expiredAtMs: appliedAt + 12 };
    const props: Record<string, string> = {};
    const addProposal = async (
      name: string,
      userId: Id<"users">,
      noteId: string,
      conversationId: string,
      sourceRequestKey: string,
      status: string,
      state: Record<string, unknown>,
      overrides: Record<string, unknown> = {},
    ) => {
      props[name] = await ctx.db.insert("pageProposals", {
        userId,
        kind: "add_task_to_today",
        schemaVersion: 1,
        noteId,
        localDate: "2026-10-11",
        conversationId,
        sourceRequestKey,
        proposalRevision: 0,
        expectedPageRevision: 1,
        blockId: "blk_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        status,
        proposalExpiresAtMs: appliedAt + proposalWindowMs,
        cleanupDueAtMs: appliedAt + proposalWindowMs + undoWindowMs,
        metadataExpiresAtMs: appliedAt + 172_800_000,
        payload: state,
        createdAt: appliedAt,
        updatedAt: appliedAt,
        ...overrides,
      });
    };
    const A = userA;
    await addProposal("pending", A, noteA, convA, "key_a", "pending", taskAvailable);
    await addProposal("pageTwo", A, noteA2, convA, "key_a", "pending", taskAvailable);
    // Decided proposals keep their content until the cleanup job runs; access must end sooner.
    await addProposal("confirmed", A, noteA, convA, "key_a", "confirmed", taskAvailable, {
      decidedAtMs: appliedAt + 2,
      confirmedOperationId: live,
      confirmDigest: fakeDigest(9),
    });
    await addProposal("rejected", A, noteA, convA, "key_a", "rejected", taskAvailable, {
      decidedAtMs: appliedAt + 2,
    });
    await addProposal("cancelled", A, noteA, convA, "key_a", "cancelled", taskAvailable, {
      decidedAtMs: appliedAt + 2,
    });
    await addProposal("expiredStatus", A, noteA, convA, "key_a", "expired", taskExpired);
    await addProposal("markerOnly", A, noteA, convA, "key_a", "pending", taskExpired);
    await addProposal("noSource", A, noteA, convA, "key_missing", "pending", taskAvailable);
    await addProposal("goneSource", A, noteA, convA, "key_gone", "pending", taskAvailable);
    await addProposal("dupSource", A, noteA, convA, "key_dup", "pending", taskAvailable);
    await addProposal("foreign", userB, noteB, convB, "key_a", "pending", taskAvailable);

    return {
      ctx,
      forbiddenCalls,
      userA,
      userB,
      noteA,
      noteA2,
      noteB,
      convA,
      convNoThread,
      convB,
      reqA,
      reqGone,
      reqB,
      ops,
      props,
    };
  }

  type Seed = Awaited<ReturnType<typeof seed>>;
  type Calls = Record<string, () => Promise<unknown>>;
  type Outcome = PagePrivacyDenial | "ok";

  const opId = (s: Seed, name: string) => s.ops[name] as Id<"pageOperations">;
  const propId = (s: Seed, name: string) => s.props[name] as Id<"pageProposals">;

  /** Every guard once, for one caller, against the main page, chat, operation and proposal. */
  function everyGuard(s: Seed, ctx = s.ctx, userId = s.userA, now = inWindow): Calls {
    return {
      owner: () => requireActiveOwner(ctx, userId),
      page: () => requireLivePage(ctx, userId, s.noteA),
      blocks: () => readLivePageBlocks(ctx, userId, s.noteA),
      conversation: () => requireLiveConversation(ctx, userId, s.convA),
      thread: () => requireLiveAgentThread(ctx, userId, s.convA),
      chatRequest: () => requireLiveChatRequest(ctx, userId, s.reqA),
      operation: () => requireLiveOperation(ctx, userId, opId(s, "live")),
      receipt: () => findLiveOperationReceipt(ctx, userId, fakeRequestId(1)),
      undo: () => requireUndoAccess(ctx, { userId, operationId: opId(s, "live"), now }),
      proposal: () => requireLiveProposal(ctx, userId, propId(s, "pending")),
      pending: () => requirePendingProposal(ctx, { userId, proposalId: propId(s, "pending"), now }),
    };
  }

  const GUARD_NAMES = [
    "owner",
    "page",
    "blocks",
    "conversation",
    "thread",
    "chatRequest",
    "operation",
    "receipt",
    "undo",
    "proposal",
    "pending",
  ];
  const allOk: Record<string, Outcome> = Object.fromEntries(
    GUARD_NAMES.map((name) => [name, "ok"]),
  );

  async function outcomes(calls: Calls): Promise<Record<string, Outcome>> {
    const out: Record<string, Outcome> = {};
    for (const [name, call] of Object.entries(calls)) {
      try {
        await call();
        out[name] = "ok";
      } catch (error) {
        if (!(error instanceof PagePrivacyError)) {
          throw error;
        }
        out[name] = error.code;
      }
    }
    return out;
  }

  async function codeOf(call: () => Promise<unknown>): Promise<Outcome> {
    return (await outcomes({ call })).call;
  }

  test("a live owner reaches every guarded record and gets back the stored rows", async () => {
    const s = await seed();
    expect(await outcomes(everyGuard(s))).toEqual(allOk);

    const thread = await requireLiveAgentThread(s.ctx, s.userA, s.convA);
    expect(thread.agentThreadId).toBe("agent-thread-a");
    expect(thread.conversation._id).toBe(s.convA);

    const request = await requireLiveChatRequest(s.ctx, s.userA, s.reqA, s.convA);
    expect(request.request.agentPromptMessageId).toBe("agent-prompt-key_a");
    expect(request.conversation._id).toBe(s.convA);

    const pending = await requirePendingProposal(s.ctx, {
      userId: s.userA,
      proposalId: propId(s, "pending"),
      now: inWindow,
    });
    expect(pending.task).toEqual({ title: "Synthetic task", durationMin: 15 });
    expect(pending.note._id).toBe(s.noteA);

    const found = await findLiveOperationReceipt(s.ctx, s.userA, fakeRequestId(1));
    expect(found?.operation._id).toBe(opId(s, "live"));
    expect(await findLiveOperationReceipt(s.ctx, s.userA, fakeRequestId(99))).toBeNull();
    // The other owner's receipt for the same request id is a different row.
    const foreign = await findLiveOperationReceipt(s.ctx, s.userB, fakeRequestId(1));
    expect(foreign?.operation._id).toBe(opId(s, "foreign"));
  });

  test("another person's ids and missing ids are refused identically, with no id in the message", async () => {
    const s = await seed();
    expect(await outcomes(everyGuard(s, s.ctx, s.userB))).toEqual({
      owner: "ok",
      page: "page_unavailable",
      blocks: "page_unavailable",
      conversation: "conversation_unavailable",
      thread: "conversation_unavailable",
      chatRequest: "request_unavailable",
      operation: "operation_unavailable",
      receipt: "ok",
      undo: "operation_unavailable",
      proposal: "proposal_unavailable",
      pending: "proposal_unavailable",
    });

    const missing: Calls = {
      page: () => requireLivePage(s.ctx, s.userA, "notes:missing" as Id<"notes">),
      conversation: () =>
        requireLiveConversation(s.ctx, s.userA, "conversations:missing" as Id<"conversations">),
      chatRequest: () =>
        requireLiveChatRequest(s.ctx, s.userA, "chatRequests:missing" as Id<"chatRequests">),
      operation: () =>
        requireLiveOperation(s.ctx, s.userA, "pageOperations:missing" as Id<"pageOperations">),
      proposal: () =>
        requireLiveProposal(s.ctx, s.userA, "pageProposals:missing" as Id<"pageProposals">),
    };
    const foreignIds: Calls = {
      page: () => requireLivePage(s.ctx, s.userA, s.noteB),
      conversation: () => requireLiveConversation(s.ctx, s.userA, s.convB),
      chatRequest: () => requireLiveChatRequest(s.ctx, s.userA, s.reqB),
      operation: () => requireLiveOperation(s.ctx, s.userA, opId(s, "foreign")),
      proposal: () => requireLiveProposal(s.ctx, s.userA, propId(s, "foreign")),
    };
    for (const name of Object.keys(missing)) {
      const a = await missing[name]().catch((error: unknown) => error);
      const b = await foreignIds[name]().catch((error: unknown) => error);
      expect(a).toBeInstanceOf(PagePrivacyError);
      expect(b).toBeInstanceOf(PagePrivacyError);
      expect({
        name,
        code: (a as PagePrivacyError).code,
        message: (a as PagePrivacyError).message,
      }).toEqual({
        name,
        code: (b as PagePrivacyError).code,
        message: (b as PagePrivacyError).message,
      });
    }

    // A chat request cannot be used against a different conversation of the same owner.
    expect(await codeOf(() => requireLiveChatRequest(s.ctx, s.userA, s.reqA, s.convNoThread))).toBe(
      "request_unavailable",
    );
  });

  test("account deletion denies every guard at once, and restoring only the account row reopens nothing", async () => {
    const s = await seed();
    expect(await outcomes(everyGuard(s))).toEqual(allOk);
    const foreignBefore = await outcomes(everyGuard(s, s.ctx, s.userB));

    await softDeleteUserAccount(s.ctx, s.userA, deletedAt);
    expect(await outcomes(everyGuard(s, s.ctx, s.userA, deletedAt))).toEqual(
      Object.fromEntries(GUARD_NAMES.map((name) => [name, "account_unavailable"])),
    );
    // Also for ids the main matrix does not use.
    expect(await codeOf(() => requireLivePage(s.ctx, s.userA, s.noteA2))).toBe(
      "account_unavailable",
    );
    expect(
      await codeOf(() =>
        requirePendingProposal(s.ctx, {
          userId: s.userA,
          proposalId: propId(s, "pageTwo"),
          now: deletedAt,
        }),
      ),
    ).toBe("account_unavailable");
    expect(await outcomes(everyGuard(s, s.ctx, s.userB))).toEqual(foreignBefore);

    // The sign-in restore patch reactivates the account row but not owned rows (a reported
    // lifecycle gap). The guards must not make the tombstoned rows reachable again.
    const patch = signInRestorePatch(await s.ctx.db.get(s.userA), deletedAt + 1_000);
    expect(patch).not.toBeNull();
    await s.ctx.db.patch(s.userA, patch);
    expect(await outcomes(everyGuard(s, s.ctx, s.userA, deletedAt))).toEqual({
      owner: "ok",
      page: "page_unavailable",
      blocks: "page_unavailable",
      conversation: "conversation_unavailable",
      thread: "conversation_unavailable",
      chatRequest: "request_unavailable",
      operation: "operation_unavailable",
      receipt: "operation_unavailable",
      undo: "operation_unavailable",
      proposal: "proposal_unavailable",
      pending: "proposal_unavailable",
    });
  });

  test("a deleted note hides its blocks, receipts, Undo and proposals; the other page and the chat stay", async () => {
    const s = await seed();
    await s.ctx.db.patch(s.noteA, { deletedAt, updatedAt: deletedAt });
    expect(await outcomes(everyGuard(s))).toEqual({
      owner: "ok",
      page: "page_unavailable",
      blocks: "page_unavailable",
      conversation: "ok",
      thread: "ok",
      chatRequest: "ok",
      operation: "page_unavailable",
      receipt: "page_unavailable",
      undo: "page_unavailable",
      proposal: "page_unavailable",
      pending: "page_unavailable",
    });

    // The sibling page keeps working, including its own Undo and proposal.
    expect((await readLivePageBlocks(s.ctx, s.userA, s.noteA2)).blocks).toHaveLength(1);
    const sibling = await requireUndoAccess(s.ctx, {
      userId: s.userA,
      operationId: opId(s, "onPageTwo"),
      now: inWindow,
    });
    expect(sibling.state).toBe("eligible");
    const pending = await requirePendingProposal(s.ctx, {
      userId: s.userA,
      proposalId: propId(s, "pageTwo"),
      now: inWindow,
    });
    expect(pending.note._id).toBe(s.noteA2);
  });

  test("a deleted conversation hides its Agent thread, chat requests and proposals; pages and Undo stay", async () => {
    const s = await seed();
    await s.ctx.db.patch(s.convA, { deletedAt, updatedAt: deletedAt });
    expect(await outcomes(everyGuard(s))).toEqual({
      owner: "ok",
      page: "ok",
      blocks: "ok",
      conversation: "conversation_unavailable",
      thread: "conversation_unavailable",
      chatRequest: "conversation_unavailable",
      operation: "ok",
      receipt: "ok",
      undo: "ok",
      proposal: "proposal_unavailable",
      pending: "proposal_unavailable",
    });
    // The Agent thread id is still stored on the tombstoned host row, but no guard returns it.
    expect((await s.ctx.db.get(s.convA)).agentThreadId).toBe("agent-thread-a");
  });

  test("a conversation without an Agent thread, or with an empty one, is refused", async () => {
    const s = await seed();
    expect(await codeOf(() => requireLiveAgentThread(s.ctx, s.userA, s.convNoThread))).toBe(
      "thread_unavailable",
    );
    await s.ctx.db.patch(s.convA, { agentThreadId: "" });
    expect(await codeOf(() => requireLiveAgentThread(s.ctx, s.userA, s.convA))).toBe(
      "thread_unavailable",
    );
    // Another person's thread is never reachable through a conversation id.
    expect(await codeOf(() => requireLiveAgentThread(s.ctx, s.userA, s.convB))).toBe(
      "conversation_unavailable",
    );
    expect((await requireLiveAgentThread(s.ctx, s.userB, s.convB)).agentThreadId).toBe(
      "agent-thread-b",
    );
  });

  test("a tombstoned chat request or receipt is refused even when its conversation and page are live", async () => {
    const s = await seed();
    expect(await codeOf(() => requireLiveChatRequest(s.ctx, s.userA, s.reqGone))).toBe(
      "request_unavailable",
    );
    await s.ctx.db.patch(s.ops.live, { deletedAt, updatedAt: deletedAt });
    expect(await codeOf(() => requireLiveOperation(s.ctx, s.userA, opId(s, "live")))).toBe(
      "operation_unavailable",
    );
    // A tombstoned receipt is not treated as "no receipt": that would let its id be minted again.
    expect(await codeOf(() => findLiveOperationReceipt(s.ctx, s.userA, fakeRequestId(1)))).toBe(
      "operation_unavailable",
    );
  });

  test("a receipt lookup refuses ambiguous rows instead of guessing", async () => {
    const s = await seed();
    expect(await codeOf(() => findLiveOperationReceipt(s.ctx, s.userA, fakeRequestId(12)))).toBe(
      "operation_unavailable",
    );
  });

  test("Undo is reachable only inside its five-minute window, even while cleanup has not run", async () => {
    const s = await seed();
    const undoAt = (now: number) =>
      requireUndoAccess(s.ctx, { userId: s.userA, operationId: opId(s, "live"), now });

    expect(await codeOf(() => undoAt(appliedAt - 1))).toBe("undo_unavailable");
    for (const now of [appliedAt, inWindow, lastGoodMs]) {
      const access = await undoAt(now);
      expect(access.state).toBe("eligible");
      if (access.state === "eligible") {
        expect(access.splices).toEqual([
          { startUtf16: 0, removedText: "", insertedText: "synthetic" },
        ]);
        expect(access.operation._id).toBe(opId(s, "live"));
      }
    }
    for (const now of [closedMs, closedMs + 1, closedMs + 4 * 60_000]) {
      expect(await codeOf(() => undoAt(now))).toBe("undo_expired");
    }

    // The fragments are still stored (cleanup is due later), yet unreachable. Nothing was edited.
    const mine = (await s.ctx.db.query("pageOperationPayloads").collect()).filter(
      (row: { operationId: string }) => row.operationId === s.ops.live,
    );
    expect(mine).toHaveLength(1);
    expect(mine[0].payload.state).toBe("available");
    expect(mine[0].cleanupDueAtMs).toBeGreaterThan(closedMs + 4 * 60_000);
    expect(mine[0].deletedAt).toBeUndefined();
  });

  test("whichever of the receipt window and the payload window closes first ends access", async () => {
    for (const closing of ["pageOperations", "pageOperationPayloads"] as const) {
      const s = await seed();
      const row = (await s.ctx.db.query(closing).collect()).find(
        (candidate: { _id: string; operationId?: string }) =>
          (closing === "pageOperations" ? candidate._id : candidate.operationId) === s.ops.live,
      );
      await s.ctx.db.patch(row._id, { undoUntilMs: appliedAt + 10_000 });
      const undoAt = (now: number) =>
        requireUndoAccess(s.ctx, { userId: s.userA, operationId: opId(s, "live"), now });
      expect({ closing, state: (await undoAt(appliedAt + 9_999)).state }).toEqual({
        closing,
        state: "eligible",
      });
      expect({ closing, code: await codeOf(() => undoAt(appliedAt + 10_000)) }).toEqual({
        closing,
        code: "undo_expired",
      });
    }
  });

  test("stale, missing, ambiguous, foreign or mismatched fragments and non-undoable receipts are refused", async () => {
    const s = await seed();
    const undoOf = (name: string) =>
      codeOf(() =>
        requireUndoAccess(s.ctx, { userId: s.userA, operationId: opId(s, name), now: inWindow }),
      );
    expect({
      stale: await undoOf("stale"),
      noPayload: await undoOf("noPayload"),
      twoPayloads: await undoOf("twoPayloads"),
      wrongNote: await undoOf("wrongNote"),
      foreignPayloadOnly: await undoOf("foreignPayloadOnly"),
      noop: await undoOf("noop"),
      undoReceipt: await undoOf("undoReceipt"),
      undoWithPayload: await undoOf("undoWithPayload"),
      malformed: await undoOf("malformed"),
      foreign: await undoOf("foreign"),
    }).toEqual({
      stale: "undo_unavailable",
      noPayload: "undo_unavailable",
      twoPayloads: "undo_unavailable",
      wrongNote: "undo_unavailable",
      foreignPayloadOnly: "undo_unavailable",
      noop: "undo_unavailable",
      undoReceipt: "undo_unavailable",
      undoWithPayload: "undo_unavailable",
      malformed: "undo_unavailable",
      foreign: "operation_unavailable",
    });
  });

  test("a repeated Undo is an authorized no-op that reads no fragments, even after the window", async () => {
    const s = await seed();
    for (const now of [inWindow, closedMs + 10 * 60_000]) {
      const access = await requireUndoAccess(s.ctx, {
        userId: s.userA,
        operationId: opId(s, "done"),
        now,
      });
      expect(access.state).toBe("already_undone");
      expect("splices" in access).toBe(false);
    }
    // Privacy still comes first: a deleted page refuses the retry too.
    await s.ctx.db.patch(s.noteA, { deletedAt, updatedAt: deletedAt });
    expect(
      await codeOf(() =>
        requireUndoAccess(s.ctx, { userId: s.userA, operationId: opId(s, "done"), now: inWindow }),
      ),
    ).toBe("page_unavailable");
  });

  test("proposal content needs a pending, unexpired proposal with a live source request", async () => {
    const s = await seed();
    const pendingOf = (name: string, now = inWindow, userId = s.userA) =>
      codeOf(() => requirePendingProposal(s.ctx, { userId, proposalId: propId(s, name), now }));
    const expiresAt = appliedAt + proposalWindowMs;

    expect(await pendingOf("pending")).toBe("ok");
    expect(await pendingOf("pending", expiresAt - 1)).toBe("ok");
    // A late expiry sweep does not extend access: status is still pending, payload still stored.
    expect(await pendingOf("pending", expiresAt)).toBe("proposal_expired");
    expect(await pendingOf("pending", expiresAt + 3_600_000)).toBe("proposal_expired");

    expect({
      confirmed: await pendingOf("confirmed"),
      rejected: await pendingOf("rejected"),
      cancelled: await pendingOf("cancelled"),
      expiredStatus: await pendingOf("expiredStatus"),
      markerOnly: await pendingOf("markerOnly"),
      noSource: await pendingOf("noSource"),
      goneSource: await pendingOf("goneSource"),
      dupSource: await pendingOf("dupSource"),
      foreign: await pendingOf("foreign"),
    }).toEqual({
      confirmed: "proposal_unavailable",
      rejected: "proposal_unavailable",
      cancelled: "proposal_unavailable",
      expiredStatus: "proposal_unavailable",
      markerOnly: "proposal_unavailable",
      noSource: "proposal_unavailable",
      goneSource: "proposal_unavailable",
      dupSource: "proposal_unavailable",
      foreign: "proposal_unavailable",
    });
    expect(await pendingOf("foreign", inWindow, s.userB)).toBe("ok");
  });

  test("a confirmed proposal's receipt stays readable while its content does not", async () => {
    const s = await seed();
    const receipt = await requireLiveProposal(s.ctx, s.userA, propId(s, "confirmed"));
    expect(receipt.proposal.status).toBe("confirmed");
    expect(receipt.proposal.confirmedOperationId).toBe(opId(s, "live"));
    expect(receipt.proposal.confirmDigest).toBe(fakeDigest(9));
    // The content is still stored, but only the receipt is readable.
    const stored = await s.ctx.db.get(propId(s, "confirmed"));
    expect(stored.payload.state).toBe("available");
    expect("payload" in receipt.proposal).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain("Synthetic task");
    expect(
      await codeOf(() =>
        requirePendingProposal(s.ctx, {
          userId: s.userA,
          proposalId: propId(s, "confirmed"),
          now: inWindow,
        }),
      ),
    ).toBe("proposal_unavailable");

    await s.ctx.db.patch(s.noteA, { deletedAt, updatedAt: deletedAt });
    expect(await codeOf(() => requireLiveProposal(s.ctx, s.userA, propId(s, "confirmed")))).toBe(
      "page_unavailable",
    );
  });

  test("proposal receipts never carry content, whatever the status or how late cleanup runs", async () => {
    const s = await seed();
    const title = "Synthetic task";
    const expiresAt = appliedAt + proposalWindowMs;
    const receiptFields: readonly string[] = PROPOSAL_RECEIPT_FIELDS;

    // Every row below still holds its content in storage (cleanup has not run), except the two
    // that already carry an expired marker. The guard must not depend on that.
    const stored: Record<string, string> = {};
    const names = [
      "pending",
      "confirmed",
      "rejected",
      "cancelled",
      "expiredStatus",
      "markerOnly",
    ] as const;
    for (const name of names) {
      stored[name] = (await s.ctx.db.get(propId(s, name))).payload.state;
    }
    expect(stored).toEqual({
      pending: "available",
      confirmed: "available",
      rejected: "available",
      cancelled: "available",
      expiredStatus: "expired",
      markerOnly: "expired",
    });

    for (const name of names) {
      const result = await requireLiveProposal(s.ctx, s.userA, propId(s, name));
      const extraKeys = Object.keys(result.proposal).filter((key) => !receiptFields.includes(key));
      expect({
        name,
        hasPayload: "payload" in result.proposal,
        extraKeys,
        leaked: JSON.stringify(result).includes(title),
        id: result.proposal._id,
      }).toEqual({
        name,
        hasPayload: false,
        extraKeys: [],
        leaked: false,
        id: propId(s, name),
      });
    }
    const confirmed = await requireLiveProposal(s.ctx, s.userA, propId(s, "confirmed"));
    expect(confirmed.proposal).toMatchObject({
      status: "confirmed",
      proposalRevision: 0,
      expectedPageRevision: 1,
      confirmDigest: fakeDigest(9),
      confirmedOperationId: opId(s, "live"),
      decidedAtMs: appliedAt + 2,
      proposalExpiresAtMs: expiresAt,
    });

    // Late cleanup: the proposal is still `pending` with its content stored, but past its expiry
    // (and past the point cleanup was due). Neither guard returns the content.
    const cleanupDue = appliedAt + proposalWindowMs + undoWindowMs;
    const late = await requireLiveProposal(s.ctx, s.userA, propId(s, "pending"));
    expect(late.proposal.cleanupDueAtMs).toBe(cleanupDue);
    expect("payload" in late.proposal).toBe(false);
    for (const now of [expiresAt, cleanupDue - 1, cleanupDue, cleanupDue + 3_600_000]) {
      const error = await requirePendingProposal(s.ctx, {
        userId: s.userA,
        proposalId: propId(s, "pending"),
        now,
      }).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect({ now, code: (error as PagePrivacyError | null)?.code }).toEqual({
        now,
        code: "proposal_expired",
      });
      expect(String((error as PagePrivacyError).message)).not.toContain(title);
    }

    // A decided proposal never reaches the content path at any time, in or out of the window.
    for (const name of ["confirmed", "rejected", "cancelled"] as const) {
      for (const now of [inWindow, expiresAt - 1, expiresAt, cleanupDue + 1]) {
        expect({
          name,
          now,
          code: await codeOf(() =>
            requirePendingProposal(s.ctx, { userId: s.userA, proposalId: propId(s, name), now }),
          ),
        }).toEqual({
          name,
          now,
          code: "proposal_unavailable",
        });
      }
    }
  });

  test("a pending, unexpired proposal returns its task, and only as `task`", async () => {
    const s = await seed();
    const title = "Synthetic task";
    const expiresAt = appliedAt + proposalWindowMs;
    for (const now of [appliedAt, inWindow, expiresAt - 1]) {
      const result = await requirePendingProposal(s.ctx, {
        userId: s.userA,
        proposalId: propId(s, "pending"),
        now,
      });
      expect(result.task).toEqual({ title, durationMin: 15 });
      expect(result.proposal._id).toBe(propId(s, "pending"));
      expect(result.proposal.status).toBe("pending");
      expect("payload" in result.proposal).toBe(false);
      // The title is not reachable through any other field of the result.
      expect(JSON.stringify({ ...result, task: undefined })).not.toContain(title);
    }
  });

  test("Undo fragments are returned only to an eligible operation inside its window", async () => {
    const s = await seed();
    const windowEnd = appliedAt + undoWindowMs;
    const times = [
      appliedAt - 1,
      appliedAt,
      inWindow,
      lastGoodMs,
      closedMs,
      closedMs + 1,
      closedMs + 4 * 60_000,
      closedMs + 10 * 60_000,
    ];
    const eligibleOps = new Set(["live", "onPageTwo"]);
    const observed: Record<string, boolean> = {};
    const expected: Record<string, boolean> = {};
    for (const name of Object.keys(s.ops)) {
      for (const now of times) {
        const key = `${name}@${now - appliedAt}`;
        let text: string;
        try {
          text = JSON.stringify(
            await requireUndoAccess(s.ctx, { userId: s.userA, operationId: opId(s, name), now }),
          );
        } catch (error) {
          if (!(error instanceof PagePrivacyError)) {
            throw error;
          }
          text = JSON.stringify({ code: error.code, message: error.message });
        }
        observed[key] = text.includes("insertedText") || text.includes("removedText");
        expected[key] = eligibleOps.has(name) && now >= appliedAt && now < windowEnd;
      }
    }
    expect(observed).toEqual(expected);
    // The fragments themselves are still stored when the window has closed; only access ended.
    const stored = (await s.ctx.db.query("pageOperationPayloads").collect()).filter(
      (row: { operationId: string }) => row.operationId === s.ops.live,
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].payload.state).toBe("available");
  });

  test("page block reads are live, owner-scoped and bounded", async () => {
    const s = await seed();
    const all = await readLivePageBlocks(s.ctx, s.userA, s.noteA);
    expect(all.blocks.map((row) => row.position)).toEqual([0, 1]);
    expect(all.blocks.every((row) => row.noteId === s.noteA && row.deletedAt === undefined)).toBe(
      true,
    );
    expect(all.truncated).toBe(false);
    expect(all.note._id).toBe(s.noteA);

    const one = await readLivePageBlocks(s.ctx, s.userA, s.noteA, 1);
    expect(one.blocks).toHaveLength(1);
    expect(one.truncated).toBe(true);
    const exact = await readLivePageBlocks(s.ctx, s.userA, s.noteA, 2);
    expect(exact.blocks).toHaveLength(2);
    expect(exact.truncated).toBe(false);

    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(readLivePageBlocks(s.ctx, s.userA, s.noteA, bad)).rejects.toThrow(RangeError);
    }
  });

  test("a late result is rejected at the committing mutation once the account, page or chat is deleted", async () => {
    // Stand-ins for the activating mutations: re-check inside the commit, then write.
    const commitProposal = async (s: Seed, now: number) => {
      const { note } = await requirePendingProposal(s.ctx, {
        userId: s.userA,
        proposalId: propId(s, "pending"),
        now,
      });
      await s.ctx.db.patch(note._id, { body: `${note.body}\nlate task`, updatedAt: now });
    };
    const completeChat = async (s: Seed, now: number) => {
      const { request } = await requireLiveChatRequest(s.ctx, s.userA, s.reqA, s.convA);
      await s.ctx.db.patch(request._id, {
        status: "completed",
        agentResultMessageId: "agent-result-late",
        updatedAt: now,
      });
    };
    const state = async (s: Seed) => ({
      body: (await s.ctx.db.get(s.noteA)).body,
      result: (await s.ctx.db.get(s.reqA)).agentResultMessageId,
    });
    const codeFrom = async (call: () => Promise<unknown>): Promise<Outcome> =>
      codeOf(async () => {
        await call();
      });

    // Control: before any deletion the same commits succeed, so the rejections below are real.
    const control = await seed();
    expect(await codeFrom(() => commitProposal(control, inWindow))).toBe("ok");
    expect(await codeFrom(() => completeChat(control, inWindow))).toBe("ok");
    expect(await state(control)).toEqual({
      body: "synthetic body\nlate task",
      result: "agent-result-late",
    });

    const cases: {
      name: string;
      prepare: (s: Seed) => Promise<unknown>;
      proposal: Outcome;
      chat: Outcome;
    }[] = [
      {
        name: "account deleted",
        prepare: (s) => softDeleteUserAccount(s.ctx, s.userA, deletedAt),
        proposal: "account_unavailable",
        chat: "account_unavailable",
      },
      {
        name: "page deleted",
        prepare: (s) => s.ctx.db.patch(s.noteA, { deletedAt, updatedAt: deletedAt }),
        proposal: "page_unavailable",
        chat: "ok",
      },
      {
        name: "chat deleted",
        prepare: (s) => s.ctx.db.patch(s.convA, { deletedAt, updatedAt: deletedAt }),
        proposal: "proposal_unavailable",
        chat: "conversation_unavailable",
      },
    ];
    const results: Record<string, { proposal: Outcome; chat: Outcome; unchanged: boolean }> = {};
    const expected: typeof results = {};
    for (const { name, prepare, proposal, chat } of cases) {
      const s = await seed();
      const before = await state(s);
      await prepare(s);
      const proposalCode = await codeFrom(() => commitProposal(s, deletedAt));
      const chatCode = await codeFrom(() => completeChat(s, deletedAt));
      const after = await state(s);
      results[name] = {
        proposal: proposalCode,
        chat: chatCode,
        // A rejected commit changes nothing. The one allowed chat write is the live-chat control.
        unchanged: after.body === before.body && (chat === "ok" || after.result === before.result),
      };
      expected[name] = { proposal, chat, unchanged: true };
    }
    expect(results).toEqual(expected);
  });

  test("guards only read: a reader-only context works, no row changes and nothing external is called", async () => {
    const s = await seed();
    const writes: string[] = [];
    for (const method of ["insert", "patch", "replace", "delete"] as const) {
      s.ctx.db[method] = (..._args: unknown[]) => {
        writes.push(method);
        throw new Error(`${method} must not be called by a privacy guard`);
      };
    }
    // Only `get` and `query` exist on this context; any other db method would be a TypeError.
    const readerOnly = { db: { get: s.ctx.db.get, query: s.ctx.db.query } };
    const watched = [
      ...Object.values(s.ops),
      ...Object.values(s.props),
      s.noteA,
      s.noteA2,
      s.convA,
      s.reqA,
      s.userA,
    ];
    const snapshot = async () => JSON.stringify(await readAll(s.ctx, watched));
    const before = await snapshot();

    await outcomes(everyGuard(s, readerOnly as never));
    await outcomes(everyGuard(s, readerOnly as never, s.userB));
    await outcomes(everyGuard(s, readerOnly as never, s.userA, closedMs));
    for (const name of Object.keys(s.ops)) {
      await outcomes({
        undo: () =>
          requireUndoAccess(readerOnly as never, {
            userId: s.userA,
            operationId: opId(s, name),
            now: inWindow,
          }),
      });
    }
    for (const name of Object.keys(s.props)) {
      await outcomes({
        pending: () =>
          requirePendingProposal(readerOnly as never, {
            userId: s.userA,
            proposalId: propId(s, name),
            now: inWindow,
          }),
      });
    }

    expect(await snapshot()).toBe(before);
    expect(writes).toEqual([]);
    // No hard delete, component call or scheduling (see lifecycleCtx).
    expect(s.forbiddenCalls).toEqual([]);
  });

  test("every index the guards read is declared by the schema, owner-scoped and read with take", async () => {
    const s = await seed();
    const uses: { table: string; index: string; fields: string[] }[] = [];
    const unbounded: string[] = [];
    const query = s.ctx.db.query;
    s.ctx.db.query = (table: string) => {
      const builder = query(table);
      return {
        ...builder,
        // A query with no index is a table scan.
        collect: () => {
          unbounded.push(`${table}.collect`);
          throw new Error("table scan");
        },
        withIndex: (name: string, fn: (q: unknown) => unknown) => {
          const fields: string[] = [];
          const recorder: Record<string, unknown> = {};
          for (const op of ["eq", "gt", "gte", "lt", "lte"]) {
            recorder[op] = (field: string) => {
              fields.push(field);
              return recorder;
            };
          }
          fn(recorder);
          uses.push({ table, index: name, fields });
          return {
            ...builder.withIndex(name, fn),
            collect: () => {
              unbounded.push(`${table}.${name}.collect`);
              throw new Error("unbounded read");
            },
          };
        },
      };
    };

    await outcomes(everyGuard(s));
    await outcomes(everyGuard(s, s.ctx, s.userB));
    await outcomes({
      dupSource: () =>
        requirePendingProposal(s.ctx, {
          userId: s.userA,
          proposalId: propId(s, "dupSource"),
          now: inWindow,
        }),
      duplicateReceipt: () => findLiveOperationReceipt(s.ctx, s.userA, fakeRequestId(12)),
      twoPayloads: () =>
        requireUndoAccess(s.ctx, {
          userId: s.userA,
          operationId: opId(s, "twoPayloads"),
          now: inWindow,
        }),
    });
    expect(unbounded).toEqual([]);

    expect([...new Set(uses.map((use) => `${use.table}.${use.index}`))].sort()).toEqual([
      "chatRequests.by_userId_conversationId_requestKey",
      "noteBlocks.by_userId_noteId_deletedAt_position",
      "pageOperationPayloads.by_userId_operationId",
      "pageOperations.by_userId_requestId",
    ]);
    for (const use of uses) {
      const declared = indexesOf(use.table).find((index) => index.indexDescriptor === use.index);
      expect(declared).toBeDefined();
      // The guard constrains a leading prefix of the index, and that prefix starts with the owner.
      expect(use.fields[0]).toBe("userId");
      expect(use.fields).toEqual((declared?.fields ?? []).slice(0, use.fields.length));
    }
  });

  test("denial messages are fixed calm copy with no ids, text or JSON", () => {
    const codes: PagePrivacyDenial[] = [
      "account_unavailable",
      "page_unavailable",
      "conversation_unavailable",
      "thread_unavailable",
      "request_unavailable",
      "operation_unavailable",
      "undo_unavailable",
      "undo_expired",
      "proposal_unavailable",
      "proposal_expired",
    ];
    for (const code of codes) {
      const error = new PagePrivacyError(code);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("PagePrivacyError");
      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.message).not.toMatch(/[{}[\]":_\d]/);
    }
  });
});

describe("page privacy coverage is derived from the schema (#808)", () => {
  const ownedChildTables = (
    parentField: string,
    tables: Record<string, { validator: GenericValidator }> = schemaTables,
  ) =>
    Object.entries(tables)
      .filter(([name]) => !AUTH_TABLE_NAMES.has(name))
      .filter(([, table]) =>
        fieldMaps(table.validator).some((fields) => "userId" in fields && parentField in fields),
      )
      .map(([name]) => name)
      .sort();

  test("every owned table that points at a note or a conversation has a privacy guard", () => {
    expect(ownedChildTables("noteId")).toEqual([...NOTE_CHILD_TABLES].sort());
    expect(ownedChildTables("conversationId")).toEqual([...CONVERSATION_CHILD_TABLES].sort());
    // Parent-owned `messages` has no userId; its conversation guard lives in messages.ts.
    expect(declaredFieldNames("messages").has("userId")).toBe(false);
    expect(declaredFieldNames("messages").has("conversationId")).toBe(true);
  });

  test("every guarded child table is enrolled in account soft deletion", () => {
    for (const table of [...NOTE_CHILD_TABLES, ...CONVERSATION_CHILD_TABLES]) {
      expect(USER_OWNED_TABLES as readonly string[]).toContain(table);
      expect(FIXTURE_TABLE_NAMES).toContain(table);
    }
  });

  test("every pageProposals field is classified as receipt or content, so a new field is withheld until reviewed", () => {
    const declared = [...declaredFieldNames("pageProposals"), "_id", "_creationTime"].sort();
    const receipt: readonly string[] = PROPOSAL_RECEIPT_FIELDS;
    const content: readonly string[] = PROPOSAL_CONTENT_FIELDS;
    expect([...receipt, ...content].sort()).toEqual(declared);
    expect(receipt.filter((field) => content.includes(field))).toEqual([]);
    expect(content).toEqual(["payload"]);

    // Outside `payload`, the only strings are ids, keys, a date and a digest. Free text
    // (the task title) lives under `payload`, which no receipt carries.
    const leaves = stringLeafPaths(schemaTables.pageProposals.validator);
    expect(leaves.filter((path) => !path.startsWith("payload.")).sort()).toEqual([
      "blockId",
      "confirmDigest",
      "localDate",
      "sourceAgentPromptId",
      "sourceRequestKey",
    ]);
    expect(leaves.filter((path) => path.startsWith("payload.")).sort()).toEqual([
      "payload.task.title",
    ]);
  });

  test("a newly added page or conversation child table without a guard is reported", () => {
    const withNew = {
      ...schemaTables,
      pageComments: {
        validator: defineTable({
          userId: v.id("users"),
          noteId: v.id("notes"),
          deletedAt: v.optional(v.number()),
        }).validator,
      },
      chatDrafts: {
        validator: defineTable({
          userId: v.id("users"),
          conversationId: v.id("conversations"),
        }).validator,
      },
      ownerlessChild: {
        validator: defineTable({ noteId: v.id("notes") }).validator,
      },
    };
    const guardedNote: readonly string[] = NOTE_CHILD_TABLES;
    const guardedConversation: readonly string[] = CONVERSATION_CHILD_TABLES;
    expect(
      ownedChildTables("noteId", withNew).filter((name) => !guardedNote.includes(name)),
    ).toEqual(["pageComments"]);
    expect(
      ownedChildTables("conversationId", withNew).filter(
        (name) => !guardedConversation.includes(name),
      ),
    ).toEqual(["chatDrafts"]);
  });
});
