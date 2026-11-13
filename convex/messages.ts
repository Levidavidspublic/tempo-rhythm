import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { PENDING_APPROVAL_MESSAGE, isApproved, requireApprovedUser } from "./lib/approval";
import { modelSafeContent } from "./lib/connections/lookup";
import { requireLiveConversation } from "./lib/pagePrivacy";
import { requireUser } from "./lib/requireUser";
import { getPage, type IndexKey } from "convex-helpers/server/pagination";
import schema from "./schema";

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

// KB-01: bounded native-index traversal. Cursor v1 binds owner and normalized inputs.
// Ordering is native createdAt/updatedAt, _creationTime, _id (descending), not a
// page-local re-sort. getPage reads one lookahead row: 24+1 chats, 99+1 messages.
export const libraryPaginationValidator = v.object({ cursor: v.union(v.string(), v.null()), numItems: v.number() });
export const libraryFiltersValidator = v.object({
  fromMs: v.optional(v.number()), beforeMs: v.optional(v.number()), folder: v.optional(v.string()),
  tags: v.optional(v.array(v.string())), pinned: v.optional(v.boolean()),
  archive: v.optional(v.union(v.literal("active"), v.literal("archived"), v.literal("all"))),
});
export type LibraryFilters = {
  fromMs?: number; beforeMs?: number; folder?: string; tags?: string[]; pinned?: boolean;
  archive?: "active" | "archived" | "all";
};
export const libraryChatValidator = v.object({
  id: v.id("conversations"), title: v.string(), createdAt: v.number(), updatedAt: v.number(),
  folder: v.union(v.string(), v.null()), pinnedAt: v.union(v.number(), v.null()),
  tags: v.array(v.string()), archivedAt: v.union(v.number(), v.null()),
  chatMode: v.union(v.literal("legacy"), v.literal("agent")),
});
const libraryMessageValidator = v.object({
  id: v.id("messages"), conversationId: v.id("conversations"),
  role: v.union(v.literal("user"), v.literal("assistant")), content: v.string(), createdAt: v.number(),
  sources: v.array(v.object({ title: v.string(), site: v.string(), url: v.string() })),
});
export function libraryError(code: string): never { throw new ConvexError({ code }); }

export async function libraryUser(ctx: QueryCtx | MutationCtx, write = false) {
  try { return await (write ? requireApprovedUser(ctx) : requireUser(ctx)); }
  catch { return libraryError("unavailable"); }
}

/** Unicode 15.1 default full case folding using runtime casing, independently implemented.
 * Dotless i is unchanged; capital sharp S expands; Cherokee folds to uppercase.
 * No locale-dependent casing or NFKC compatibility normalization. See KB-01 evidence.
 */
export function libraryFold(text: string): string {
  let result = "";
  for (const char of text.normalize("NFC")) {
    const point = char.codePointAt(0)!;
    result += point === 0x131 ? char : point === 0x1e9e ? "ss"
      : ((point >= 0x13a0 && point <= 0x13ff) || (point >= 0xab70 && point <= 0xabbf))
        ? char.toUpperCase() : char.toUpperCase().toLowerCase();
  }
  return result.normalize("NFC");
}

/** The hit spans complete original graphemes; offsets are UTF-16, never folded indexes. */
export function libraryMatch(text: string, foldedQuery: string): { matchStart: number; matchEnd: number } | null {
  const starts: number[] = [], ends: number[] = [];
  let folded = "";
  const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });
  for (const part of segmenter.segment(text)) {
    const segment = libraryFold(part.segment);
    folded += segment;
    for (let i = 0; i < segment.length; i++) {
      starts.push(part.index); ends.push(part.index + part.segment.length);
    }
  }
  const at = folded.indexOf(foldedQuery);
  return at < 0 ? null : { matchStart: starts[at]!, matchEnd: ends[at + foldedQuery.length - 1]! };
}

export function libraryTags(tags: string[]): string[] {
  if (tags.length > 10) return libraryError("invalid_tag");
  const result: string[] = [], seen = new Set<string>();
  for (const value of tags) {
    if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)) return libraryError("invalid_tag");
    const tag = value.normalize("NFC").trim().replace(/\s+/gu, " ");
    if ([...tag].length < 1 || [...tag].length > 32) return libraryError("invalid_tag");
    const key = libraryFold(tag);
    if (!seen.has(key)) { seen.add(key); result.push(tag); }
  }
  return result;
}

export function normalizedLibraryFilters(filters: LibraryFilters): LibraryFilters {
  if ((filters.fromMs !== undefined && !Number.isFinite(filters.fromMs)) ||
      (filters.beforeMs !== undefined && !Number.isFinite(filters.beforeMs)) ||
      (filters.fromMs !== undefined && filters.beforeMs !== undefined && filters.fromMs >= filters.beforeMs) ||
      (filters.folder !== undefined && (filters.folder.length > 128 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(filters.folder)))) {
    return libraryError("invalid_filter");
  }
  let tags: string[];
  try { tags = libraryTags(filters.tags ?? []).map(libraryFold).sort(); }
  catch { return libraryError("invalid_filter"); }
  return {
    ...(filters.fromMs !== undefined ? { fromMs: filters.fromMs } : {}),
    ...(filters.beforeMs !== undefined ? { beforeMs: filters.beforeMs } : {}),
    ...(filters.folder !== undefined ? { folder: filters.folder } : {}),
    ...(filters.pinned !== undefined ? { pinned: filters.pinned } : {}),
    tags, archive: filters.archive ?? "active",
  };
}

export function libraryChat(conversation: Doc<"conversations">) {
  // KA-01 has not landed on this preparation base. Read its future optional metadata
  // without introducing duplicate fields/writers; null is the truthful legacy fallback.
  const ka = conversation as Doc<"conversations"> & { folder?: string; pinnedAt?: number };
  return { id: conversation._id, title: conversation.title, createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt, folder: ka.folder ?? null, pinnedAt: ka.pinnedAt ?? null,
    tags: conversation.tags ?? [], archivedAt: conversation.archivedAt ?? null,
    chatMode: hasAgentThread(conversation) ? "agent" as const : "legacy" as const };
}

export function libraryFilterMatches(conversation: Doc<"conversations">, filters: LibraryFilters): boolean {
  if (conversation.deletedAt !== undefined) return false;
  const row = libraryChat(conversation), tags = new Set(row.tags.map(libraryFold));
  return (filters.fromMs === undefined || row.updatedAt >= filters.fromMs) &&
    (filters.beforeMs === undefined || row.updatedAt < filters.beforeMs) &&
    (filters.folder === undefined || row.folder === filters.folder) &&
    (filters.pinned === undefined || (row.pinnedAt !== null) === filters.pinned) &&
    (filters.archive === "all" || (row.archivedAt !== null) === (filters.archive === "archived")) &&
    (filters.tags ?? []).every((tag) => tags.has(libraryFold(tag)));
}

export type LibraryCursor = { v: 1; owner: string; kind: string; fingerprint: string;
  chatKey: IndexKey | null; current?: string; messageKey?: IndexKey | null; titleDone?: boolean; legacy?: boolean };
export function libraryCursor(input: string | null, owner: string, kind: string, fingerprint: string): LibraryCursor {
  const fresh: LibraryCursor = { v: 1, owner, kind, fingerprint, chatKey: null };
  if (input === null) return fresh;
  try {
    if (input.length > 8192) throw new Error();
    const x = JSON.parse(input) as LibraryCursor;
    if (x.v !== 1 || x.owner !== owner || x.kind !== kind || x.fingerprint !== fingerprint ||
      !(x.chatKey === null || validLibraryKey(x.chatKey, owner)) ||
      (x.current !== undefined && typeof x.current !== "string") ||
      (x.messageKey !== undefined && x.messageKey !== null && !validLibraryKey(x.messageKey, x.current ?? "")) ||
      (x.titleDone !== undefined && typeof x.titleDone !== "boolean") ||
      (x.legacy !== undefined && typeof x.legacy !== "boolean")) throw new Error();
    return x;
  } catch { return libraryError("invalid_cursor"); }
}
function validLibraryKey(value: unknown, parent: string): value is IndexKey {
  return Array.isArray(value) && value.length === 4 && value[0] === parent &&
    typeof value[1] === "number" && Number.isFinite(value[1]) &&
    typeof value[2] === "number" && Number.isFinite(value[2]) && typeof value[3] === "string" && value[3].length <= 128;
}
export function libraryPageSize(numItems: number): number {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > 50) return libraryError("invalid_filter");
  return numItems;
}
export function libraryConversationSlice(ctx: QueryCtx, owner: Id<"users">, key: IndexKey | null, count: number) {
  return getPage(ctx, { table: "conversations", schema, index: "by_userId_updatedAt", order: "desc",
    startIndexKey: key ?? [owner], startInclusive: key === null, endIndexKey: [owner],
    targetMaxRows: Math.min(24, count), absoluteMaxRows: Math.min(24, count) });
}
function libraryMessageSlice(ctx: QueryCtx, conversationId: Id<"conversations">, key: IndexKey | null, count: number) {
  return getPage(ctx, { table: "messages", schema, index: "by_conversationId_createdAt", order: "desc",
    startIndexKey: key ?? [conversationId], startInclusive: key === null, endIndexKey: [conversationId],
    targetMaxRows: Math.min(99, count), absoluteMaxRows: Math.min(99, count) });
}
function libraryMessage(message: Doc<"messages">) {
  return { id: message._id, conversationId: message.conversationId,
    role: message.role as "user" | "assistant", content: message.content, createdAt: message.createdAt,
    sources: message.sources ?? [] };
}

export const historyPage = query({
  args: { conversationId: v.id("conversations"), paginationOpts: libraryPaginationValidator },
  returns: v.object({ page: v.array(libraryMessageValidator), continueCursor: v.string(), isDone: v.boolean(),
    coverage: v.union(v.literal("complete"), v.literal("legacy_only")) }),
  handler: async (ctx, args) => {
    const user = await libraryUser(ctx), conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== user._id || conversation.deletedAt !== undefined) return libraryError("unavailable");
    const count = libraryPageSize(args.paginationOpts.numItems), fingerprint = JSON.stringify([args.conversationId]);
    const cursor = libraryCursor(args.paginationOpts.cursor, user._id, "history", fingerprint);
    if (cursor.current !== undefined && cursor.current !== args.conversationId) return libraryError("invalid_cursor");
    const result = await libraryMessageSlice(ctx, args.conversationId, cursor.messageKey ?? null, count);
    const next: LibraryCursor = { ...cursor, current: args.conversationId,
      messageKey: result.indexKeys.at(-1) ?? cursor.messageKey ?? null };
    return { page: result.page.filter((m) => m.deletedAt === undefined && m.role !== "system").map(libraryMessage),
      continueCursor: result.hasMore ? JSON.stringify(next) : "", isDone: !result.hasMore,
      coverage: hasAgentThread(conversation) ? "legacy_only" as const : "complete" as const };
  },
});

export const searchPage = query({
  args: { query: v.string(), filters: libraryFiltersValidator, paginationOpts: libraryPaginationValidator },
  returns: v.object({ page: v.array(v.object({ chat: libraryChatValidator, message: v.union(libraryMessageValidator, v.null()),
    matchStart: v.number(), matchEnd: v.number(), historyCursor: v.union(v.string(), v.null()) })),
    continueCursor: v.string(), isDone: v.boolean(), coverage: v.union(v.literal("complete"), v.literal("legacy_only")) }),
  handler: async (ctx, args) => {
    const user = await libraryUser(ctx), filters = normalizedLibraryFilters(args.filters);
    const queryText = args.query.trim().normalize("NFC");
    if (!queryText || [...queryText].length > 200 || /[\p{Cc}\p{Cs}]/u.test(queryText)) return libraryError("invalid_filter");
    const needle = libraryFold(queryText), count = libraryPageSize(args.paginationOpts.numItems);
    const fingerprint = JSON.stringify([filters, needle]);
    const cursor = libraryCursor(args.paginationOpts.cursor, user._id, "search", fingerprint);
    let conversation: Doc<"conversations"> | null = null;
    if (cursor.current) {
      const id = ctx.db.normalizeId("conversations", cursor.current);
      if (!id) return libraryError("invalid_cursor");
      conversation = await ctx.db.get(id);
      if (!conversation || conversation.userId !== user._id) return libraryError("invalid_cursor");
      if (!libraryFilterMatches(conversation, filters)) {
        cursor.current = undefined; cursor.messageKey = undefined; cursor.titleDone = undefined;
        return { page: [], continueCursor: JSON.stringify(cursor), isDone: false, coverage: cursor.legacy ? "legacy_only" as const : "complete" as const };
      }
    } else {
      const chats = await libraryConversationSlice(ctx, user._id, cursor.chatKey, 24);
      const index = chats.page.findIndex((chat) => libraryFilterMatches(chat, filters));
      if (index < 0) {
        cursor.chatKey = chats.indexKeys.at(-1) ?? cursor.chatKey;
        return { page: [], continueCursor: chats.hasMore ? JSON.stringify(cursor) : "", isDone: !chats.hasMore,
          coverage: cursor.legacy ? "legacy_only" as const : "complete" as const };
      }
      conversation = chats.page[index]!;
      cursor.chatKey = chats.indexKeys[index]!; cursor.current = conversation._id; cursor.messageKey = null; cursor.titleDone = false;
    }
    cursor.legacy ||= hasAgentThread(conversation);
    const chat = libraryChat(conversation);
    const page: Array<{ chat: typeof chat; message: ReturnType<typeof libraryMessage> | null;
      matchStart: number; matchEnd: number; historyCursor: string | null }> = [];
    if (!cursor.titleDone) {
      const match = libraryMatch(conversation.title, needle);
      if (match) page.push({ chat, message: null, ...match, historyCursor: null });
      cursor.titleDone = true;
    }
    if (page.length < count) {
      const result = await libraryMessageSlice(ctx, conversation._id, cursor.messageKey ?? null, 99);
      let consumed = 0;
      for (let i = 0; i < result.page.length; i++) {
        const message = result.page[i]!;
        const before = cursor.messageKey ?? null;
        cursor.messageKey = result.indexKeys[i]!; consumed += 1;
        if (message.deletedAt !== undefined || message.role === "system") continue;
        const match = libraryMatch(message.content, needle);
        if (!match) continue;
        const history: LibraryCursor = { v: 1, owner: user._id, kind: "history", fingerprint: JSON.stringify([conversation._id]),
          chatKey: null, current: conversation._id, messageKey: before };
        page.push({ chat, message: libraryMessage(message), ...match, historyCursor: JSON.stringify(history) });
        if (page.length === count) break;
      }
      if (!result.hasMore && consumed === result.page.length) {
        cursor.current = undefined; cursor.messageKey = undefined; cursor.titleDone = undefined;
      }
    }
    // A following bounded chat read determines global exhaustion, including an empty last chat.
    return { page, continueCursor: JSON.stringify(cursor), isDone: false,
      coverage: cursor.legacy ? "legacy_only" as const : "complete" as const };
  },
});
