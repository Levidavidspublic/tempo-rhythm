import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

const kindValidator = v.union(v.literal("system"), v.literal("reminder"), v.literal("billing"));

const notificationValidator = v.object({
  _id: v.id("notifications"),
  title: v.string(),
  body: v.string(),
  kind: kindValidator,
  readAt: v.optional(v.number()),
  createdAt: v.number(),
});

export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.array(notificationValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .collect();
    return rows
      .filter((row) => row.deletedAt === undefined)
      .filter((row) => (args.unreadOnly ? row.readAt === undefined : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => {
        const view: {
          _id: typeof row._id;
          title: string;
          body: string;
          kind: typeof row.kind;
          readAt?: number;
          createdAt: number;
        } = {
          _id: row._id,
          title: row.title,
          body: row.body,
          kind: row.kind,
          createdAt: row.createdAt,
        };
        if (row.readAt !== undefined) {
          view.readAt = row.readAt;
        }
        return view;
      });
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.deletedAt !== undefined) {
      throw new Error("Notification not found");
    }
    if (row.userId !== user._id) {
      throw new Error("Access denied");
    }
    if (row.readAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(row._id, { readAt: now, updatedAt: now });
    }
    return null;
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const now = Date.now();
    let updated = 0;
    for (const row of rows) {
      if (row.deletedAt !== undefined || row.readAt !== undefined) {
        continue;
      }
      await ctx.db.patch(row._id, { readAt: now, updatedAt: now });
      updated += 1;
    }
    return { updated };
  },
});
