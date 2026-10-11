import { afterEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  CONTEXT_MEMORIES,
  MAX_MESSAGE_LENGTH,
  MEMORY_SCAN_LIMIT,
  PENDING_MS,
  REPLAY_MS,
  TURN_REFUSAL_MESSAGES,
  type ChatErrorData,
  type ChatSendResult,
  type CrisisReply,
  beginTurn,
  crisisTurn,
  decideCrisisTurn,
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
import { crisisCardText } from "./lib/crisisWords";
import { run } from "./lib/testFakeCtx";

const USER_MESSAGE = "messages:user" as Id<"messages">;
const CARD = crisisCardText();

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
    crisisTurn: mock(
      async (_turn: unknown): Promise<CrisisReply> => ({ messageId: USER_MESSAGE, reply: CARD }),
    ),
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

  test("stores the fixed crisis card in one crisis turn, with no model call and no ordinary turn", async () => {
    const deps = dependencies();
    const result = await sendChat(deps, "I want to die");

    expect(result).toEqual({ reply: CARD, crisis: true, messageId: USER_MESSAGE });
    expect(result.reply).toContain("You are not alone");
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.crisisTurn).toHaveBeenCalledWith({ content: "I want to die", retryOf: undefined });
    expect(deps.beginTurn).not.toHaveBeenCalled();
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("a crisis message goes to the crisis turn even when an ordinary turn would refuse it", async () => {
    const deps = dependencies({
      beginTurn: mock(async (): Promise<TurnStart> => ({ status: "refused", reason: "still_replying" })),
    });

    const result = await sendChat(deps, "I want to die", USER_MESSAGE);
    expect(result).toEqual({ reply: CARD, crisis: true, messageId: USER_MESSAGE });
    expect(deps.crisisTurn).toHaveBeenCalledWith({ content: "I want to die", retryOf: USER_MESSAGE });
    expect(deps.beginTurn).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  test("a crisis message over the length limit still gets the crisis card, stored cut to the limit", async () => {
    const deps = dependencies();
    const long = `${"I have been carrying this for a long time. ".repeat(150)}I want to die`;
    expect(long.length).toBeGreaterThan(MAX_MESSAGE_LENGTH);

    const result = await sendChat(deps, `  ${long}  `);

    expect(result.crisis).toBe(true);
    expect(result.reply).toContain("You are not alone");
    expect(deps.callModel).not.toHaveBeenCalled();
    const [turn] = deps.crisisTurn.mock.calls[0] as unknown as [{ content: string; retryOf?: string }];
    expect(turn.content).toHaveLength(MAX_MESSAGE_LENGTH);
    expect(turn.content.endsWith("…")).toBe(true);
    expect(turn.content.startsWith("I have been carrying")).toBe(true);
    expect(deps.beginTurn).not.toHaveBeenCalled();
  });

  test("a crisis message at exactly the limit is stored whole, without a marker", async () => {
    const deps = dependencies();
    const text = `${"a".repeat(MAX_MESSAGE_LENGTH - " I want to die".length)} I want to die`;
    expect(text).toHaveLength(MAX_MESSAGE_LENGTH);

    await sendChat(deps, text);
    expect(deps.crisisTurn).toHaveBeenCalledWith({ content: text, retryOf: undefined });
  });

  test("a non-crisis message over the length limit is still rejected before any turn or model call", async () => {
    const deps = dependencies();

    await expect(sendChat(deps, "a".repeat(MAX_MESSAGE_LENGTH + 1))).rejects.toThrow(
      /4000 characters or fewer/,
    );
    expect(deps.beginTurn).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
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
    expect(deps.beginTurn).toHaveBeenCalledWith({ content: "Help me start", retryOf: undefined });
    expect(deps.crisisTurn).not.toHaveBeenCalled();
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

  test("a reply refused because the conversation moved on abandons the turn and passes the calm error on", async () => {
    const refusal: ChatErrorData = {
      code: "turn_outdated",
      message: "The conversation moved on while Tempo was replying. Please send it again.",
    };
    const deps = dependencies({
      insertAssistantMessage: mock(async () => {
        throw new ConvexError(refusal);
      }),
    });

    const data = await errorData(sendChat(deps, "Hello"));
    expect(data).toEqual(refusal);
    expect(deps.callModel).toHaveBeenCalledTimes(1);
    expect(deps.failTurn).toHaveBeenCalledWith(USER_MESSAGE);
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
    expect(deps.beginTurn).toHaveBeenCalledWith({ content: "Hello", retryOf: USER_MESSAGE });
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.insertAssistantMessage).not.toHaveBeenCalled();
  });

  test("an ordinary turn that replays a stored crisis card keeps the crisis flag", async () => {
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

    // Non-crisis text whose stored row matches a crisis turn (a long crisis message's cut copy, say).
    expect(await sendChat(deps, "Hello", USER_MESSAGE)).toEqual({
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

  describe("without retryOf, a resend of an answered turn", () => {
    const answered = (userOverrides: Omit<Partial<TurnMessage>, "_id"> = {}) => ({
      previous: message({ _id: "u", content: "Hi", createdAt: now - 30_000, ...userOverrides }),
      latest: message({ _id: "a", role: "assistant", content: "Reply", createdAt: now - 25_000 }),
    });

    test("with identical trimmed text inside REPLAY_MS replays the stored reply", () => {
      const { previous, latest } = answered();
      expect(REPLAY_MS).toBe(120_000);
      expect(decideTurn({ content: "Hi", now, latest, previous })).toEqual({
        action: "replay",
        messageId: previous._id,
        reply: latest,
      });
      // The stored row is compared trimmed, like a retry.
      const padded = answered({ content: "  Hi \n" });
      expect(decideTurn({ content: "Hi", ...padded, now })).toEqual({
        action: "replay",
        messageId: padded.previous._id,
        reply: padded.latest,
      });
    });

    test("the window is measured from the user turn: just inside replays, REPLAY_MS and older insert", () => {
      const inside = answered({ createdAt: now - REPLAY_MS + 1 });
      expect(decideTurn({ content: "Hi", ...inside, now }).action).toBe("replay");
      const edge = answered({ createdAt: now - REPLAY_MS });
      expect(decideTurn({ content: "Hi", ...edge, now })).toEqual({ action: "insert" });
      const old = answered({ createdAt: now - 10 * 60_000 });
      expect(decideTurn({ content: "Hi", ...old, now })).toEqual({ action: "insert" });
    });

    test("different text inserts a new turn", () => {
      expect(decideTurn({ content: "Something else", ...answered(), now })).toEqual({ action: "insert" });
    });

    test("needs a user turn directly before the reply", () => {
      const { latest } = answered();
      expect(decideTurn({ content: "Hi", now, latest, previous: null })).toEqual({ action: "insert" });
      const assistantBefore = message({ _id: "p", role: "assistant", content: "Hi", createdAt: fresh });
      expect(decideTurn({ content: "Hi", now, latest, previous: assistantBefore })).toEqual({
        action: "insert",
      });
    });

    test("identical text while that turn is still pending keeps the still-replying refusal", () => {
      const pending = message({ _id: "u", content: "Hi", createdAt: fresh });
      expect(decideTurn({ content: "Hi", now, latest: pending, previous: null })).toEqual({
        action: "refuse",
        reason: "still_replying",
      });
    });
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

describe("decideCrisisTurn", () => {
  const now = 1_000_000;
  const text = "I want to die";
  const insert = { action: "insert" } as const;
  const card = (overrides: Omit<Partial<TurnMessage>, "_id"> = {}) =>
    message({ _id: "c", role: "assistant", content: "card", modelUsed: "crisis-card", ...overrides });

  test("is never refused: a pending turn, a pending crisis turn or a bad retry all insert", () => {
    const pending = message({ _id: "u", content: "Help me start", createdAt: now - 1_000 });
    expect(decideCrisisTurn({ content: text, now, latest: pending })).toEqual(insert);
    const pendingCrisis = message({ _id: "u", content: text, createdAt: now - 1_000 });
    expect(decideCrisisTurn({ content: text, now, latest: pendingCrisis })).toEqual(insert);
    // Retry of that same pending row, a missing row, other text, and a row the conversation moved past.
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: pendingCrisis, after: null } }),
    ).toEqual(insert);
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: null, after: null } }),
    ).toEqual(insert);
    const other = message({ _id: "o", content: "Hello", createdAt: now - PENDING_MS - 1 });
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: other, after: null } }),
    ).toEqual(insert);
    const deleted = message({ _id: "d", content: text, deletedAt: 5 });
    const newer = message({ _id: "n", role: "user", content: "Later", _creationTime: 9 });
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: deleted, after: newer } }),
    ).toEqual(insert);
  });

  test("replays only a stored crisis card for the same text", () => {
    const previous = message({ _id: "u", content: text, createdAt: now - 5_000 });
    expect(decideCrisisTurn({ content: text, now, latest: card(), previous })).toEqual({
      action: "replay",
      messageId: previous._id,
      reply: card(),
    });
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: previous, after: card() } }),
    ).toEqual({ action: "replay", messageId: previous._id, reply: card() });
  });

  test("a matching turn answered by the model, or a card outside REPLAY_MS, inserts a new crisis turn", () => {
    const previous = message({ _id: "u", content: text, createdAt: now - 5_000 });
    const modelReply = card({ content: "Model reply", modelUsed: "test-model" });
    expect(decideCrisisTurn({ content: text, now, latest: modelReply, previous })).toEqual(insert);
    expect(
      decideCrisisTurn({ content: text, now, latest: null, retry: { target: previous, after: modelReply } }),
    ).toEqual(insert);
    const old = message({ _id: "u", content: text, createdAt: now - REPLAY_MS });
    expect(decideCrisisTurn({ content: text, now, latest: card(), previous: old })).toEqual(insert);
  });
});

type Row = Record<string, unknown>;
type IndexQuery = {
  eq: (field: string, value: unknown) => IndexQuery;
  gt: (field: string, value: unknown) => IndexQuery;
};
type ChatDeps = Parameters<typeof sendChat>[0];

/** Minimal stateful stand-in for the Convex db: enough index, order, take, first and iteration for chat.ts. */
function makeDb(ownerId = "users:me", otherUsers: string[] = ["users:other"]) {
  const tables = new Map<string, Map<string, Row>>();
  let nextId = 1;
  let creation = 1;
  const takes: { table: string; n: number }[] = [];
  const collects: string[] = [];
  /** Rows pulled through the query's async iterator, per table. */
  const scans: Record<string, number> = {};
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
      // Lazy, like Convex: a row counts as read only once the loop asks for it.
      async *[Symbol.asyncIterator]() {
        for (const row of ordered()) {
          scans[name] = (scans[name] ?? 0) + 1;
          yield row;
        }
      },
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

  return { db, takes, collects, scans, table, ctxFor, ctx: ctxFor(ownerId), ownerId };
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
    crisisTurn: (turn) => run(crisisTurn, ctx, { conversationId, ...turn }) as Promise<CrisisReply>,
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

  test("a resend of identical text without retryOf replays the reply: zero model calls, no new rows", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock(async () => modelResult("Stored reply."));
    const deps = wire(world, conversationId, callModel);

    // The first response is lost on the way back, so the client resends without a message id.
    const first = await sendChat(deps, "Help me start");
    const rowsBefore = world.table("messages").size;

    setSystemTime(new Date(T0 + 30_000));
    const resend = await sendChat(deps, "  Help me start  ");

    expect(resend).toEqual(first);
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(world.table("messages").size).toBe(rowsBefore);
    expect(rowsOf(world, "user")).toHaveLength(1);
    expect(rowsOf(world, "assistant")).toHaveLength(1);
  });

  test("a resend after REPLAY_MS, or with different text, is a new paid turn", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock(async () => modelResult("Reply."));
    const deps = wire(world, conversationId, callModel);

    await sendChat(deps, "Help me start");

    setSystemTime(new Date(T0 + 10_000));
    const other = await sendChat(deps, "Something else");
    expect(callModel).toHaveBeenCalledTimes(2);

    // "Help me start" is no longer the newest pair, so it is not a resend of it either.
    setSystemTime(new Date(T0 + 20_000));
    await sendChat(deps, "Help me start");
    expect(callModel).toHaveBeenCalledTimes(3);

    setSystemTime(new Date(T0 + 20_000 + REPLAY_MS));
    const later = await sendChat(deps, "Help me start");
    expect(callModel).toHaveBeenCalledTimes(4);
    expect(later.messageId).not.toBe(other.messageId);
    expect(rowsOf(world, "user")).toHaveLength(4);
    expect(rowsOf(world, "assistant")).toHaveLength(4);
  });

  test("an identical resend while the turn is still pending is refused, not replayed or duplicated", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    await run(beginTurn, world.ctx, { conversationId, content: "First" });

    setSystemTime(new Date(T0 + PENDING_MS - 1));
    const callModel = mock(async () => modelResult());
    const data = await errorData(sendChat(wire(world, conversationId, callModel), "First"));

    expect(data.code).toBe("still_replying");
    expect(callModel).not.toHaveBeenCalled();
    expect(rowsOf(world, "user")).toHaveLength(1);
  });

  test("a long crisis message is answered with the card and stored cut to the limit, then replayed on resend", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const callModel = mock(async () => modelResult());
    const deps = wire(world, conversationId, callModel);
    const long = `${"x".repeat(MAX_MESSAGE_LENGTH + 500)} I want to die`;

    const first = await sendChat(deps, long);
    expect(first.crisis).toBe(true);
    const [userRow] = rowsOf(world, "user");
    expect(userRow?.content).toHaveLength(MAX_MESSAGE_LENGTH);
    expect((userRow?.content as string).endsWith("…")).toBe(true);
    expect(rowsOf(world, "assistant")).toHaveLength(1);

    // Both a resend and a retry by id match the stored (cut) row and return the same card.
    setSystemTime(new Date(T0 + 5_000));
    expect(await sendChat(deps, long)).toEqual(first);
    expect(await sendChat(deps, long, first.messageId)).toEqual(first);
    expect(callModel).not.toHaveBeenCalled();
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

  test("a crisis message sent while a turn is pending gets the card at once; the pending reply is refused calmly", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    let crisis: ChatSendResult | undefined;
    const callModel = mock(async () => {
      // While the model is still answering "Help me start", the user sends a crisis message.
      setSystemTime(new Date(T0 + 2_000));
      crisis = await sendChat(deps, "I want to die");
      return modelResult("Late reply.");
    });
    const deps = wire(world, conversationId, callModel);

    const late = await errorData(sendChat(deps, "Help me start"));

    expect(crisis).toEqual({ reply: CARD, crisis: true, messageId: expect.any(String) });
    // Only the pending turn's own call; the crisis turn made none.
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(late).toEqual({
      code: "turn_outdated",
      message: "The conversation moved on while Tempo was replying. Please send it again.",
    });
    // The pending turn is soft-deleted, not left unanswered; the crisis pair stays live, in order.
    const pendingRow = rowsOf(world, "user").find((row) => row.content === "Help me start");
    expect(pendingRow?.deletedAt).toBeDefined();
    const live = Array.from(world.table("messages").values()).filter((row) => row.deletedAt === undefined);
    expect(live.map((row) => [row.role, row.content, row.modelUsed])).toEqual([
      ["user", "I want to die", undefined],
      ["assistant", CARD, "crisis-card"],
    ]);
    expect(rowsOf(world, "assistant")).toHaveLength(1);

    // Sending it again starts a fresh turn that gets a real reply.
    setSystemTime(new Date(T0 + 5_000));
    const again = await sendChat(
      wire(world, conversationId, mock(async () => modelResult("Here is a first step."))),
      "Help me start",
    );
    expect(again.reply).toBe("Here is a first step.");
    expect(again.messageId).not.toBe(pendingRow?._id as Id<"messages">);
  });

  test("a crisis message while an earlier crisis turn is still pending also gets the card, never a refusal", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    // An earlier crisis message whose card is not stored: a live, recent, unanswered user row.
    const pending = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "I want to die",
    })) as Extract<TurnStart, { status: "ready" }>;
    const callModel = mock(async () => modelResult());
    const deps = wire(world, conversationId, callModel);

    setSystemTime(new Date(T0 + 1_000));
    const resend = await sendChat(deps, "I want to die");
    // A retry by id of the pending row is outdated now, and still gets the card.
    const retry = await sendChat(deps, "I want to die", pending.userMessageId);
    const other = await sendChat(deps, "I want to end my life");

    for (const result of [resend, retry, other]) {
      expect(result).toEqual({ reply: CARD, crisis: true, messageId: expect.any(String) });
    }
    expect(callModel).not.toHaveBeenCalled();
    // Every new crisis message is answered by its own card, directly after it.
    const live = Array.from(world.table("messages").values()).filter((row) => row.deletedAt === undefined);
    expect(live.map((row) => row.role)).toEqual([
      "user",
      "user",
      "assistant",
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(live.slice(1).map((row) => row._id).filter((_, i) => i % 2 === 0)).toEqual([
      resend.messageId,
      retry.messageId,
      other.messageId,
    ]);
  });

  test("a second send while a turn is pending is refused before any model call", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    // A turn is open: the user row is stored and the model has not answered yet.
    const opened = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "First",
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

  test("memory reads stop after 20 live rows, never take or collect, and keep the top 20 by salience", async () => {
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
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(MEMORY_SCAN_LIMIT).toBe(500);
    expect(CONTEXT_MEMORIES).toBe(20);
    expect(world.takes.filter((entry) => entry.table === "memories")).toEqual([]);
    expect(world.collects).not.toContain("memories");
    // The deleted row, the 20 live ones, and the one row after them that shows the salience tie group ended;
    // the other 229 rows are never read.
    expect(world.scans.memories).toBe(22);
    expect(turn.memories).toHaveLength(20);
    expect(turn.memories.map((memory) => memory.content)).toEqual(
      Array.from({ length: 20 }, (_, i) => `memory ${249 - i}`),
    );
  });

  test("memories tied on salience are ranked by newest update even when the index order would drop them", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    // 30 memories at the default salience. The index breaks the tie by creation time, newest first, so a
    // scan that stopped at 20 live rows would never see memory 0, the oldest-created one.
    for (let i = 0; i < 30; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `memory ${i}`,
        salience: 0.5,
        // Memory 0 is the most recently updated of all.
        updatedAt: i === 0 ? 10_000 : i,
      });
    }

    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hi",
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(turn.memories).toHaveLength(20);
    expect(turn.memories[0]).toEqual({ content: "memory 0" });
    // Then the 19 next most recently updated: memories 29 down to 11.
    expect(turn.memories.map((memory) => memory.content)).toEqual([
      "memory 0",
      ...Array.from({ length: 19 }, (_, i) => `memory ${29 - i}`),
    ]);
    // The whole tie group was read (the index ran out), nothing was taken or collected.
    expect(world.scans.memories).toBe(30);
    expect(world.takes.filter((entry) => entry.table === "memories")).toEqual([]);
    expect(world.collects).not.toContain("memories");
  });

  test("a salience tie larger than MEMORY_SCAN_LIMIT is still read only up to the cap", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const total = MEMORY_SCAN_LIMIT + 100;
    for (let i = 0; i < total; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `memory ${i}`,
        salience: 0.5,
        // Memory 0 was created first (so it is read last) and updated most recently.
        updatedAt: i === 0 ? 100_000 : i,
      });
    }

    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hi",
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(world.scans.memories).toBe(MEMORY_SCAN_LIMIT);
    expect(turn.memories).toHaveLength(20);
    // Newest-created first in the index: the 500 rows read are memories 599 down to 100, and memory 0 is past the cap.
    expect(turn.memories.some((memory) => memory.content === "memory 0")).toBe(false);
    expect(turn.memories[0]).toEqual({ content: `memory ${total - 1}` });
    expect(world.collects).not.toContain("memories");
  });

  test("live memories behind many soft-deleted, higher-salience ones are still found", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    // 300 deleted rows outrank every live one; the old take(200) would have returned only deleted rows.
    for (let i = 0; i < 300; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `deleted ${i}`,
        salience: 1_000 + i,
        updatedAt: i,
        deletedAt: 5,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `live ${i}`,
        salience: i,
        updatedAt: i,
      });
    }

    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hi",
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(turn.memories.map((memory) => memory.content)).toEqual([
      "live 4",
      "live 3",
      "live 2",
      "live 1",
      "live 0",
    ]);
    // All 300 deleted rows and the 5 live ones were read, then the index ran out.
    expect(world.scans.memories).toBe(305);
    expect(world.collects).not.toContain("memories");
  });

  test("the memory scan stops at MEMORY_SCAN_LIMIT rows even when no live memory has been found", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    for (let i = 0; i < MEMORY_SCAN_LIMIT + 100; i += 1) {
      await world.db.insert("memories", {
        userId: world.ownerId,
        content: `deleted ${i}`,
        salience: 1_000 + i,
        updatedAt: i,
        deletedAt: 5,
      });
    }
    // Live, but ranked past the bound.
    await world.db.insert("memories", {
      userId: world.ownerId,
      content: "too far down",
      salience: 1,
      updatedAt: 1,
    });

    const turn = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Hi",
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(world.scans.memories).toBe(MEMORY_SCAN_LIMIT);
    expect(turn.memories).toEqual([]);
    expect(world.collects).not.toContain("memories");
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
    })) as Extract<TurnStart, { status: "ready" }>;

    expect(turn.history).toHaveLength(20);
    expect(turn.history.at(-1)).toEqual({ role: "user", content: "now" });
    expect(turn.history[0]).toEqual({ role: "assistant", content: "m11" });
    expect(turn.history.map((item) => item.content)).not.toContain("hidden");
    // take(2) decides serialize vs replay; take(20) is the context window.
    expect(world.takes.filter((entry) => entry.table === "messages")).toEqual([
      { table: "messages", n: 2 },
      { table: "messages", n: 20 },
    ]);
  });

  test("a crisis turn stores the user row and the card in one go and reads no history or memories", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    await world.db.insert("memories", { userId: world.ownerId, content: "m", salience: 1, updatedAt: 1 });

    const turn = (await run(crisisTurn, world.ctx, { conversationId, content: "I want to die" })) as CrisisReply;

    expect(turn.reply).toBe(CARD);
    const [userRow] = rowsOf(world, "user");
    const [cardRow] = rowsOf(world, "assistant");
    expect(userRow).toMatchObject({ _id: turn.messageId, content: "I want to die", createdAt: T0 });
    expect(cardRow).toMatchObject({ content: CARD, modelUsed: "crisis-card", createdAt: T0 + 1 });
    expect(world.table("conversations").get(conversationId)?.updatedAt).toBe(T0 + 1);
    // Only the two-message replay check; no context window and no memory read.
    expect(world.takes).toEqual([{ table: "messages", n: 2 }]);
    expect(world.scans.memories).toBeUndefined();
  });

  test("another user's conversation is refused by every internal mutation", async () => {
    setSystemTime(new Date(T0));
    const world = makeDb();
    const conversationId = await seedConversation(world);
    const own = (await run(beginTurn, world.ctx, {
      conversationId,
      content: "Mine",
    })) as Extract<TurnStart, { status: "ready" }>;
    const intruder = world.ctxFor("users:other");
    const before = world.table("messages").size;

    await expect(
      run(beginTurn, intruder, { conversationId, content: "Hi" }),
    ).rejects.toThrow(/access denied/i);
    await expect(
      run(beginTurn, intruder, {
        conversationId,
        content: "Mine",
        retryOf: own.userMessageId,
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
    await expect(
      run(crisisTurn, intruder, { conversationId, content: "I want to die" }),
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
    })) as Extract<TurnStart, { status: "ready" }>;
    await run(failTurn, world.ctx, { conversationId: first, userMessageId: opened.userMessageId });

    const result = await run(beginTurn, world.ctx, {
      conversationId: second,
      content: "Hello",
      retryOf: opened.userMessageId,
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
