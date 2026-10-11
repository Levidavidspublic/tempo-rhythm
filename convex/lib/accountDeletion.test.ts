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
  | "subscription-inactive";

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
};

/** Tables with no `userId` that are not part of the auth library, and why that is fine. */
const NON_USER_ID_TABLES = {
  users: "the account row; softDeleteUserAccount patches it directly",
  messages: "parent-owned through conversationId; soft-deleted with its conversation",
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
    expect(Object.keys(NON_USER_ID_TABLES).sort()).toEqual(["messages", "users"]);
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
