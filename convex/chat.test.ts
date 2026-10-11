import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  MEMORY_SCAN_LIMIT,
  PENDING_MS,
  TURN_REFUSAL_MESSAGES,
  type ChatErrorData,
  beginTurn,
  decideTurn,
  failTurn,
  insertAssistantMessage,
  sendChat,
  type StoredReply,
  type TurnDecision,
  type TurnMessage,
  type TurnStart,
} from "./chat";
import { AiUpstreamError } from "./lib/ai_errors";
import type { AiResult } from "./lib/ai_router";
import { run } from "./lib/testFakeCtx";

const USER_MESSAGE = "messages:user" as Id<"messages">;

function modelResult(content = "One small step is to open the document."): AiResult {
  return {
    tier: "balanced",
    requestedTier: "balanced",
    model: "test-model",
    content,
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    escalated: false,
  };
}

function ready(overrides: Partial<Extract<TurnStart, { status: "ready" }>> = {}): TurnStart {
  return { status: "ready", userMessageId: USER_MESSAGE, history: [], memories: [], ...overrides };
}

/** sendChat with every dependency mocked; no database, no network. */
function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireApproval: mock(async () => {}),
    beginTurn: mock(async (_turn: unknown): Promise<TurnStart> => ready()),
    insertAssistantMessage: mock(
      async (_id: Id<"messages">, content: string, modelUsed: string): Promise<StoredReply> => ({
        content,
        modelUsed,
        inserted: true,
      }),
    ),
    failTurn: mock(async (_id: Id<"messages">) => {}),
    callModel: mock(async () => modelResult()),
    now: () => 0,
    ...overrides,
  };
}

async function errorData(promise: Promise<unknown>): Promise<ChatErrorData> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return (error as ConvexError<ChatErrorData>).data;
  }
  throw new Error("expected sendChat to reject");
}

describe("sendChat", () => {
  test("refuses a pending user before opening a turn or calling the model", async () => {
    const deps = dependencies({
      requireApproval: mock(async () => {
        throw new Error("Your account is waiting for approval.");
      }),
    });

    expect(sendChat(deps, "Can you help?")).rejects.toThrow(/waiting for approval/i);
    await Promise.resolve();
    expect(deps.beginTurn).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  test("stores the fixed crisis card without a model call, still through the turn bookkeeping", async () => {
    const deps = dependencies();
    const result = await sendChat(deps, "I want to die");

    expect(result.crisis).toBe(true);
    expect(result.reply).toContain("You are not alone");
    expect(result.messageId).toBe(USER_MESSAGE);
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.beginTurn).toHaveBeenCalledWith({
      content: "I want to die",
      retryOf: undefined,
      withContext: false,
    });
    expect(deps.insertAssistantMessage).toHaveBeenCalledWith(USER_MESSAGE, result.reply, "crisis-card");
  });

  test("refuses another user's conversation before writing or calling the model", async () => {
    const deps = dependencies({
      beginTurn: mock(async () => {
        throw new Error("Conversation not found or access denied");
      }),
    });

    expect(sendChat(deps, "Hello")).rejects.toThrow(/access denied/i);
    await Promise.resolve();
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  test("stores the real model reply and reported model, and returns the user message id", async () => {
    const deps = dependencies();
    const result = await sendChat(deps, "  Help me start  ");

    expect(result).toEqual({
      reply: "One small step is to open the document.",
      messageId: USER_MESSAGE,
    });
    expect(deps.callModel).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "balanced", maxTokens: 600, temperature: 0.6 }),
    );
    expect(deps.beginTurn).toHaveBeenCalledWith({
      content: "Help me start",
      retryOf: undefined,
      withContext: true,
    });
    expect(deps.insertAssistantMessage).toHaveBeenCalledWith(USER_MESSAGE, result.reply, "test-model");
    expect(deps.failTurn).not.toHaveBeenCalled();
  });

  test("sends the turn's own user message to the model exactly once", async () => {
    const deps = dependencies({
      beginTurn: mock(async () =>
        ready({
          history: [
            { role: "user", content: "Earlier" },
            { role: "assistant", content: "Earlier reply" },
            { role: "user", content: "Help me start" },
          ],
          memories: [{ content: "Likes short lists" }],
        }),
      ),
    });
    await sendChat(deps, "Help me start");

    const call = (deps.callModel.mock.calls[0] as unknown as [{ messages: { content: string }[] }])[0];
    expect(call.messages.map((message) => message.content)).toEqual([
      expect.stringContaining("warm and calm"),
      expect.stringContaining("Likes short lists"),
      "Earlier",
      "Earlier reply",
      "Help me start",
    ]);
  });

  test("a provider error abandons the turn and throws a calm error carrying the message id", async () => {
    const deps = dependencies({
      callModel: mock(async () => {
        throw new AiUpstreamError("boom", 502, "deepinfra");
      }),
    });

    const data = await errorData(sendChat(deps, "Help me start"));
    expect(data).toEqual({
      code: "upstream",
      message: "Tempo had a hiccup. Try again in a moment?",
      messageId: USER_MESSAGE,
    });
    expect(deps.failTurn).toHaveBeenCalledWith(USER_MESSAGE);
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("an empty model reply abandons the turn and throws a retryable error", async () => {
    const deps = dependencies({ callModel: mock(async () => modelResult("   ")) });

    const data = await errorData(sendChat(deps, "Help me start"));
    expect(data.code).toBe("empty_reply");
    expect(data.messageId).toBe(USER_MESSAGE);
    expect(deps.failTurn).toHaveBeenCalledWith(USER_MESSAGE);
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("an unexpected model error still abandons the turn and is rethrown", async () => {
    const deps = dependencies({
      callModel: mock(async () => {
        throw new TypeError("unexpected");
      }),
    });

    expect(sendChat(deps, "Hello")).rejects.toThrow(TypeError);
    await Promise.resolve();
    await Promise.resolve();
    expect(deps.failTurn).toHaveBeenCalledWith(USER_MESSAGE);
  });

  test("keeps the calm provider error even if abandoning the turn fails", async () => {
    const deps = dependencies({
      failTurn: mock(async () => {
        throw new Error("write failed");
      }),
      callModel: mock(async () => {
        throw new AiUpstreamError("boom", 500, "deepinfra");
      }),
    });

    const data = await errorData(sendChat(deps, "Hello"));
    expect(data.code).toBe("upstream");
  });

  test("a refused turn throws a calm error before any model call", async () => {
    const deps = dependencies({
      beginTurn: mock(async (): Promise<TurnStart> => ({ status: "refused", reason: "still_replying" })),
    });

    const data = await errorData(sendChat(deps, "Hello"));
    expect(data).toEqual({ code: "still_replying", message: TURN_REFUSAL_MESSAGES.still_replying });
    expect(data.message).toMatch(/still replying to your last message/i);
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("an existing reply is returned without a model call or a write", async () => {
    const deps = dependencies({
      beginTurn: mock(
        async (): Promise<TurnStart> => ({
          status: "replied",
          messageId: USER_MESSAGE,
          reply: "Already answered.",
          crisis: false,
        }),
      ),
    });

    const result = await sendChat(deps, "Hello", USER_MESSAGE);
    expect(result).toEqual({ reply: "Already answered.", messageId: USER_MESSAGE });
    expect(deps.beginTurn).toHaveBeenCalledWith({
      content: "Hello",
      retryOf: USER_MESSAGE,
      withContext: true,
    });
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("an existing crisis-card reply keeps the crisis flag", async () => {
    const deps = dependencies({
      beginTurn: mock(
        async (): Promise<TurnStart> => ({
          status: "replied",
          messageId: USER_MESSAGE,
          reply: "card",
          crisis: true,
        }),
      ),
    });

    expect(await sendChat(deps, "I want to die", USER_MESSAGE)).toEqual({
      reply: "card",
      crisis: true,
      messageId: USER_MESSAGE,
    });
  });
});

function message(overrides: Omit<Partial<TurnMessage>, "_id"> & { _id: string }): TurnMessage {
  return {
    _creationTime: 1,
    role: "user",
    content: "Hello",
    createdAt: 0,
    ...overrides,
    _id: overrides._id as Id<"messages">,
  };
}

describe("decideTurn", () => {
  const now = 1_000_000;
  const fresh = now - 1_000;
  const stale = now - PENDING_MS - 1;

  test("inserts when the conversation is empty or the newest message is a reply", () => {
    expect(decideTurn({ content: "Hi", now, latest: null })).toEqual({ action: "insert" });
    const reply = message({ _id: "a", role: "assistant", createdAt: fresh });
    expect(decideTurn({ content: "Hi", now, latest: reply })).toEqual({ action: "insert" });
  });

  test("refuses a new send while the newest message is an unanswered, recent user message", () => {
    const pending = message({ _id: "u", createdAt: fresh });
    expect(decideTurn({ content: "Hi", now, latest: pending })).toEqual({
      action: "refuse",
      reason: "still_replying",
    });
  });

  test("inserts again once the unanswered user message is older than PENDING_MS", () => {
    const old = message({ _id: "u", createdAt: stale });
    expect(decideTurn({ content: "Hi", now, latest: old })).toEqual({ action: "insert" });
  });

  test("a retry of a soft-deleted turn with nothing newer live reuses it", () => {
    const target = message({ _id: "u", content: "Hi", createdAt: fresh, deletedAt: fresh + 1 });
    expect(decideTurn({ content: "Hi", now, latest: null, retry: { target, after: null } })).toEqual({
      action: "reuse",
      message: target,
    });
  });

  test("a retry of a soft-deleted turn is refused once newer messages are live", () => {
    const target = message({ _id: "u", content: "Hi", deletedAt: 5 });
    const after = message({ _id: "n", _creationTime: 9 });
    expect(decideTurn({ content: "Hi", now, latest: null, retry: { target, after } })).toEqual({
      action: "refuse",
      reason: "turn_outdated",
    });
  });

  test("a retry whose reply exists replays that reply", () => {
    const target = message({ _id: "u", content: "Hi", createdAt: stale });
    const after = message({ _id: "a", role: "assistant", content: "Reply", _creationTime: 2 });
    expect(decideTurn({ content: "Hi", now, latest: null, retry: { target, after } })).toEqual({
      action: "replay",
      messageId: target._id,
      reply: after,
    });
  });

  test("a retry of a live, unanswered, recent turn is an in-flight duplicate", () => {
    const target = message({ _id: "u", content: "Hi", createdAt: fresh });
    expect(
      decideTurn({ content: "Hi", now, latest: null, retry: { target, after: null } }),
    ).toEqual({ action: "refuse", reason: "still_replying" });
  });

  test("a retry of a live, unanswered turn older than PENDING_MS reuses it", () => {
    const target = message({ _id: "u", content: "Hi", createdAt: stale });
    expect(
      decideTurn({ content: "Hi", now, latest: null, retry: { target, after: null } }),
    ).toEqual({ action: "reuse", message: target });
  });

  test("a retry is refused when the target is missing, not a user message, or has other content", () => {
    const mismatch: TurnDecision = { action: "refuse", reason: "retry_mismatch" };
    expect(
      decideTurn({ content: "Hi", now, latest: null, retry: { target: null, after: null } }),
    ).toEqual(mismatch);
    const assistant = message({ _id: "a", role: "assistant", content: "Hi", deletedAt: 5 });
    expect(
      decideTurn({ content: "Hi", now, latest: null, retry: { target: assistant, after: null } }),
    ).toEqual(mismatch);
    const other = message({ _id: "u", content: "Something else", deletedAt: 5 });
    expect(
      decideTurn({ content: "Hi", now, latest: null, retry: { target: other, after: null } }),
    ).toEqual(mismatch);
  });

  test("a retry of a live turn is refused when a newer non-reply message follows it", () => {
    const target = message({ _id: "u", content: "Hi", createdAt: stale });
    const after = message({ _id: "n", role: "user", _creationTime: 9 });
    expect(decideTurn({ content: "Hi", now, latest: null, retry: { target, after } })).toEqual({
      action: "refuse",
      reason: "turn_outdated",
    });
  });
});

type Row = Record<string, unknown>;
type IndexQuery = {
  eq: (field: string, value: unknown) => IndexQuery;
  gt: (field: string, value: unknown) => IndexQuery;
};
type ChatDeps = Parameters<typeof sendChat>[0];

/** Minimal stateful stand-in for the Convex db: enough index, order, take and first for chat.ts. */
function makeDb(ownerId = "users:me", otherUsers: string[] = ["users:other"]) {
  const tables = new Map<string, Map<string, Row>>();
  let nextId = 1;
  let creation = 1;
  const takes: { table: string; n: number }[] = [];
  const collects: string[] = [];
  const table = (name: string) => {
    let rows = tables.get(name);
    if (!rows) {
      rows = new Map();
      tables.set(name, rows);
    }
    return rows;
  };
  for (const id of [ownerId, ...otherUsers]) table("users").set(id, { _id: id, email: `${id}@x.test` });

  const indexSort: Record<string, string[]> = { by_userId_salience: ["salience", "_creationTime"] };
  const rank = (value: unknown) => (value === undefined ? -Infinity : (value as number));

  function builder(name: string, rows: Row[], sortKeys = ["_creationTime"], desc = false) {
    const ordered = () => {
      const out = [...rows].sort((a, b) => {
        for (const key of sortKeys) {
          const diff = rank(a[key]) - rank(b[key]);
          if (diff) return diff;
        }
        return 0;
      });
      return desc ? out.reverse() : out;
    };
    return {
      withIndex: (indexName: string, build: (q: IndexQuery) => unknown) => {
        const conds: { op: "eq" | "gt"; field: string; value: unknown }[] = [];
        const q: IndexQuery = {
          eq: (field, value) => {
            conds.push({ op: "eq", field, value });
            return q;
          },
          gt: (field, value) => {
            conds.push({ op: "gt", field, value });
            return q;
          },
        };
        build(q);
        const kept = rows.filter((row) =>
          conds.every((c) =>
            c.op === "eq" ? row[c.field] === c.value : rank(row[c.field]) > rank(c.value),
          ),
        );
        return builder(name, kept, indexSort[indexName] ?? ["_creationTime"], desc);
      },
      order: (dir: "asc" | "desc") => builder(name, rows, sortKeys, dir === "desc"),
      take: async (n: number) => {
        takes.push({ table: name, n });
        return ordered().slice(0, n);
      },
      first: async () => ordered()[0] ?? null,
      collect: async () => {
        collects.push(name);
        return ordered();
      },
    };
  }

  const db = {
    normalizeId: (name: string, id: string) => (table(name).has(id) ? id : null),
    get: async (id: string) => table(id.split(":")[0] as string).get(id) ?? null,
    insert: async (name: string, doc: Row) => {
      const id = `${name}:${nextId++}`;
      table(name).set(id, { _id: id, _creationTime: creation++, ...doc });
      return id;
    },
    patch: async (id: string, patch: Row) => {
      const rows = table(id.split(":")[0] as string);
      rows.set(id, { ...rows.get(id), ...patch });
    },
    query: (name: string) => builder(name, Array.from(table(name).values())),
  };
  const ctxFor = (userId: string) => ({
    auth: { getUserIdentity: async () => ({ subject: userId }) },
    db,
  });

  return { db, takes, collects, table, ctxFor, ctx: ctxFor(ownerId), ownerId };
}

async function seedConversation(world: ReturnType<typeof makeDb>, userId = world.ownerId) {
  return (await world.db.insert("conversations", {
    userId,
    title: "Chat",
    createdAt: 1,
    updatedAt: 1,
  })) as Id<"conversations">;
}

const T0 = Date.UTC(2026, 9, 11, 12, 0, 0);

/** sendChat wired straight to the real mutation handlers over the fake db. */
function wire(
  world: ReturnType<typeof makeDb>,
  conversationId: Id<"conversations">,
  callModel: unknown,
  ctx = world.ctx,
): ChatDeps {
  return {
    requireApproval: async () => {},
    beginTurn: (turn) => run(beginTurn, ctx, { conversationId, ...turn }) as Promise<TurnStart>,
    insertAssistantMessage: (userMessageId, content, modelUsed) =>
      run(insertAssistantMessage, ctx, {
        conversationId,
        userMessageId,
        content,
        modelUsed,
      }) as Promise<StoredReply>,
    failTurn: async (userMessageId) => {
      await run(failTurn, ctx, { conversationId, userMessageId });
    },
    callModel: callModel as ChatDeps["callModel"],
    now: Date.now,
  };
}

const rowsOf = (world: ReturnType<typeof makeDb>, role: "user" | "assistant") =>
  Array.from(world.table("messages").values()).filter((row) => row.role === role);

describe("chat turns over the db", () => {
  afterEach(() => setSystemTime());

  test("a retry after a provider failure reuses the same user row and inserts no duplicate", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock()
      .mockRejectedValueOnce(new AiUpstreamError("boom", 502, "deepinfra"))
      .mockResolvedValueOnce(modelResult("Here is a first step."));
    const deps = wire(world, conversationId, callModel);

    const failure = await errorData(sendChat(deps, "Help me start"));
    expect(failure.code).toBe("upstream");
    const messageId = failure.messageId as Id<"messages">;
    expect(rowsOf(world, "user")).toHaveLength(1);
    expect(world.table("messages").get(messageId)?.deletedAt).toBeDefined();
    expect(rowsOf(world, "assistant")).toHaveLength(0);

    setSystemTime(new Date(T0 + 5_000));
    const result = await sendChat(deps, "Help me start", messageId);

    expect(result).toEqual({ reply: "Here is a first step.", messageId });
    expect(rowsOf(world, "user")).toHaveLength(1);
    expect(rowsOf(world, "assistant")).toHaveLength(1);
    expect(world.table("messages").get(messageId)?.deletedAt).toBeUndefined();
    expect(world.table("messages").get(messageId)?.createdAt).toBe(T0 + 5_000);
    // One call per attempt, never a second one for the same attempt.
    expect(callModel).toHaveBeenCalledTimes(2);
  });

  test("a retry whose reply already exists returns it with zero model calls", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock(async () => modelResult("Stored reply."));
    const deps = wire(world, conversationId, callModel);

    const first = await sendChat(deps, "Help me start");
    expect(callModel).toHaveBeenCalledTimes(1);

    setSystemTime(new Date(T0 + 10 * 60_000));
    const again = await sendChat(deps, "  Help me start ", first.messageId);

    expect(again).toEqual(first);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(rowsOf(world, "user")).toHaveLength(1);
    expect(rowsOf(world, "assistant")).toHaveLength(1);
  });

  test("a retry of a stored crisis reply keeps the crisis flag and makes no model call", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock(async () => modelResult());
    const deps = wire(world, conversationId, callModel);

    const first = await sendChat(deps, "I want to die");
    const again = await sendChat(deps, "I want to die", first.messageId);

    expect(first.crisis).toBe(true);
    expect(again).toEqual(first);
    expect(callModel).not.toHaveBeenCalled();
    expect(rowsOf(world, "assistant")).toHaveLength(1);
  });

  test("a second send while a turn is pending is refused before any model call", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    // A turn is open: the user row is stored and the model has not answered yet.
    const opened = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "First",
      withContext: true,
    })) as TurnStart;
    expect(opened.status).toBe("ready");

    setSystemTime(new Date(T0 + 2_000));
    const callModel = mock(async () => modelResult());
    const deps = wire(world, conversationId, callModel);

    const data = await errorData(sendChat(deps, "Second"));
    expect(data.code).toBe("still_replying");
    expect(data.message).toMatch(/still replying to your last message/i);
    expect(callModel).not.toHaveBeenCalled();
    expect(rowsOf(world, "user")).toHaveLength(1);

    // A duplicate retry of the same pending turn is refused too.
    const pendingId = (opened as Extract<TurnStart, { status: "ready" }>).userMessageId;
    const duplicate = await errorData(sendChat(deps, "First", pendingId));
    expect(duplicate.code).toBe("still_replying");
    expect(callModel).not.toHaveBeenCalled();
  });

  test("a turn older than PENDING_MS no longer blocks sends and can be retried by id", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const opened = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "First",
      withContext: true,
    })) as Extract<TurnStart, { status: "ready" }>;

    setSystemTime(new Date(T0 + PENDING_MS + 1));
    const callModel = mock(async () => modelResult("Recovered."));
    const deps = wire(world, conversationId, callModel);
    const result = await sendChat(deps, "First", opened.userMessageId);

    expect(result).toEqual({ reply: "Recovered.", messageId: opened.userMessageId });
    expect(rowsOf(world, "user")).toHaveLength(1);
    expect(callModel).toHaveBeenCalledTimes(1);
  });

  test("the user message is stored before the reply and recency is patched on both writes", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const deps = wire(world, conversationId, async () => {
      expect(world.table("conversations").get(conversationId)?.updatedAt).toBe(T0);
      setSystemTime(new Date(T0 + 3_000));
      return modelResult("Reply");
    });

    await sendChat(deps, "Hi");
    expect(world.table("conversations").get(conversationId)?.updatedAt).toBe(T0 + 3_000);
    const [userRow] = rowsOf(world, "user");
    const [assistantRow] = rowsOf(world, "assistant");
    expect(userRow?.createdAt).toBe(T0);
    expect(assistantRow?.createdAt).toBe(T0 + 3_000);
    expect(assistantRow?.modelUsed).toBe("test-model");
  });

  test("memory reads are bounded with take(200) and keep the top 20 by salience", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    for (let i = 0; i < 250; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `memory ${i}`,
        salience: i,
        updatedAt: i,
      });
    }
    // A soft-deleted memory with the highest salience must never reach the prompt.
    await world.db.insert("memories", {
      userId: world.ownerId,
      content: "deleted",
      salience: 10_000,
      updatedAt: 1,
      deletedAt: 5,
    });
    await world.db.insert("memories", {
      userId: "users:other",
      content: "someone else's",
      salience: 9_999,
      updatedAt: 1,
    });

    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hi",
      withContext: true,
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(MEMORY_SCAN_LIMIT).toBe(200);
    const memoryTakes = world.takes.filter((entry) => entry.table === "memories");
    expect(memoryTakes).toEqual([{ table: "memories", n: MEMORY_SCAN_LIMIT }]);
    expect(world.collects).not.toContain("memories");
    expect(turn.memories).toHaveLength(20);
    expect(turn.memories.map((memory) => memory.content)).toEqual(
      Array.from({ length: 20 }, (_, i) => `memory ${249 - i}`),
    );
  });

  test("history is the last 20 live messages, oldest first, ending with this turn", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    for (let i = 0; i < 30; i += 1) {
      await world.db.insert("messages", {
        conversationId,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
        createdAt: i,
      });
    }
    await world.db.insert("messages", {
      conversationId,
      role: "user",
      content: "hidden",
      createdAt: 99,
      deletedAt: 100,
    });

    setSystemTime(new Date(T0 + 1));
    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "now",
      withContext: true,
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(turn.history).toHaveLength(20);
    expect(turn.history.at(-1)).toEqual({ role: "user", content: "now" });
    expect(turn.history[0]).toEqual({ role: "assistant", content: "m11" });
    expect(turn.history.map((item) => item.content)).not.toContain("hidden");
    expect(world.takes.filter((entry) => entry.table === "messages")).toEqual([
      { table: "messages", n: 20 },
    ]);
  });

  test("crisis turns read no history or memories", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "I want to die",
      withContext: false,
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(turn.history).toEqual([]);
    expect(turn.memories).toEqual([]);
    expect(world.takes).toEqual([]);
  });

  test("another user's conversation is refused by every internal mutation", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const own = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Mine",
      withContext: false,
    })) as Extract<TurnStart, { status: "ready" }>;
    const intruder = world.ctxFor("users:other");
    const before = world.table("messages").size;

    await expect(
      run(beginTurn, intruder, { conversationId, content: "Hi", withContext: true }),
    ).rejects.toThrow(/access denied/i);
    await expect(
      run(beginTurn, intruder, {
        conversationId,
        content: "Mine",
        retryOf: own.userMessageId,
        withContext: true,
      }),
    ).rejects.toThrow(/access denied/i);
    await expect(
      run(insertAssistantMessage, intruder, {
        conversationId,
        userMessageId: own.userMessageId,
        content: "x",
        modelUsed: "m",
      }),
    ).rejects.toThrow(/access denied/i);
    await expect(
      run(failTurn, intruder, { conversationId, userMessageId: own.userMessageId }),
    ).rejects.toThrow(/access denied/i);

    expect(world.table("messages").size).toBe(before);
    expect(world.table("messages").get(own.userMessageId)?.deletedAt).toBeUndefined();
  });

  test("a retry id from another conversation reads as a mismatch, not a reuse", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const first = await seedConversation(world);
    const second = await seedConversation(world);
    const opened = (await run(beginTurn, world.ctx, {
      conversationId: first,
      content: "Hello",
      withContext: false,
    })) as Extract<TurnStart, { status: "ready" }>;
    await run(failTurn, world.ctx, { conversationId: first, userMessageId: opened.userMessageId });

    const result = await run(beginTurn, world.ctx, {
      conversationId: second,
      content: "Hello",
      retryOf: opened.userMessageId,
      withContext: true,
    });
    expect(result).toEqual({ status: "refused", reason: "retry_mismatch" });
    expect(world.table("messages").get(opened.userMessageId)?.deletedAt).toBeDefined();
  });

  test("insertAssistantMessage never adds a second reply or answers a gone turn", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const opened = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hello",
      withContext: false,
    })) as Extract<TurnStart, { status: "ready" }>;
    const args = { conversationId, userMessageId: opened.userMessageId, modelUsed: "m" };

    setSystemTime(new Date(T0 + 1_000));
    const firstReply = (await run(insertAssistantMessage, world.ctx, { ...args, content: "one" })) as StoredReply;
    const secondReply = (await run(insertAssistantMessage, world.ctx, { ...args, content: "two" })) as StoredReply;
    expect(firstReply).toEqual({ content: "one", modelUsed: "m", inserted: true });
    expect(secondReply).toEqual({ content: "one", modelUsed: "m", inserted: false });
    expect(rowsOf(world, "assistant")).toHaveLength(1);

    const gone = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Next",
      withContext: false,
    })) as Extract<TurnStart, { status: "ready" }>;
    await run(failTurn, world.ctx, { conversationId, userMessageId: gone.userMessageId });
    await expect(
      run(insertAssistantMessage, world.ctx, { ...args, userMessageId: gone.userMessageId, content: "late" }),
    ).rejects.toBeInstanceOf(ConvexError);
    expect(rowsOf(world, "assistant")).toHaveLength(1);
  });

  test("failTurn keeps a turn that already has a reply", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const deps = wire(world, conversationId, async () => modelResult("Kept."));
    const done = await sendChat(deps, "Hello");

    await run(failTurn, world.ctx, { conversationId, userMessageId: done.messageId });
    expect(world.table("messages").get(done.messageId)?.deletedAt).toBeUndefined();
    expect(rowsOf(world, "assistant")).toHaveLength(1);
  });

  test("a failed turn does not block the next send, which starts a fresh turn", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock()
      .mockRejectedValueOnce(new AiUpstreamError("boom", 503, "deepinfra"))
      .mockResolvedValueOnce(modelResult("Fresh."));
    const deps = wire(world, conversationId, callModel);

    const failure = await errorData(sendChat(deps, "Hello"));
    const fresh = await sendChat(deps, "Something new");

    expect(fresh.messageId).not.toBe(failure.messageId);
    expect(fresh.reply).toBe("Fresh.");
    // The failed row stays soft-deleted; the retry of it is now out of date.
    const late = await errorData(sendChat(deps, "Hello", failure.messageId));
    expect(late.code).toBe("turn_outdated");
  });
});
