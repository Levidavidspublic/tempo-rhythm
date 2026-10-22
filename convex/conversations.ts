import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";
import { CONVERSATION_UNAVAILABLE_MESSAGE, hasAgentThread,
  libraryChat, libraryChatValidator, libraryConversationSlice, libraryCursor, libraryError,
  libraryFilterMatches, libraryFiltersValidator, libraryPageSize, libraryPaginationValidator,
  libraryTags, libraryUser, normalizedLibraryFilters } from "./messages";

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
    return conversations.filter((conversation) => conversation.archivedAt === undefined).map(toPublicConversation);
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

export const libraryPage = query({
  args: { filters: libraryFiltersValidator, paginationOpts: libraryPaginationValidator },
  returns: v.object({ page: v.array(libraryChatValidator), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await libraryUser(ctx), filters = normalizedLibraryFilters(args.filters);
    const cursor = libraryCursor(args.paginationOpts.cursor, user._id, "library", JSON.stringify(filters));
    const result = await libraryConversationSlice(ctx, user._id, cursor.chatKey, libraryPageSize(args.paginationOpts.numItems));
    cursor.chatKey = result.indexKeys.at(-1) ?? cursor.chatKey;
    return { page: result.page.filter((chat) => libraryFilterMatches(chat, filters)).map(libraryChat),
      continueCursor: result.hasMore ? JSON.stringify(cursor) : "", isDone: !result.hasMore };
  },
});

const LIBRARY_UNDO_MS = 300_000;
const LIBRARY_MAX_RECEIPTS = 32;
type LibraryMetadata = { tags?: string[]; archivedAt?: number; deletedAt?: number };
type LibraryReceipt = NonNullable<Doc<"conversations">["libraryReceipts"]>[number];
function metadata(row: LibraryMetadata): LibraryMetadata {
  return { ...(row.tags !== undefined ? { tags: row.tags } : {}),
    ...(row.archivedAt !== undefined ? { archivedAt: row.archivedAt } : {}),
    ...(row.deletedAt !== undefined ? { deletedAt: row.deletedAt } : {}) };
}
function sameMetadata(a: LibraryMetadata, b: LibraryMetadata): boolean {
  return JSON.stringify(a.tags ?? null) === JSON.stringify(b.tags ?? null) &&
    a.archivedAt === b.archivedAt && a.deletedAt === b.deletedAt;
}
function libraryRevision(conversation: Doc<"conversations">): number {
  const value = conversation.libraryRevision ?? 0;
  if (!Number.isSafeInteger(value) || value < 0 || value === Number.MAX_SAFE_INTEGER) return libraryError("conflict");
  return value;
}
async function libraryPayloadDigest(tags: string[] | undefined, archived: boolean | undefined): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify([tags ?? null, archived ?? null]));
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const setLibraryMetadata = mutation({
  args: { conversationId: v.id("conversations"), tags: v.optional(v.array(v.string())),
    archived: v.optional(v.boolean()), requestKey: v.string() },
  returns: v.object({ token: v.string(), undoUntilMs: v.number(), conversation: libraryChatValidator }),
  handler: async (ctx, args) => {
    const user = await libraryUser(ctx, true);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(args.requestKey)) return libraryError("invalid_request_key");
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) return libraryError("unavailable");
    if (args.tags === undefined && args.archived === undefined) return libraryError("invalid_filter");
    const tags = args.tags === undefined ? undefined : libraryTags(args.tags);
    const payloadDigest = await libraryPayloadDigest(args.tags, args.archived);
    const now = Date.now(), receipts = (conversation.libraryReceipts ?? []).filter((r) => r.undoUntilMs >= now);
    const repeated = receipts.find((r) => r.requestKey === args.requestKey);
    if (repeated) {
      if (repeated.token.split(".").at(-1) !== payloadDigest) return libraryError("conflict");
      return { token: repeated.token, undoUntilMs: repeated.undoUntilMs, conversation: libraryChat(conversation) };
    }
    if (receipts.length >= LIBRARY_MAX_RECEIPTS) return libraryError("receipt_limit");
    const previous = metadata(conversation), result = { ...previous };
    if (tags !== undefined) result.tags = tags;
    if (args.archived !== undefined) {
      if (args.archived) result.archivedAt = conversation.archivedAt ?? now;
      else delete result.archivedAt;
    }
    const revision = libraryRevision(conversation) + 1;
    // Opaque compound locator: random nonce is verified against the stored receipt. The
    // embedded row id only bounds lookup; possession never authorizes access.
    const token = `${conversation._id}.${crypto.randomUUID()}.${payloadDigest}`;
    const receipt: LibraryReceipt = { token, requestKey: args.requestKey, appliedRevision: revision,
      undoUntilMs: now + LIBRARY_UNDO_MS, previous, result };
    const patch = { tags: result.tags, archivedAt: result.archivedAt,
      libraryRevision: revision, libraryReceipts: [...receipts, receipt], updatedAt: now };
    await ctx.db.patch(conversation._id, patch);
    return { token, undoUntilMs: receipt.undoUntilMs, conversation: libraryChat({ ...conversation, ...patch }) };
  },
});

export const undoLibraryChange = mutation({
  args: { token: v.string() },
  returns: v.object({ restored: v.literal(true), conversationIds: v.array(v.id("conversations")) }),
  handler: async (ctx, args) => {
    const user = await libraryUser(ctx, true);
    if (args.token.length > 180) return libraryError("unavailable");
    const separator = args.token.indexOf("."), rowId = ctx.db.normalizeId("conversations", args.token.slice(0, separator));
    if (separator < 1 || !rowId) return libraryError("unavailable");
    const conversation = await ctx.db.get(rowId);
    if (!conversation || conversation.userId !== user._id) return libraryError("unavailable");
    const receipt = conversation.libraryReceipts?.find((r) => r.token === args.token);
    if (!receipt) return libraryError("unavailable");
    const now = Date.now();
    if (now > receipt.undoUntilMs) return libraryError("expired");
    if (libraryRevision(conversation) !== receipt.appliedRevision || !sameMetadata(conversation, receipt.result)) return libraryError("conflict");
    await ctx.db.patch(conversation._id, { tags: receipt.previous.tags,
      archivedAt: receipt.previous.archivedAt, deletedAt: receipt.previous.deletedAt,
      libraryRevision: receipt.appliedRevision + 1, updatedAt: now });
    return { restored: true as const, conversationIds: [conversation._id] };
  },
});
