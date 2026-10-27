import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

/** Longest message a person can send to the founder. */
export const FEEDBACK_MAX_LENGTH = 2000;
/** Most messages one person can send in a rolling day. */
export const FEEDBACK_DAILY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export const send = mutation({
  args: { message: v.string(), page: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const message = args.message.trim();
    if (message.length < 1 || message.length > FEEDBACK_MAX_LENGTH) {
      throw new Error(`Message must be 1 to ${FEEDBACK_MAX_LENGTH} characters`);
    }
    const now = Date.now();
    const rows = await ctx.db
      .query("feedback")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (rows.filter((r) => r.createdAt > now - DAY_MS).length >= FEEDBACK_DAILY_LIMIT) {
      throw new Error("You have sent the most messages allowed today. Try again tomorrow.");
    }
    return ctx.db.insert("feedback", {
      userId: user._id,
      message,
      createdAt: now,
      page: args.page?.slice(0, 200) || "/ask-founder",
    });
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("feedback")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .filter((r) => r.userId === user._id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({ _id: r._id, message: r.message, createdAt: r.createdAt }));
  },
});
