import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";
import { CONVERSATION_UNAVAILABLE_MESSAGE, hasAgentThread } from "./messages";

async function requireOwnedLiveConversation(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">
): Promise<{ userId: Id<"users">; conversation: Doc<"conversations"> }> {
  const user = await requireUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) {
    throw new Error(CONVERSATION_UNAVAILABLE_MESSAGE);
  }
  return { userId: user._id, conversation };
}

/**
 * What a client sees of a live conversation (#809). The legacy fields keep their names and id
 * types. Host-owned Agent lifecycle metadata (#807: `agentThreadId`, `nextChatSequence`,
 * `chatGenerationEpoch`, `activeChatRequestId`) never leaves the server; `chatMode` says which
 * send path the conversation uses instead, so no client ever holds an Agent thread id.
 */
export const publicConversationValidator = v.object({
  _id: v.id("conversations"),
  _creationTime: v.number(),
  userId: v.id("users"),
  title: v.string(),
  technique: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  /** Kept from the legacy shape; always absent here because only live conversations are returned. */
  deletedAt: v.optional(v.number()),
  /** "agent" once an Agent thread is assigned; legacy writes then refuse this conversation. */
  chatMode: v.union(v.literal("legacy"), v.literal("agent")),
});

export type PublicConversation = {
  _id: Id<"conversations">;
  _creationTime: number;
  userId: Id<"users">;
  title: string;
  technique?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  chatMode: "legacy" | "agent";
};

export function toPublicConversation(conversation: Doc<"conversations">): PublicConversation {
  const view: PublicConversation = {
    _id: conversation._id,
    _creationTime: conversation._creationTime,
    userId: conversation.userId,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    chatMode: hasAgentThread(conversation) ? "agent" : "legacy",
  };
  if (conversation.technique !== undefined) {
    view.technique = conversation.technique;
  }
  if (conversation.deletedAt !== undefined) {
    view.deletedAt = conversation.deletedAt;
  }
  return view;
}

// Query: Get live conversations for the signed-in user
export const list = query({
  args: {},
  returns: v.array(publicConversationValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_userId_deletedAt", (q) => q.eq("userId", user._id).eq("deletedAt", undefined))
      .collect();

    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    return conversations.map(toPublicConversation);
  },
});

// Query: Get a single live conversation
export const get = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: publicConversationValidator,
  handler: async (ctx, args) => {
    const { conversation } = await requireOwnedLiveConversation(ctx, args.conversationId);
    return toPublicConversation(conversation);
  },
});

// Mutation: Create a new conversation
export const create = mutation({
  args: {
    title: v.optional(v.string()),
    technique: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Chat: pending/revoked accounts are rejected (sign-up approval gate).
    const user = await requireApprovedUser(ctx);

    const now = Date.now();
    const conversationId = await ctx.db.insert("conversations", {
      userId: user._id,
      title: args.title || "New Conversation",
      technique: args.technique,
      createdAt: now,
      updatedAt: now,
    });

    return conversationId;
  },
});

// Mutation: Update coach technique (optional)
export const updateTechnique = mutation({
  args: {
    conversationId: v.id("conversations"),
    technique: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await requireOwnedLiveConversation(ctx, args.conversationId);

    await ctx.db.patch(args.conversationId, {
      technique: args.technique === null ? undefined : args.technique,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Mutation: Update conversation title
export const updateTitle = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnedLiveConversation(ctx, args.conversationId);

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Mutation: Soft-delete a conversation (30-day grace, PRD "soft delete everywhere").
 *
 * Only the conversation row gets `deletedAt` (and `updatedAt`). Like a page delete it does not
 * cascade: its messages, `chatRequests` rows and any Agent thread stay stored untouched, so each
 * keeps its own earlier `deletedAt` and a later restore has nothing to unpick. They become
 * unreachable at once because every legacy read and write here, `coach.sendMessage` and the
 * `lib/pagePrivacy.ts` guards check the parent conversation is live. No Agent component call is
 * made, so thread content is never destroyed. Removing an already-deleted conversation keeps its
 * first `deletedAt` and succeeds; a missing or foreign one is refused with the same text.
 */
export const remove = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id) {
      throw new Error(CONVERSATION_UNAVAILABLE_MESSAGE);
    }

    if (conversation.deletedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(args.conversationId, { deletedAt: now, updatedAt: now });
    }

    return { success: true as const };
  },
});
