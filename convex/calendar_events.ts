import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { requireUser } from "./lib/requireUser";
import { isRestorable, undoUntil } from "./lib/softDelete";

const maxCalendarRangeMs = 32 * 24 * 60 * 60 * 1000;

const calendarEventValidator = v.object({
  _id: v.id("calendarEvents"),
  _creationTime: v.number(),
  userId: v.id("users"),
  title: v.string(),
  startsAtMs: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
});

export const listInRange = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  returns: v.array(calendarEventValidator),
  handler: async (ctx, args) => {
    if (args.endMs <= args.startMs) {
      throw new Error("Calendar range must end after it starts.");
    }
    if (args.endMs - args.startMs > maxCalendarRangeMs) {
      throw new Error("Calendar range is too large.");
    }

    const user = await requireUser(ctx);
    return listEventsInRangeForUser(ctx, user._id, args.startMs, args.endMs);
  },
});

/** Shared by `listInRange` and the MCP tools (range checks stay in the callers). */
export async function listEventsInRangeForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  startMs: number,
  endMs: number,
): Promise<Doc<"calendarEvents">[]> {
  return await ctx.db
    .query("calendarEvents")
    .withIndex("by_userId_deletedAt_startsAtMs", (q) =>
      q
        .eq("userId", userId)
        .eq("deletedAt", undefined)
        .gte("startsAtMs", startMs)
        .lt("startsAtMs", endMs),
    )
    .collect();
}

export { maxCalendarRangeMs };

export const create = mutation({
  args: {
    title: v.string(),
    startsAtMs: v.number(),
  },
  returns: v.id("calendarEvents"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return createEventForUser(ctx, user._id, args);
  },
});

/** Shared by `create` and the MCP tools. */
export async function createEventForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { title: string; startsAtMs: number },
): Promise<Id<"calendarEvents">> {
  const title = args.title.trim();
  if (!title) {
    throw new Error("Give the event a gentle label first.");
  }

  const now = Date.now();
  return await ctx.db.insert("calendarEvents", {
    userId,
    title,
    startsAtMs: args.startsAtMs,
    createdAt: now,
    updatedAt: now,
  });
}

export const update = mutation({
  args: {
    eventId: v.id("calendarEvents"),
    title: v.optional(v.string()),
    startsAtMs: v.optional(v.number()),
  },
  returns: v.id("calendarEvents"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return updateEventForUser(ctx, user._id, args);
  },
});

/** Shared by `update` and the MCP tools. Scoped to `userId`. */
export async function updateEventForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { eventId: Id<"calendarEvents">; title?: string; startsAtMs?: number },
): Promise<Id<"calendarEvents">> {
  const event = await ctx.db.get(args.eventId);
  if (!event || event.userId !== userId || event.deletedAt !== undefined) {
    throw new Error("Event not found");
  }
  const patch: { title?: string; startsAtMs?: number; updatedAt: number } = {
    updatedAt: Date.now(),
  };
  if (args.title !== undefined) {
    const title = args.title.trim();
    if (!title) {
      throw new Error("Give the event a gentle label first.");
    }
    patch.title = title;
  }
  if (args.startsAtMs !== undefined) patch.startsAtMs = args.startsAtMs;
  await ctx.db.patch(args.eventId, patch);
  return args.eventId;
}

export const remove = mutation({
  args: { eventId: v.id("calendarEvents") },
  returns: v.object({ success: v.boolean(), undoUntilMs: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.userId !== user._id || event.deletedAt !== undefined) {
      throw new Error("Event not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.eventId, { deletedAt: now, updatedAt: now });
    return { success: true, undoUntilMs: undoUntil(now) };
  },
});

export const restore = mutation({
  args: { eventId: v.id("calendarEvents") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.userId !== user._id) {
      throw new Error("Event not found");
    }
    const now = Date.now();
    if (!isRestorable(event.deletedAt, now)) {
      return { success: false };
    }
    await ctx.db.patch(args.eventId, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});
