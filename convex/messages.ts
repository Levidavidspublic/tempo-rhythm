import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { PENDING_APPROVAL_MESSAGE, isApproved, requireApprovedUser } from "./lib/approval";
import { modelSafeContent } from "./lib/connections/lookup";
import { requireLiveConversation } from "./lib/pagePrivacy";
import { requireUser } from "./lib/requireUser";

/**
 * Legacy chat compatibility while Agent-backed chat activates (TEMPO-B06-SUPPORT-CHAT-COMPAT, #809).
 *
 * - A conversation is "mapped" once the Agent chat path (#743) sets `conversations.agentThreadId`.
 *   Nothing here sets, clears or migrates that field, and there is no history backfill.
 * - Legacy endpoints stay typed for legacy rows: every id they take or return is an app-table id
 *   (`Id<"conversations">`, `Id<"messages">`). They never accept, return or cast an Agent thread or
 *   message id, which stays an opaque component string behind `lib/pagePrivacy.ts`.
 * - Legacy reads (`list`, `searchMine`) keep showing the stored rows of every live conversation,
 *   mapped or not, so replies written before activation never disappear.
 * - Legacy writes (`create` here, `coach.sendMessage`) refuse a mapped conversation with the
 *   `legacy_chat_moved` error and write nothing, so one conversation never grows a second history
 *   next to its Agent thread. Unmapped conversations keep their existing behavior.
 * - Remove is a tombstone (`deletedAt`), never `ctx.db.delete`. An earlier `deletedAt` is kept, so a
 *   repeated remove changes nothing. No path here calls the Agent component, so thread content stays
 *   recoverable for the 30-day grace window.
 * - New Agent turns read old content through `readLegacyHistoryForAgentContext`: bounded, read-only,
 *   and every item names its source (`source: "legacy"` plus an `Id<"messages">`).
 */

/** Calm, actionable refusal for a legacy write into a conversation that now uses Agent chat. */
export const LEGACY_CHAT_MOVED_MESSAGE =
  "This chat moved to the new coach. Refresh the page, then send your message again.";

/** Machine code for that refusal. Same `{ code, message }` shape as the chat errors in `chat.ts` (#743). */
export const LEGACY_CHAT_MOVED_CODE = "legacy_chat_moved";

/**
 * A `ConvexError`, so the calm copy reaches the client on production deployments too (a plain
 * `Error` message is replaced there). It carries no id, text or JSON from the conversation.
 */
function legacyChatMovedError() {
  return new ConvexError({ code: LEGACY_CHAT_MOVED_CODE, message: LEGACY_CHAT_MOVED_MESSAGE });
}

/** Same text for a missing, foreign or deleted conversation, so ids cannot be probed. */
export const CONVERSATION_UNAVAILABLE_MESSAGE = "Conversation not found or access denied";

/** Same text for a missing message, a foreign one, or one whose conversation is deleted. */
export const MESSAGE_UNAVAILABLE_MESSAGE = "Message not found";

/** Most legacy rows one Agent turn may read as context. */
export const LEGACY_CONTEXT_LIMIT = 20;

/** Longest legacy message text one context item carries; longer text is cut, never rewritten. */
export const LEGACY_CONTEXT_MAX_CHARS = 4000;

const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system")
);

/** True once the Agent chat path has assigned this conversation a thread. */
export function hasAgentThread(conversation: Pick<Doc<"conversations">, "agentThreadId">): boolean {
  return conversation.agentThreadId !== undefined && conversation.agentThreadId.length > 0;
}

async function requireOwnedLiveConversation(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">
) {
  const user = await requireUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) {
    throw new Error(CONVERSATION_UNAVAILABLE_MESSAGE);
  }
  return { user, conversation };
}

/**
 * The live, unmapped conversation a legacy write may append to. `userId` must come from the server
 * (`requireApprovedUser`). Ownership and liveness are checked first, so the "moved" refusal is only
 * ever shown to the owner of a live conversation.
 */
export async function requireLegacyWritableConversation(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== userId || conversation.deletedAt !== undefined) {
    throw new Error(CONVERSATION_UNAVAILABLE_MESSAGE);
  }
  if (hasAgentThread(conversation)) {
    throw legacyChatMovedError();
  }
  return conversation;
}

// Query: Get live legacy messages for a live conversation (mapped or not)
export const list = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await requireOwnedLiveConversation(ctx, args.conversationId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_deletedAt", (q) =>
        q.eq("conversationId", args.conversationId).eq("deletedAt", undefined)
      )
      .collect();

    messages.sort((a, b) => a.createdAt - b.createdAt);
    return messages;
  },
});

const searchHitValidator = v.object({
  conversationId: v.id("conversations"),
  messageId: v.id("messages"),
  role: messageRoleValidator,
  content: v.string(),
  createdAt: v.number(),
});

/** Case-insensitive search across the caller's live chats. One match per conversation, 200 conversations, the 80 newest live messages each. */
export const searchMine = query({
  args: { query: v.string() },
  returns: v.array(searchHitValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const needle = args.query.trim();
    if (needle.length === 0) {
      return [];
    }
    const bounded = needle.slice(0, 200);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_userId_deletedAt", (q) => q.eq("userId", user._id).eq("deletedAt", undefined))
      .collect();

    const lower = bounded.toLowerCase();
    const hits: Array<{
      conversationId: Id<"conversations">;
      messageId: Id<"messages">;
      role: "user" | "assistant" | "system";
      content: string;
      createdAt: number;
    }> = [];

    for (const conversation of conversations) {
      if (hits.length >= 200) {
        break;
      }
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversationId_deletedAt", (q) =>
          q.eq("conversationId", conversation._id).eq("deletedAt", undefined)
        )
        .order("desc")
        .take(80);

      for (const message of messages) {
        if (!message.content.toLowerCase().includes(lower)) {
          continue;
        }
        hits.push({
          conversationId: conversation._id,
          messageId: message._id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        });
        break;
      }
    }

    return hits;
  },
});

// Mutation: Add a user message to a live, unmapped conversation
export const create = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: messageRoleValidator,
    content: v.string(),
    modelUsed: v.optional(v.string()),
    councilResponse: v.optional(v.any()),
    toolCalls: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Chat write: pending/revoked accounts are rejected (sign-up approval gate).
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);

    if (args.role !== "user") {
      throw new Error("Only user messages can be created from the client");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      modelUsed: args.modelUsed,
      councilResponse: args.councilResponse,
      toolCalls: args.toolCalls,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

/**
 * Mutation: Soft-delete one legacy message. The row and its id stay stored (30-day grace); an
 * already-deleted message keeps its first `deletedAt`. Allowed in mapped conversations too: it only
 * tombstones a host row and never touches Agent thread content.
 */
export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error(MESSAGE_UNAVAILABLE_MESSAGE);
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) {
      throw new Error(MESSAGE_UNAVAILABLE_MESSAGE);
    }

    if (message.deletedAt === undefined) {
      await ctx.db.patch(args.messageId, { deletedAt: Date.now() });
    }
    return { success: true as const };
  },
});

/** One legacy row handed to a new Agent turn as context. The id is a host `messages` id, never an Agent id. */
export type LegacyContextItem = {
  source: "legacy";
  legacyMessageId: Id<"messages">;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

/**
 * Bounded, read-only legacy history for a new Agent turn in this conversation.
 *
 * - `userId` must be server-derived (the signed-in caller, or the owner a job was created with).
 *   Denies a deleted or inactive account and a missing, foreign or deleted conversation through
 *   `requireLiveConversation`, and a pending or revoked account like every other model path.
 * - Reads at most `limit + 1` of the newest live rows through the owner-checked parent; no
 *   `collect`, no writes, no component calls. Items come back oldest first.
 * - Only `user` and `assistant` rows are returned; a legacy `system` row is never replayed as an
 *   instruction. Text longer than `LEGACY_CONTEXT_MAX_CHARS` is cut for the prompt only.
 * - `truncated` is true when older live rows exist beyond the window.
 */
export async function readLegacyHistoryForAgentContext(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
  limit: number = LEGACY_CONTEXT_LIMIT
): Promise<{ items: LegacyContextItem[]; truncated: boolean }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > LEGACY_CONTEXT_LIMIT) {
    throw new RangeError(`limit must be an integer from 1 to ${LEGACY_CONTEXT_LIMIT}`);
  }
  const { user } = await requireLiveConversation(ctx, userId, conversationId);
  if (!isApproved(user)) {
    throw new Error(PENDING_APPROVAL_MESSAGE);
  }

  const newestFirst = await ctx.db
    .query("messages")
    .withIndex("by_conversationId_deletedAt", (q) =>
      q.eq("conversationId", conversationId).eq("deletedAt", undefined)
    )
    .order("desc")
    .take(limit + 1);

  const truncated = newestFirst.length > limit;
  const recent = newestFirst.slice(0, limit);
  recent.sort((a, b) => a.createdAt - b.createdAt);

  const items: LegacyContextItem[] = [];
  for (const message of recent) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    items.push({
      source: "legacy",
      legacyMessageId: message._id,
      role: message.role,
      // An Executor lookup's answer names apps from Executor; models get a fixed line (#989).
      content: modelSafeContent(message).slice(0, LEGACY_CONTEXT_MAX_CHARS),
      createdAt: message.createdAt,
    });
  }
  return { items, truncated };
}
