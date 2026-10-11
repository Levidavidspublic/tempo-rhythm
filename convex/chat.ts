import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  AiAuthError,
  AiContextTooLargeError,
  AiRateLimitedError,
  AiUpstreamError,
} from "./lib/ai_errors";
import { callLLM, type AiResult } from "./lib/ai_router";
import { requireApprovedForAi } from "./lib/aiGate";
import {
  buildChatMessages,
  type ChatHistoryItem,
  type ChatMemory,
  historyBeforeTurn,
  pickTopMemories,
  takeLiveMemories,
  truncateForStorage,
} from "./lib/chatPrompt";
import { CRISIS_CARD, crisisCardText, isCrisisText } from "./lib/crisisWords";
import { requireUser } from "./lib/requireUser";

export const MAX_MESSAGE_LENGTH = 4000;
const CONTEXT_MESSAGES = 20;
/** Live memories sent to the model per turn. */
export const CONTEXT_MEMORIES = 20;
/**
 * Hard cap on memory rows read per turn. The salience index is read highest first and the scan stops
 * after CONTEXT_MEMORIES live rows (plus any rows tied with the last one's salience, so the `updatedAt`
 * tiebreak sees the whole tie) or this many rows, so soft-deleted rows cannot crowd out live ones.
 */
export const MEMORY_SCAN_LIMIT = 500;
/**
 * How long an unanswered user message counts as "Tempo is still replying". The model call times out
 * well inside this, so an older unanswered message is a crashed turn and may be reused.
 */
export const PENDING_MS = 90_000;
/**
 * A resend of identical text, with no `retryOf`, inside this window of an answered turn gets that turn's
 * reply back instead of a second paid model call (the response was probably lost on the way to the client).
 */
export const REPLAY_MS = 120_000;
/** `modelUsed` of the fixed crisis card reply. */
const CRISIS_MODEL = "crisis-card";

type MessageId = Id<"messages">;

/**
 * One chat turn is identified by its user message `_id`. A retry sends that id back as `retryOf`,
 * so a retry resolves to the same row instead of inserting the user turn a second time.
 */
export type TurnMessage = Pick<
  Doc<"messages">,
  "_id" | "_creationTime" | "role" | "content" | "modelUsed" | "createdAt" | "deletedAt"
>;

export type TurnRefusal = "still_replying" | "retry_mismatch" | "turn_outdated";

export const TURN_REFUSAL_MESSAGES: Record<TurnRefusal, string> = {
  still_replying: "Tempo is still replying to your last message. Give it a moment.",
  retry_mismatch: "That message could not be retried. Please send it again.",
  turn_outdated: "The conversation moved on since that message. Please send it again.",
};

export type TurnDecision =
  | { action: "insert" }
  /** Reuse the user row (clearing `deletedAt` if a failed turn soft-deleted it). */
  | { action: "reuse"; message: TurnMessage }
  /** The turn already has a reply: return it, make no model call. */
  | { action: "replay"; messageId: MessageId; reply: TurnMessage }
  | { action: "refuse"; reason: TurnRefusal };

function isPending(message: TurnMessage, now: number): boolean {
  return now - message.createdAt < PENDING_MS;
}

/**
 * What to do with a send, given only what the transaction read. Pure.
 *
 * - `latest`: the newest live message in the conversation (only needed without `retry`).
 * - `previous`: the live message just before `latest` (only needed without `retry`).
 * - `retry.target`: the message `retryOf` names, or null when it is missing or in another conversation.
 * - `retry.after`: the first live message created after `retry.target`.
 */
export function decideTurn(input: {
  content: string;
  now: number;
  latest: TurnMessage | null;
  previous?: TurnMessage | null;
  retry?: { target: TurnMessage | null; after: TurnMessage | null };
}): TurnDecision {
  const refuse = (reason: TurnRefusal): TurnDecision => ({ action: "refuse", reason });

  if (!input.retry) {
    const { latest, previous } = input;
    // Newest live message is a user message: nothing answered it yet. Serialize sends behind it
    // (identical text included: it is the same in-flight turn).
    if (latest && latest.role === "user" && isPending(latest, input.now)) {
      return refuse("still_replying");
    }
    // The newest live pair is [user turn with identical text, its reply] and the turn is recent: the
    // client most likely lost the response and is resending. Return the stored reply, no model call, no
    // new rows. Turn identity here is content plus recency only; a durable client request key arrives
    // with #807's request contract and replaces this heuristic. Accepted trade-off: the same text sent
    // on purpose within REPLAY_MS of its answered turn also gets that reply back.
    if (
      latest &&
      latest.role === "assistant" &&
      previous &&
      previous.role === "user" &&
      previous.content.trim() === input.content &&
      input.now - previous.createdAt < REPLAY_MS
    ) {
      return { action: "replay", messageId: previous._id, reply: latest };
    }
    return { action: "insert" };
  }

  const { target, after } = input.retry;
  if (!target || target.role !== "user" || target.content.trim() !== input.content) {
    return refuse("retry_mismatch");
  }

  if (target.deletedAt !== undefined) {
    // A failed earlier turn. Only revive it while nothing newer is live, so order stays intact.
    return after ? refuse("turn_outdated") : { action: "reuse", message: target };
  }

  if (after) {
    return after.role === "assistant"
      ? { action: "replay", messageId: target._id, reply: after }
      : refuse("turn_outdated");
  }
  if (isPending(target, input.now)) return refuse("still_replying");
  return { action: "reuse", message: target };
}

/**
 * What to do with a crisis send. Pure. A crisis message is never refused or delayed: a pending turn, a
 * mismatched or outdated `retryOf`, or a resend whose stored reply is not the crisis card all insert a new
 * turn. Only a stored crisis card for the same text (a lost response, or a retry by id) is replayed.
 */
export function decideCrisisTurn(
  input: Parameters<typeof decideTurn>[0],
): Extract<TurnDecision, { action: "insert" | "replay" }> {
  const decision = decideTurn(input);
  return decision.action === "replay" && decision.reply.modelUsed === CRISIS_MODEL
    ? decision
    : { action: "insert" };
}

export type TurnStart =
  | {
      status: "ready";
      userMessageId: MessageId;
      history: ChatHistoryItem[];
      memories: ChatMemory[];
    }
  | { status: "replied"; messageId: MessageId; reply: string; crisis: boolean }
  | { status: "refused"; reason: TurnRefusal };

export type StoredReply = { content: string; modelUsed?: string; inserted: boolean };

export type CrisisReply = { messageId: MessageId; reply: string };

export type ChatSendResult = { reply: string; crisis?: true; messageId: MessageId };

export type ChatErrorCode =
  | "not_configured"
  | "busy"
  | "conversation_too_long"
  | "upstream"
  | "empty_reply"
  | TurnRefusal;

/** Calm, user-facing error. `messageId` is present when the turn can be retried with `retryOf`. */
export type ChatErrorData = { code: ChatErrorCode; message: string; messageId?: MessageId };

type ChatDependencies = {
  requireApproval: () => Promise<void>;
  beginTurn: (args: { content: string; retryOf?: MessageId }) => Promise<TurnStart>;
  crisisTurn: (args: { content: string; retryOf?: MessageId }) => Promise<CrisisReply>;
  insertAssistantMessage: (
    userMessageId: MessageId,
    content: string,
    modelUsed: string,
  ) => Promise<StoredReply>;
  failTurn: (userMessageId: MessageId) => Promise<void>;
  callModel: typeof callLLM;
  now: () => number;
};

function describeModelFailure(error: unknown): { code: ChatErrorCode; message: string } | null {
  if (error instanceof AiAuthError) {
    return {
      code: "not_configured",
      message: "Chat is not configured here yet. Please try again later.",
    };
  }
  if (error instanceof AiRateLimitedError) {
    return { code: "busy", message: "Chat is busy right now. Pause a moment and try again." };
  }
  if (error instanceof AiContextTooLargeError) {
    return {
      code: "conversation_too_long",
      message: "This conversation is too long for one reply. Try a shorter message.",
    };
  }
  if (error instanceof AiUpstreamError) {
    return { code: "upstream", message: "Tempo had a hiccup. Try again in a moment?" };
  }
  return null;
}

function chatError(data: ChatErrorData): ConvexError<ChatErrorData> {
  return new ConvexError(data);
}

function toResult(messageId: MessageId, stored: Pick<StoredReply, "content" | "modelUsed">): ChatSendResult {
  return stored.modelUsed === CRISIS_MODEL
    ? { reply: stored.content, crisis: true, messageId }
    : { reply: stored.content, messageId };
}

export async function sendChat(
  deps: ChatDependencies,
  content: string,
  retryOf?: MessageId,
): Promise<ChatSendResult> {
  await deps.requireApproval();

  const text = content.trim();
  if (!text) throw new Error("Write a message first.");

  // Crisis detection runs first, on the full trimmed text. A crisis message is never refused or delayed:
  // it skips the length limit (its stored copy is cut to the limit with a visible "…", the same cut every
  // time, so a retry of it still matches the stored row), never waits behind a pending turn, cannot be
  // blocked by its `retryOf`, and makes no model call. One transaction stores the user row and the card,
  // so no other send can land between them.
  if (isCrisisText(text)) {
    const turn = await deps.crisisTurn({
      content: truncateForStorage(text, MAX_MESSAGE_LENGTH),
      retryOf,
    });
    return { reply: turn.reply, crisis: true, messageId: turn.messageId };
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Keep your message to ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  // Ownership, dedupe, serialization and the context snapshot all happen in this one transaction.
  const turn = await deps.beginTurn({ content: text, retryOf });
  if (turn.status === "refused") {
    throw chatError({ code: turn.reason, message: TURN_REFUSAL_MESSAGES[turn.reason] });
  }
  if (turn.status === "replied") {
    return turn.crisis
      ? { reply: turn.reply, crisis: true, messageId: turn.messageId }
      : { reply: turn.reply, messageId: turn.messageId };
  }

  const { userMessageId } = turn;

  // The user row must not stay behind as a "pending" turn when we cannot answer it.
  const abandonTurn = async () => {
    try {
      await deps.failTurn(userMessageId);
    } catch {
      // The turn goes stale after PENDING_MS and can then be retried; keep the original error.
    }
  };

  let result: AiResult;
  try {
    result = await deps.callModel({
      tier: "balanced",
      messages: buildChatMessages({
        history: historyBeforeTurn(turn.history, text),
        memories: turn.memories,
        userText: text,
        now: deps.now(),
      }),
      maxTokens: 600,
      temperature: 0.6,
    });
  } catch (error) {
    await abandonTurn();
    const failure = describeModelFailure(error);
    if (!failure) throw error;
    throw chatError({ ...failure, messageId: userMessageId });
  }

  const reply = result.content.trim();
  if (!reply) {
    await abandonTurn();
    throw chatError({
      code: "empty_reply",
      message: "Tempo could not form a reply. Try again in a moment?",
      messageId: userMessageId,
    });
  }
  let stored: StoredReply;
  try {
    stored = await deps.insertAssistantMessage(userMessageId, reply, result.model);
  } catch (error) {
    // Usually the conversation moved on while the model answered (a crisis turn never waits behind this
    // one). Soft-delete this turn so it does not sit unanswered, and pass the calm `turn_outdated` error on.
    await abandonTurn();
    throw error;
  }
  return toResult(userMessageId, stored);
}

export const send = action({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    retryOf: v.optional(v.id("messages")),
  },
  returns: v.object({
    reply: v.string(),
    crisis: v.optional(v.literal(true)),
    messageId: v.id("messages"),
  }),
  handler: async (ctx, args): Promise<ChatSendResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to chat on this device.");

    return sendChat(
      {
        requireApproval: () => requireApprovedForAi(ctx),
        beginTurn: (turn) =>
          ctx.runMutation(internal.chat.beginTurn, {
            conversationId: args.conversationId,
            content: turn.content,
            ...(turn.retryOf ? { retryOf: turn.retryOf } : {}),
          }),
        crisisTurn: (turn) =>
          ctx.runMutation(internal.chat.crisisTurn, {
            conversationId: args.conversationId,
            content: turn.content,
            ...(turn.retryOf ? { retryOf: turn.retryOf } : {}),
          }),
        insertAssistantMessage: (userMessageId, content, modelUsed) =>
          ctx.runMutation(internal.chat.insertAssistantMessage, {
            conversationId: args.conversationId,
            userMessageId,
            content,
            modelUsed,
          }),
        failTurn: async (userMessageId) => {
          await ctx.runMutation(internal.chat.failTurn, {
            conversationId: args.conversationId,
            userMessageId,
          });
        },
        callModel: callLLM,
        now: Date.now,
      },
      args.content,
      args.retryOf,
    );
  },
});

async function requireOwnedConversation(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
): Promise<{ user: Doc<"users">; conversation: Doc<"conversations"> }> {
  const user = await requireUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) {
    throw new Error("Conversation not found or access denied");
  }
  return { user, conversation };
}

/** Live messages of one conversation, in creation order (the index order). */
function liveMessages(ctx: QueryCtx | MutationCtx, conversationId: Id<"conversations">) {
  return ctx.db
    .query("messages")
    .withIndex("by_conversationId_deletedAt", (q) =>
      q.eq("conversationId", conversationId).eq("deletedAt", undefined),
    );
}

async function firstLiveAfter(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  message: TurnMessage,
) {
  return ctx.db
    .query("messages")
    .withIndex("by_conversationId_deletedAt", (q) =>
      q
        .eq("conversationId", conversationId)
        .eq("deletedAt", undefined)
        .gt("_creationTime", message._creationTime),
    )
    .first();
}

/**
 * What `decideTurn` reads. With `retryOf`: the named message (a message from another conversation
 * reads as "no such message") and the first live message after it. Without it: the two newest live
 * messages, which decide serialize (pending) versus replay (answered).
 */
async function readTurnState(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  retryOf: MessageId | undefined,
): Promise<Pick<Parameters<typeof decideTurn>[0], "latest" | "previous" | "retry">> {
  if (retryOf) {
    const found = await ctx.db.get(retryOf);
    const target = found && found.conversationId === conversationId ? found : null;
    return {
      latest: null,
      retry: { target, after: target ? await firstLiveAfter(ctx, conversationId, target) : null },
    };
  }
  const [latest = null, previous = null] = await liveMessages(ctx, conversationId)
    .order("desc")
    .take(2);
  return { latest, previous };
}

/**
 * Start (or resume) one turn in a single transaction: ownership check, dedupe or serialize against
 * the newest live message, insert or reuse the user row, then read the context snapshot. Convex
 * retries this mutation when a concurrent send for the same conversation commits first, so two
 * sends can never both pass the "nothing pending" check. Crisis text never comes here: see `crisisTurn`.
 */
export const beginTurn = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    /** Already trimmed by the caller. */
    content: v.string(),
    retryOf: v.optional(v.id("messages")),
  },
  handler: async (ctx, args): Promise<TurnStart> => {
    const { user } = await requireOwnedConversation(ctx, args.conversationId);
    const now = Date.now();

    const state = await readTurnState(ctx, args.conversationId, args.retryOf);
    const decision = decideTurn({ content: args.content, now, ...state });
    if (decision.action === "refuse") return { status: "refused", reason: decision.reason };
    if (decision.action === "replay") {
      return {
        status: "replied",
        messageId: decision.messageId,
        reply: decision.reply.content,
        crisis: decision.reply.modelUsed === CRISIS_MODEL,
      };
    }

    let userMessageId: MessageId;
    if (decision.action === "insert") {
      userMessageId = await ctx.db.insert("messages", {
        conversationId: args.conversationId,
        role: "user",
        content: args.content,
        createdAt: now,
      });
    } else {
      userMessageId = decision.message._id;
      // `createdAt` doubles as the turn-start clock, so a concurrent duplicate retry sees it pending.
      await ctx.db.patch(userMessageId, { deletedAt: undefined, createdAt: now });
    }
    await ctx.db.patch(args.conversationId, { updatedAt: now });

    // Reads after the write see it, so the newest message here is this turn's user message.
    const newest = await liveMessages(ctx, args.conversationId).order("desc").take(CONTEXT_MESSAGES);
    // Highest salience first, skipping soft-deleted rows; bounded by live count and rows scanned, no collect.
    // The index breaks salience ties by creation time, so the scan runs on through the last row's tie group
    // (still capped) and pickTopMemories then applies the real tiebreak, newest `updatedAt`.
    const memoryRows = await takeLiveMemories(
      ctx.db
        .query("memories")
        .withIndex("by_userId_salience", (q) => q.eq("userId", user._id))
        .order("desc"),
      CONTEXT_MEMORIES,
      MEMORY_SCAN_LIMIT,
      (memory) => memory.salience,
    );

    return {
      status: "ready",
      userMessageId,
      history: newest.reverse().map(({ role, content }) => ({ role, content })),
      memories: pickTopMemories(memoryRows, CONTEXT_MEMORIES),
    };
  },
});

/**
 * A crisis turn in one transaction: the user row and the fixed crisis card, with no model call and no
 * context read. Never refused (see `decideCrisisTurn`), so it does not wait behind a pending turn; that
 * turn's later reply is then refused by `insertAssistantMessage` and `sendChat` soft-deletes the turn.
 */
export const crisisTurn = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    /** Already trimmed, and cut to MAX_MESSAGE_LENGTH, by the caller. */
    content: v.string(),
    retryOf: v.optional(v.id("messages")),
  },
  handler: async (ctx, args): Promise<CrisisReply> => {
    await requireOwnedConversation(ctx, args.conversationId);
    const now = Date.now();

    const state = await readTurnState(ctx, args.conversationId, args.retryOf);
    const decision = decideCrisisTurn({ content: args.content, now, ...state });
    if (decision.action === "replay") {
      return { messageId: decision.messageId, reply: decision.reply.content };
    }

    const reply = crisisCardText(CRISIS_CARD);
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: args.content,
      createdAt: now,
    });
    // One millisecond later, so ordering by `createdAt` keeps the card after its user message.
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: reply,
      modelUsed: CRISIS_MODEL,
      createdAt: now + 1,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: now + 1 });
    return { messageId, reply };
  },
});

/**
 * Store the assistant reply for one user turn. Refuses to add a second reply, or a reply to a turn
 * that is gone or no longer the newest (a crisis turn may have landed meanwhile), so the stored order
 * stays user, assistant, user, assistant.
 */
export const insertAssistantMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    userMessageId: v.id("messages"),
    content: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args): Promise<StoredReply> => {
    await requireOwnedConversation(ctx, args.conversationId);
    const userMessage = await ctx.db.get(args.userMessageId);
    if (
      !userMessage ||
      userMessage.conversationId !== args.conversationId ||
      userMessage.role !== "user" ||
      userMessage.deletedAt !== undefined
    ) {
      throw chatError({
        code: "turn_outdated",
        message: "That message is no longer in the conversation. Please send it again.",
      });
    }

    const next = await firstLiveAfter(ctx, args.conversationId, userMessage);
    if (next?.role === "assistant") {
      return { content: next.content, modelUsed: next.modelUsed, inserted: false };
    }
    if (next) {
      throw chatError({
        code: "turn_outdated",
        message: "The conversation moved on while Tempo was replying. Please send it again.",
      });
    }

    const now = Math.max(Date.now(), userMessage.createdAt + 1);
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
      modelUsed: args.modelUsed,
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: now });
    return { content: args.content, modelUsed: args.modelUsed, inserted: true };
  },
});

/**
 * A turn we could not answer: soft-delete its user row (only if no reply follows) so it neither
 * blocks the next send nor shows up unanswered. The client retries it by id with `retryOf`.
 */
export const failTurn = internalMutation({
  args: { conversationId: v.id("conversations"), userMessageId: v.id("messages") },
  handler: async (ctx, args): Promise<void> => {
    await requireOwnedConversation(ctx, args.conversationId);
    const userMessage = await ctx.db.get(args.userMessageId);
    if (
      !userMessage ||
      userMessage.conversationId !== args.conversationId ||
      userMessage.role !== "user" ||
      userMessage.deletedAt !== undefined
    ) {
      return;
    }
    const next = await firstLiveAfter(ctx, args.conversationId, userMessage);
    if (next?.role === "assistant") return;
    await ctx.db.patch(userMessage._id, { deletedAt: Date.now() });
  },
});
