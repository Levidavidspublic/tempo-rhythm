import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    let rows = await ctx.db
      .query("goals")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    if (args.status) {
      rows = rows.filter((g) => g.status === args.status);
    }
    rows.sort((a, b) => b.updatedAt - a.updatedAt);
    return rows;
  },
});

export const get = query({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id || goal.deletedAt !== undefined) {
      return null;
    }
    return goal;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    targetDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    return ctx.db.insert("goals", {
      userId: user._id,
      title: args.title.trim(),
      description: args.description?.trim(),
      targetDate: args.targetDate,
      progressPercent: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    goalId: v.id("goals"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    targetDate: v.optional(v.union(v.number(), v.null())),
    progressPercent: v.optional(v.number()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) {
      throw new Error("Goal not found");
    }
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.description !== undefined) {
      patch.description = args.description === null ? undefined : args.description;
    }
    if (args.targetDate !== undefined) {
      patch.targetDate = args.targetDate === null ? undefined : args.targetDate;
    }
    if (args.progressPercent !== undefined) {
      patch.progressPercent = Math.max(0, Math.min(100, args.progressPercent));
    }
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.goalId, patch as typeof goal);
    return args.goalId;
  },
});

export const remove = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) {
      throw new Error("Goal not found");
    }
    await ctx.db.delete(args.goalId);
    return { success: true };
  },
});
