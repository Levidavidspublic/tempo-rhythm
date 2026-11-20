import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";
import { isRestorable, undoUntil } from "./lib/softDelete";

const MAX_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;
const LABEL_MAX = 120;

const focusBlockValidator = v.object({
  _id: v.id("focusBlocks"),
  _creationTime: v.number(),
  userId: v.id("users"),
  startedAtMs: v.number(),
  durationMs: v.number(),
  label: v.optional(v.string()),
  taskId: v.optional(v.id("tasks")),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
});

export const create = mutation({
  args: {
    startedAtMs: v.number(),
    durationMs: v.number(),
    label: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
  },
  returns: v.id("focusBlocks"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(args.durationMs >= 1 && args.durationMs <= MAX_DURATION_MS)) {
      throw new Error("A focus block runs from 1 ms up to 8 hours.");
    }
    if (args.taskId) {
      const task = await ctx.db.get(args.taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) {
        throw new Error("Task not found");
      }
    }
    const label = args.label?.trim().slice(0, LABEL_MAX);
    const now = Date.now();
    return await ctx.db.insert("focusBlocks", {
      userId: user._id,
      startedAtMs: args.startedAtMs,
      durationMs: args.durationMs,
      ...(label ? { label } : {}),
      ...(args.taskId ? { taskId: args.taskId } : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listInRange = query({
  args: { startMs: v.number(), endMs: v.number() },
  returns: v.array(focusBlockValidator),
  handler: async (ctx, args) => {
    if (args.endMs <= args.startMs) {
      throw new Error("Range must end after it starts.");
    }
    if (args.endMs - args.startMs > MAX_RANGE_MS) {
      throw new Error("Range is too large.");
    }
    const user = await requireUser(ctx);
    return await ctx.db
      .query("focusBlocks")
      .withIndex("by_userId_deletedAt_startedAtMs", (q) =>
        q
          .eq("userId", user._id)
          .eq("deletedAt", undefined)
          .gte("startedAtMs", args.startMs)
          .lt("startedAtMs", args.endMs),
      )
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { focusBlockId: v.id("focusBlocks") },
  returns: v.object({ success: v.boolean(), undoUntilMs: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const block = await ctx.db.get(args.focusBlockId);
    if (!block || block.userId !== user._id || block.deletedAt !== undefined) {
      throw new Error("Focus block not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.focusBlockId, { deletedAt: now, updatedAt: now });
    return { success: true, undoUntilMs: undoUntil(now) };
  },
});

export const restore = mutation({
  args: { focusBlockId: v.id("focusBlocks") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const block = await ctx.db.get(args.focusBlockId);
    if (!block || block.userId !== user._id) {
      throw new Error("Focus block not found");
    }
    const now = Date.now();
    if (!isRestorable(block.deletedAt, now)) {
      return { success: false };
    }
    await ctx.db.patch(args.focusBlockId, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});
