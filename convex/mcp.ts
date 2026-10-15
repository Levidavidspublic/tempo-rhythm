import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { isInactiveAccount } from "./lib/accountDeletion";
import { isApproved, requireApprovedUser } from "./lib/approval";
import {
  generateToken,
  hashToken,
  MAX_ACTIVE_TOKENS_PER_USER,
  tokenDisplayPrefix,
} from "./lib/mcp/token";
import { requireUser } from "./lib/requireUser";

/** At most one `lastUsedAt` write per token per minute. */
export const TOUCH_INTERVAL_MS = 60_000;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_CALLS = 120;

const tokenListItem = v.object({
  _id: v.id("mcpTokens"),
  name: v.string(),
  prefix: v.string(),
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
});

/** Create a personal token. The plaintext is returned once and never stored. */
export const createToken = mutation({
  args: { name: v.string() },
  returns: v.object({
    tokenId: v.id("mcpTokens"),
    token: v.string(),
    prefix: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const name = args.name.trim().slice(0, 80);
    if (!name) {
      throw new Error("Give the token a name first.");
    }
    const rows = await ctx.db
      .query("mcpTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    if (rows.filter((r) => r.revokedAt === undefined).length >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new Error(
        `You already have ${MAX_ACTIVE_TOKENS_PER_USER} active tokens. Revoke one first.`,
      );
    }
    const token = generateToken();
    const prefix = tokenDisplayPrefix(token);
    const tokenId = await ctx.db.insert("mcpTokens", {
      userId: user._id,
      name,
      tokenHash: await hashToken(token),
      prefix,
      createdAt: Date.now(),
    });
    return { tokenId, token, prefix };
  },
});

/** The caller's tokens, newest first. Never includes the hash or the plaintext. */
export const listTokens = query({
  args: {},
  returns: v.array(tokenListItem),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("mcpTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return rows.map((r) => ({
      _id: r._id,
      name: r.name,
      prefix: r.prefix,
      createdAt: r.createdAt,
      ...(r.lastUsedAt !== undefined ? { lastUsedAt: r.lastUsedAt } : {}),
      ...(r.revokedAt !== undefined ? { revokedAt: r.revokedAt } : {}),
    }));
  },
});

export const revokeToken = mutation({
  args: { tokenId: v.id("mcpTokens") },
  returns: v.object({ revoked: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.tokenId);
    if (!row || row.userId !== user._id) {
      throw new Error("Token not found");
    }
    if (row.revokedAt === undefined) {
      await ctx.db.patch(args.tokenId, { revokedAt: Date.now() });
    }
    return { revoked: true as const };
  },
});

async function activeTokenAndUser(
  ctx: QueryCtx,
  tokenHash: string,
): Promise<{ token: Doc<"mcpTokens">; user: Doc<"users"> } | null> {
  const token = await ctx.db
    .query("mcpTokens")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!token || token.revokedAt !== undefined) {
    return null;
  }
  const user = await ctx.db.get(token.userId);
  if (!user || isInactiveAccount(user)) {
    return null;
  }
  return { token, user };
}

/** `{userId}` for a live token of a live account, else null (revoked, unknown, user deleted). */
export const resolveToken = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(v.object({ userId: v.id("users") }), v.null()),
  handler: async (ctx, args) => {
    const found = await activeTokenAndUser(ctx, args.tokenHash);
    return found ? { userId: found.user._id } : null;
  },
});

/** Bump `lastUsedAt` (at most once a minute per token). */
export const touchToken = internalMutation({
  args: { tokenId: v.id("mcpTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.tokenId);
    const now = Date.now();
    if (row && (row.lastUsedAt === undefined || now - row.lastUsedAt >= TOUCH_INTERVAL_MS)) {
      await ctx.db.patch(args.tokenId, { lastUsedAt: now });
    }
    return null;
  },
});

/**
 * One round trip per MCP call: resolve the token, check the account is approved,
 * count the call against the 120/minute limit and touch `lastUsedAt`.
 */
export const authorizeCall = internalMutation({
  args: { tokenHash: v.string() },
  returns: v.union(
    v.object({ status: v.literal("ok"), userId: v.id("users") }),
    v.object({ status: v.literal("unauthorized") }),
    v.object({ status: v.literal("pending") }),
    v.object({ status: v.literal("rate_limited") }),
  ),
  handler: async (ctx, args) => {
    const found = await activeTokenAndUser(ctx, args.tokenHash);
    if (!found) {
      return { status: "unauthorized" as const };
    }
    const { token, user } = found;
    if (!isApproved(user)) {
      return { status: "pending" as const };
    }
    const now = Date.now();
    const inWindow =
      token.windowStartMs !== undefined && now - token.windowStartMs < RATE_LIMIT_WINDOW_MS;
    const count = inWindow ? (token.windowCount ?? 0) : 0;
    if (count >= RATE_LIMIT_MAX_CALLS) {
      return { status: "rate_limited" as const };
    }
    const patch: Partial<Doc<"mcpTokens">> = {
      windowStartMs: inWindow ? token.windowStartMs : now,
      windowCount: count + 1,
    };
    if (token.lastUsedAt === undefined || now - token.lastUsedAt >= TOUCH_INTERVAL_MS) {
      patch.lastUsedAt = now;
    }
    await ctx.db.patch(token._id, patch);
    return { status: "ok" as const, userId: user._id as Id<"users"> };
  },
});
