import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";
import { isRestorable, undoUntil } from "./lib/softDelete";

const MAX_BODY_LENGTH = 20_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function clampBody(value: string): string {
  return value.slice(0, MAX_BODY_LENGTH);
}

function validateDateKey(dateKey: string): void {
  if (!isDateKey(dateKey)) {
    throw new Error("Date must use a valid YYYY-MM-DD value");
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return entries.filter((entry) => entry.deletedAt === undefined).slice(0, 50);
  },
});

export const getDaily = query({
  args: { dateKey: v.string() },
  handler: async (ctx, args) => {
    validateDateKey(args.dateKey);
    const user = await requireUser(ctx);
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("dateKey", args.dateKey),
      )
      .collect();
    return entries.find((entry) => entry.deletedAt === undefined) ?? null;
  },
});

export const create = mutation({
  args: { dateKey: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    validateDateKey(args.dateKey);
    const user = await requireUser(ctx);
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("dateKey", args.dateKey),
      )
      .collect();
    if (entries.some((entry) => entry.deletedAt === undefined)) {
      throw new Error("Journal entry already exists for this date");
    }
    const now = Date.now();
    return ctx.db.insert("journalEntries", {
      userId: user._id,
      dateKey: args.dateKey,
      body: clampBody(args.body),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { id: v.id("journalEntries"), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== user._id || entry.deletedAt !== undefined) {
      throw new Error("Journal entry not found");
    }

    await ctx.db.patch(args.id, {
      body: clampBody(args.body),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("journalEntries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== user._id || entry.deletedAt !== undefined) {
      throw new Error("Journal entry not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, { deletedAt: now, updatedAt: now });
    return { success: true, undoUntilMs: undoUntil(now) };
  },
});

export const restore = mutation({
  args: { id: v.id("journalEntries") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const entry = await ctx.db.get(args.id);
    if (!entry || entry.userId !== user._id) {
      throw new Error("Journal entry not found");
    }

    const now = Date.now();
    if (!isRestorable(entry.deletedAt, now)) {
      return { success: false };
    }

    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("dateKey", entry.dateKey),
      )
      .collect();
    if (entries.some((candidate) => candidate.deletedAt === undefined)) {
      throw new Error("Journal entry already exists for this date");
    }

    await ctx.db.patch(args.id, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});

export const updateDaily = mutation({
  args: { dateKey: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    validateDateKey(args.dateKey);
    const user = await requireUser(ctx);
    const entries = await ctx.db
      .query("journalEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("dateKey", args.dateKey),
      )
      .collect();
    const existing = entries.find((entry) => entry.deletedAt === undefined);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        body: clampBody(args.body),
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("journalEntries", {
      userId: user._id,
      dateKey: args.dateKey,
      body: clampBody(args.body),
      createdAt: now,
      updatedAt: now,
    });
  },
});
