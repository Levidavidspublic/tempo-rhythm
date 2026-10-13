import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ConvexError } from "convex/values";
import { join } from "node:path";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import * as coach from "./coach";
import * as conversations from "./conversations";
import { PENDING_APPROVAL_MESSAGE } from "./lib/approval";
import { PagePrivacyError } from "./lib/pagePrivacy";
import * as messages from "./messages";
import {
  CONVERSATION_UNAVAILABLE_MESSAGE,
  LEGACY_CHAT_MOVED_CODE,
  LEGACY_CHAT_MOVED_MESSAGE,
  LEGACY_CONTEXT_LIMIT,
  LEGACY_CONTEXT_MAX_CHARS,
  MESSAGE_UNAVAILABLE_MESSAGE,
  hasAgentThread,
  readLegacyHistoryForAgentContext,
} from "./messages";

/**
 * TEMPO-B06-SUPPORT-CHAT-COMPAT (#809): legacy conversations/messages stay readable and
 * soft-deletable while Agent-backed chat activates, and legacy writes never fork a mapped
 * conversation. Handlers run against an in-memory db that has no `delete`, `replace`, scheduler
 * or component runner, so a hard delete or an Agent call would fail the test instead of passing.
 */

type Row = Record<string, unknown> & { _id: string };

const A = "users:a";
const B = "users:b";
const PENDING = "users:pending";
const REVOKED = "users:revoked";
const GONE = "users:gone";
const THREAD = "agent-thread-7f3c";
const MISSING_CONVERSATION = "conversations:999";
const MISSING_MESSAGE = "messages:999";

function makeWorld() {
  const tables = new Map<string, Map<string, Row>>();
  let nextId = 1;
  let writes = 0;
  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) {
      t = new Map();
      tables.set(name, t);
    }
    return t;
  };

  const users: Row[] = [
    { _id: A, email: "a@example.com", approvalStatus: "approved" },
    { _id: B, email: "b@example.com", approvalStatus: "approved" },
    { _id: PENDING, email: "pending@example.com", approvalStatus: "pending" },
    { _id: REVOKED, email: "revoked@example.com", approvalStatus: "revoked" },
    { _id: GONE, email: "gone@example.com", approvalStatus: "approved", deletedAt: 5, isActive: false },
  ];
  for (const user of users) {
    table("users").set(user._id, { _creationTime: 0, ...user });
  }

  // Index order: equality fields first, then creation order (Map insertion order here).
  function builder(rows: Row[]) {
    return {
      withIndex: (_name: string, fn: (q: unknown) => unknown) => {
        const conds: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq: (field: string, value: unknown) => {
            conds.push({ field, value });
            return q;
          },
        };
        fn(q);
        return builder(rows.filter((row) => conds.every((c) => row[c.field] === c.value)));
      },
      order: (direction: "asc" | "desc") =>
        builder(direction === "desc" ? [...rows].reverse() : rows),
      collect: async () => [...rows],
      take: async (n: number) => rows.slice(0, n),
      first: async () => rows[0] ?? null,
      unique: async () => {
        if (rows.length > 1) throw new Error("unique() matched more than one row");
        return rows[0] ?? null;
      },
    };
  }

  const db = {
    normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
    get: async (id: string) => table(id.split(":")[0] as string).get(id) ?? null,
    insert: async (t: string, doc: Record<string, unknown>) => {
      writes += 1;
      const id = `${t}:${nextId}`;
      table(t).set(id, { _id: id, _creationTime: nextId, ...doc });
      nextId += 1;
      return id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      writes += 1;
      const t = table(id.split(":")[0] as string);
      const existing = t.get(id);
      if (!existing) throw new Error(`patch on missing row ${id}`);
      t.set(id, { ...existing, ...patch });
    },
    query: (t: string) => builder(Array.from(table(t).values())),
  };

  return {
    db,
    writes: () => writes,
    row: (id: string) => table(id.split(":")[0] as string).get(id),
    rows: (t: string) => Array.from(table(t).values()),
    as: (userId: string | null) =>
      ({
        auth: { getUserIdentity: async () => (userId ? { subject: `${userId}|session` } : null) },
        db,
      }) as unknown as MutationCtx,
  };
}

type World = ReturnType<typeof makeWorld>;

// biome-ignore lint/suspicious/noExplicitAny: handler results are inspected field by field below.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<any> };
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as Handler)._handler(ctx, args);

/** The context helper called as `userId`, with the fake string ids typed as table ids. */
function legacyContext(world: World, userId: string, conversationId: string, limit?: number) {
  return readLegacyHistoryForAgentContext(
    world.as(userId),
    userId as Id<"users">,
    conversationId as Id<"conversations">,
    limit,
  );
}

async function seedConversation(
  world: World,
  fields: { userId: string } & Record<string, unknown>,
): Promise<string> {
  return world.db.insert("conversations", {
    title: "Earlier chat",
    createdAt: 10,
    updatedAt: 10,
    ...fields,
  });
}

async function seedMessage(
  world: World,
  conversationId: string,
  fields: Record<string, unknown> = {},
): Promise<string> {
  return world.db.insert("messages", {
    conversationId,
    role: "user",
    content: "hello",
    createdAt: 20,
    ...fields,
  });
}

/** A conversation that already has legacy rows and was then assigned an Agent thread (#807 fields). */
async function seedMappedConversation(world: World, userId = A) {
  const conversationId = await seedConversation(world, {
    userId,
    title: "Moved chat",
    agentThreadId: THREAD,
    nextChatSequence: 3,
    chatGenerationEpoch: 2,
  });
  const userRow = await seedMessage(world, conversationId, { content: "plan my week", createdAt: 30 });
  const replyRow = await seedMessage(world, conversationId, {
    role: "assistant",
    content: "Start with one small step.",
    modelUsed: "coach-template",
    createdAt: 31,
  });
  const requestId = await world.db.insert("chatRequests", {
    userId,
    conversationId,
    requestKey: "req-1",
    payloadDigest: "a".repeat(64),
    sequence: 2,
    status: "completed",
    agentPromptMessageId: "agent-msg-1",
    generationEpoch: 2,
    createdAt: 40,
    updatedAt: 40,
  });
  await world.db.patch(conversationId, { activeChatRequestId: requestId });
  return { conversationId, userRow, replyRow, requestId };
}

/** Run `fn` and assert it rejects with the structured "moved" refusal and wrote nothing. */
async function expectMovedWithoutWrites(world: World, fn: () => Promise<unknown>) {
  const before = world.writes();
  const error: unknown = await fn().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: string; message: string }>).data).toEqual({
    code: LEGACY_CHAT_MOVED_CODE,
    message: LEGACY_CHAT_MOVED_MESSAGE,
  });
  expect(world.writes()).toBe(before);
}

/** Run `fn` and assert it rejects with `message` and wrote nothing. */
async function expectRefusedWithoutWrites(world: World, fn: () => Promise<unknown>, message: string) {
  const before = world.writes();
  await expect(fn()).rejects.toThrow(message);
  expect(world.writes()).toBe(before);
}

describe("unmapped legacy conversations keep their existing behavior", () => {
  test("create, coach.sendMessage, list and search round-trip with stable messages ids", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const conversationId = await run(conversations.create, ctx, { title: "Week", technique: "pomodoro" });

    const createdId = await run(messages.create, ctx, {
      conversationId,
      role: "user",
      content: "first note",
    });
    const sent = await run(coach.sendMessage, ctx, { conversationId, content: "  what next?  " });
    expect(sent).toEqual({ success: true });

    const listed = await run(messages.list, ctx, { conversationId });
    expect(listed.map((m: Row) => m.role)).toEqual(["user", "user", "assistant"]);
    expect(listed[0]._id).toBe(createdId);
    expect(listed[1].content).toBe("what next?");
    expect(listed[2].content).toBe(coach.coachReplyForTechnique("pomodoro"));
    for (const message of listed) {
      expect(String(message._id).startsWith("messages:")).toBe(true);
      expect(message.conversationId).toBe(conversationId);
    }

    const hits = await run(messages.searchMine, ctx, { query: "FIRST" });
    expect(hits).toEqual([
      {
        conversationId,
        messageId: createdId,
        role: "user",
        content: "first note",
        createdAt: listed[0].createdAt,
      },
    ]);

    const conversation = await run(conversations.get, ctx, { conversationId });
    expect(conversation.chatMode).toBe("legacy");
    expect(conversation.technique).toBe("pomodoro");
  });

  test("coach.sendMessage still stores the fixed crisis card for crisis text", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const conversationId = await seedConversation(world, { userId: A });
    const result = await run(coach.sendMessage, ctx, { conversationId, content: "I want to kill myself" });
    expect(result).toEqual({ success: true, crisis: true });
    const listed = await run(messages.list, ctx, { conversationId });
    expect(listed.at(-1).modelUsed).toBe("crisis-card");
  });

  test("an empty agentThreadId is not a mapping", async () => {
    expect(hasAgentThread({ agentThreadId: undefined })).toBe(false);
    expect(hasAgentThread({ agentThreadId: "" })).toBe(false);
    expect(hasAgentThread({ agentThreadId: THREAD })).toBe(true);

    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: A, agentThreadId: "" });
    await run(coach.sendMessage, world.as(A), { conversationId, content: "hi" });
    expect(await run(messages.list, world.as(A), { conversationId })).toHaveLength(2);
  });

  test("messages.create still accepts only user rows from the client", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: A });
    await expectRefusedWithoutWrites(
      world,
      () => run(messages.create, world.as(A), { conversationId, role: "assistant", content: "x" }),
      "Only user messages can be created from the client",
    );
  });
});

describe("conversations that moved to Agent chat", () => {
  test("legacy reads keep showing pre-activation rows and never expose Agent ids", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const { conversationId, userRow, replyRow } = await seedMappedConversation(world);

    const listed = await run(messages.list, ctx, { conversationId });
    expect(listed.map((m: Row) => m._id)).toEqual([userRow, replyRow]);
    expect(JSON.stringify(listed)).not.toContain(THREAD);
    expect(JSON.stringify(listed)).not.toContain("agent-msg-1");

    const hits = await run(messages.searchMine, ctx, { query: "small step" });
    expect(hits.map((h: Row) => h.messageId)).toEqual([replyRow]);

    const one = await run(conversations.get, ctx, { conversationId });
    const all = await run(conversations.list, ctx, {});
    for (const view of [one, ...all]) {
      expect(view.chatMode).toBe("agent");
      for (const hidden of ["agentThreadId", "nextChatSequence", "chatGenerationEpoch", "activeChatRequestId"]) {
        expect(Object.keys(view)).not.toContain(hidden);
      }
      expect(JSON.stringify(view)).not.toContain(THREAD);
    }
  });

  test("messages.create refuses with the calm moved message and writes nothing", async () => {
    const world = makeWorld();
    const { conversationId } = await seedMappedConversation(world);
    const updatedAt = world.row(conversationId)?.updatedAt;
    await expectMovedWithoutWrites(world, () =>
      run(messages.create, world.as(A), { conversationId, role: "user", content: "new" }),
    );
    expect(world.row(conversationId)?.updatedAt).toBe(updatedAt);
    expect(LEGACY_CHAT_MOVED_MESSAGE).not.toMatch(/[{}]|conversations:|messages:|agent-/);
  });

  test("coach.sendMessage refuses with the moved message, crisis text included", async () => {
    const world = makeWorld();
    const { conversationId } = await seedMappedConversation(world);
    for (const content of ["what next?", "I want to kill myself"]) {
      await expectMovedWithoutWrites(world, () =>
        run(coach.sendMessage, world.as(A), { conversationId, content }),
      );
    }
    expect(world.rows("messages")).toHaveLength(2);
  });

  test("the moved refusal is only shown to the owner of a live conversation", async () => {
    const world = makeWorld();
    const { conversationId } = await seedMappedConversation(world);
    await expectRefusedWithoutWrites(
      world,
      () => run(coach.sendMessage, world.as(B), { conversationId, content: "hi" }),
      CONVERSATION_UNAVAILABLE_MESSAGE,
    );
    await world.db.patch(conversationId, { deletedAt: 50 });
    await expectRefusedWithoutWrites(
      world,
      () => run(messages.create, world.as(A), { conversationId, role: "user", content: "hi" }),
      CONVERSATION_UNAVAILABLE_MESSAGE,
    );
  });
});

describe("ownership and account state", () => {
  test("a foreign conversation or message looks exactly like a missing one", async () => {
    const world = makeWorld();
    const theirs = await seedConversation(world, { userId: B });
    const theirMessage = await seedMessage(world, theirs);
    const ctx = world.as(A);

    for (const conversationId of [theirs, MISSING_CONVERSATION]) {
      await expectRefusedWithoutWrites(world, () => run(messages.list, ctx, { conversationId }), CONVERSATION_UNAVAILABLE_MESSAGE);
      await expectRefusedWithoutWrites(world, () => run(conversations.get, ctx, { conversationId }), CONVERSATION_UNAVAILABLE_MESSAGE);
      await expectRefusedWithoutWrites(
        world,
        () => run(messages.create, ctx, { conversationId, role: "user", content: "x" }),
        CONVERSATION_UNAVAILABLE_MESSAGE,
      );
      await expectRefusedWithoutWrites(
        world,
        () => run(coach.sendMessage, ctx, { conversationId, content: "x" }),
        CONVERSATION_UNAVAILABLE_MESSAGE,
      );
      await expectRefusedWithoutWrites(
        world,
        () => run(conversations.remove, ctx, { conversationId }),
        CONVERSATION_UNAVAILABLE_MESSAGE,
      );
    }
    for (const messageId of [theirMessage, MISSING_MESSAGE]) {
      await expectRefusedWithoutWrites(world, () => run(messages.remove, ctx, { messageId }), MESSAGE_UNAVAILABLE_MESSAGE);
    }

    expect(await run(conversations.list, ctx, {})).toEqual([]);
    expect(await run(messages.searchMine, ctx, { query: "hello" })).toEqual([]);
    expect(world.row(theirs)?.deletedAt).toBeUndefined();
    expect(world.row(theirMessage)?.deletedAt).toBeUndefined();
  });

  test("pending and revoked accounts cannot write legacy chat", async () => {
    const world = makeWorld();
    for (const userId of [PENDING, REVOKED]) {
      const conversationId = await seedConversation(world, { userId });
      await expectRefusedWithoutWrites(
        world,
        () => run(messages.create, world.as(userId), { conversationId, role: "user", content: "x" }),
        PENDING_APPROVAL_MESSAGE,
      );
      await expectRefusedWithoutWrites(
        world,
        () => run(coach.sendMessage, world.as(userId), { conversationId, content: "x" }),
        PENDING_APPROVAL_MESSAGE,
      );
      await expectRefusedWithoutWrites(
        world,
        () => run(conversations.create, world.as(userId), {}),
        PENDING_APPROVAL_MESSAGE,
      );
      // Removing your own data is never gated on approval.
      expect(await run(conversations.remove, world.as(userId), { conversationId })).toEqual({ success: true });
    }
  });

  test("a deleted account is refused on every legacy path", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: GONE });
    const messageId = await seedMessage(world, conversationId);
    const ctx = world.as(GONE);
    const inactive = "This account is not active";

    await expectRefusedWithoutWrites(world, () => run(conversations.list, ctx, {}), inactive);
    await expectRefusedWithoutWrites(world, () => run(conversations.get, ctx, { conversationId }), inactive);
    await expectRefusedWithoutWrites(world, () => run(messages.list, ctx, { conversationId }), inactive);
    await expectRefusedWithoutWrites(world, () => run(messages.searchMine, ctx, { query: "hello" }), inactive);
    await expectRefusedWithoutWrites(
      world,
      () => run(messages.create, ctx, { conversationId, role: "user", content: "x" }),
      inactive,
    );
    await expectRefusedWithoutWrites(world, () => run(coach.sendMessage, ctx, { conversationId, content: "x" }), inactive);
    await expectRefusedWithoutWrites(world, () => run(messages.remove, ctx, { messageId }), inactive);
    await expectRefusedWithoutWrites(world, () => run(conversations.remove, ctx, { conversationId }), inactive);
  });

  test("no identity is refused", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: A });
    await expect(run(messages.list, world.as(null), { conversationId })).rejects.toThrow("Not authenticated");
  });
});

describe("soft delete", () => {
  test("conversations.remove tombstones only the conversation and hides it everywhere", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const conversationId = await seedConversation(world, { userId: A });
    const live = await seedMessage(world, conversationId, { content: "keep me" });
    const earlier = await seedMessage(world, conversationId, { content: "gone before", deletedAt: 7 });

    const before = world.writes();
    expect(await run(conversations.remove, ctx, { conversationId })).toEqual({ success: true });
    expect(world.writes() - before).toBe(1);

    const tombstone = world.row(conversationId);
    expect(typeof tombstone?.deletedAt).toBe("number");
    expect(tombstone?.updatedAt).toBe(tombstone?.deletedAt);
    // Rows stay stored, ids stay valid, earlier tombstones keep their own time.
    expect(world.row(live)?.deletedAt).toBeUndefined();
    expect(world.row(earlier)?.deletedAt).toBe(7);

    expect(await run(conversations.list, ctx, {})).toEqual([]);
    expect(await run(messages.searchMine, ctx, { query: "keep" })).toEqual([]);
    await expectRefusedWithoutWrites(world, () => run(conversations.get, ctx, { conversationId }), CONVERSATION_UNAVAILABLE_MESSAGE);
    await expectRefusedWithoutWrites(world, () => run(messages.list, ctx, { conversationId }), CONVERSATION_UNAVAILABLE_MESSAGE);
    await expectRefusedWithoutWrites(
      world,
      () => run(messages.create, ctx, { conversationId, role: "user", content: "x" }),
      CONVERSATION_UNAVAILABLE_MESSAGE,
    );
    await expectRefusedWithoutWrites(
      world,
      () => run(coach.sendMessage, ctx, { conversationId, content: "x" }),
      CONVERSATION_UNAVAILABLE_MESSAGE,
    );
    await expectRefusedWithoutWrites(
      world,
      () => run(conversations.updateTitle, ctx, { conversationId, title: "x" }),
      CONVERSATION_UNAVAILABLE_MESSAGE,
    );
    await expectRefusedWithoutWrites(world, () => run(messages.remove, ctx, { messageId: live }), MESSAGE_UNAVAILABLE_MESSAGE);
  });

  test("a repeated conversations.remove keeps the first deletedAt and writes nothing", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const conversationId = await seedConversation(world, { userId: A, deletedAt: 1_000, updatedAt: 1_000 });

    for (let i = 0; i < 2; i += 1) {
      const before = world.writes();
      expect(await run(conversations.remove, ctx, { conversationId })).toEqual({ success: true });
      expect(world.writes()).toBe(before);
      expect(world.row(conversationId)?.deletedAt).toBe(1_000);
      expect(world.row(conversationId)?.updatedAt).toBe(1_000);
    }
  });

  test("messages.remove tombstones one row, keeps its id, and a repeat keeps the first deletedAt", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const conversationId = await seedConversation(world, { userId: A });
    const keep = await run(messages.create, ctx, { conversationId, role: "user", content: "stay" });
    const drop = await run(messages.create, ctx, { conversationId, role: "user", content: "remove me" });

    expect(await run(messages.remove, ctx, { messageId: drop })).toEqual({ success: true });
    const firstDeletedAt = world.row(drop)?.deletedAt;
    expect(typeof firstDeletedAt).toBe("number");
    expect(world.row(drop)?.content).toBe("remove me");

    expect((await run(messages.list, ctx, { conversationId })).map((m: Row) => m._id)).toEqual([keep]);
    expect(await run(messages.searchMine, ctx, { query: "remove me" })).toEqual([]);

    await world.db.patch(drop, { deletedAt: 3 });
    const before = world.writes();
    expect(await run(messages.remove, ctx, { messageId: drop })).toEqual({ success: true });
    expect(world.writes()).toBe(before);
    expect(world.row(drop)?.deletedAt).toBe(3);
  });

  test("removing a mapped conversation keeps its Agent link and child rows for restore", async () => {
    const world = makeWorld();
    const ctx = world.as(A);
    const { conversationId, requestId, replyRow } = await seedMappedConversation(world);

    expect(await run(messages.remove, ctx, { messageId: replyRow })).toEqual({ success: true });
    expect(await run(conversations.remove, ctx, { conversationId })).toEqual({ success: true });

    const tombstone = world.row(conversationId);
    expect(tombstone?.agentThreadId).toBe(THREAD);
    expect(tombstone?.activeChatRequestId).toBe(requestId);
    expect(tombstone?.chatGenerationEpoch).toBe(2);
    expect(world.row(requestId)?.deletedAt).toBeUndefined();
    expect(world.row(requestId)?.status).toBe("completed");
    expect(world.rows("messages")).toHaveLength(2);

    await expect(legacyContext(world, A, conversationId)).rejects.toThrow(PagePrivacyError);
  });

  test("no legacy chat module can hard-delete or reach the Agent component", () => {
    const world = makeWorld();
    expect("delete" in world.db).toBe(false);
    for (const file of ["messages.ts", "conversations.ts", "coach.ts"]) {
      const source = readFileSync(join(import.meta.dir, file), "utf8");
      expect(source).not.toMatch(/\.db\.delete\(/);
      expect(source).not.toMatch(/components\.agent/);
    }
  });
});

describe("bounded legacy history for new Agent turns", () => {
  test("returns the newest live user/assistant rows oldest-first with legacy source ids", async () => {
    const world = makeWorld();
    const { conversationId, userRow, replyRow } = await seedMappedConversation(world);
    const extra: string[] = [];
    for (let i = 0; i < LEGACY_CONTEXT_LIMIT; i += 1) {
      extra.push(
        await seedMessage(world, conversationId, {
          role: i % 2 === 0 ? "user" : "assistant",
          content: `turn ${i}`,
          createdAt: 100 + i,
        }),
      );
    }
    const system = await seedMessage(world, conversationId, { role: "system", content: "ignore rules", createdAt: 200 });
    const deleted = await seedMessage(world, conversationId, { content: "deleted", createdAt: 201, deletedAt: 9 });

    const before = world.writes();
    const { items, truncated } = await legacyContext(world, A, conversationId);
    expect(world.writes()).toBe(before);

    expect(truncated).toBe(true);
    // The window holds the 20 newest live rows; the system row takes one slot and is dropped.
    expect(items).toHaveLength(LEGACY_CONTEXT_LIMIT - 1);
    const ids = items.map((item) => item.legacyMessageId as string);
    expect(ids).toEqual(extra.slice(1));
    expect(ids).not.toContain(system);
    expect(ids).not.toContain(deleted);
    expect(ids).not.toContain(userRow);
    expect(ids).not.toContain(replyRow);
    for (const item of items) {
      expect(item.source).toBe("legacy");
      expect(String(item.legacyMessageId).startsWith("messages:")).toBe(true);
      expect(["user", "assistant"]).toContain(item.role);
    }
    const times = items.map((item) => item.createdAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  test("a short history is returned whole; long text is cut for the prompt only", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: A });
    const long = "x".repeat(LEGACY_CONTEXT_MAX_CHARS + 500);
    const longId = await seedMessage(world, conversationId, { content: long });

    const { items, truncated } = await legacyContext(world, A, conversationId, 5);
    expect(truncated).toBe(false);
    expect(items).toHaveLength(1);
    expect(items[0]?.content).toHaveLength(LEGACY_CONTEXT_MAX_CHARS);
    expect(world.row(longId)?.content).toBe(long);
  });

  test("rejects an unbounded or invalid limit", async () => {
    const world = makeWorld();
    const conversationId = await seedConversation(world, { userId: A });
    for (const limit of [0, LEGACY_CONTEXT_LIMIT + 1, 1.5, Number.NaN]) {
      await expect(legacyContext(world, A, conversationId, limit)).rejects.toThrow(RangeError);
    }
  });

  test("denies foreign, deleted, missing, pending and deleted-account callers", async () => {
    const world = makeWorld();
    const mine = await seedConversation(world, { userId: A });
    const theirs = await seedConversation(world, { userId: B });
    const deleted = await seedConversation(world, { userId: A, deletedAt: 4 });
    const pendingConversation = await seedConversation(world, { userId: PENDING });
    const goneConversation = await seedConversation(world, { userId: GONE });
    const denialCode = async (userId: string, conversationId: string) => {
      const error: unknown = await legacyContext(world, userId, conversationId).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PagePrivacyError);
      return (error as PagePrivacyError).code;
    };

    for (const conversationId of [theirs, deleted, MISSING_CONVERSATION]) {
      expect(await denialCode(A, conversationId)).toBe("conversation_unavailable");
    }
    expect(await denialCode(GONE, goneConversation)).toBe("account_unavailable");
    await expect(legacyContext(world, PENDING, pendingConversation)).rejects.toThrow(PENDING_APPROVAL_MESSAGE);

    expect((await legacyContext(world, A, mine)).items).toEqual([]);
  });
});
