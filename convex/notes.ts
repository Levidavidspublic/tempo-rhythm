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

export const list = query({
  args: {
    search: v.optional(v.string()),
    pinnedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return listNotesForUser(ctx, user._id, args);
  },
});

/** Shared by `list` and the MCP tools (`convex/mcpTools.ts`). */
export async function listNotesForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  args: { search?: string; pinnedOnly?: boolean },
): Promise<Doc<"notes">[]> {
  let rows = await ctx.db
    .query("notes")
    .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .collect();

  rows = rows.filter((n) => n.deletedAt === undefined);

  if (args.pinnedOnly) {
    rows = rows.filter((n) => n.pinned);
  }
  if (args.search?.trim()) {
    const q = args.search.trim().toLowerCase();
    rows = rows.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }
  return rows;
}

/** Most pages the rail shows (pinned first, then most recently edited). */
export const RAIL_PAGE_LIMIT_MAX = 20;

export type RailPage = Pick<Doc<"notes">, "_id" | "title" | "pinned" | "updatedAt">;

/**
 * The v3 rail's page tree: a bounded, metadata-only list (no bodies), so every shell route
 * subscribes to a few small rows instead of the whole notebook.
 */
export const listForRail = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return listRailPagesForUser(ctx, user._id, args.limit);
  },
});

export async function listRailPagesForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  requested: number | undefined,
): Promise<RailPage[]> {
  const limit = Math.min(Math.max(Math.floor(requested ?? 8), 1), RAIL_PAGE_LIMIT_MAX);
  // Read a little past the limit so soft-deleted rows can't crowd live pages out entirely.
  const window = limit * 3;
  const pinned = await ctx.db
    .query("notes")
    .withIndex("by_userId_pinned", (q) => q.eq("userId", userId).eq("pinned", true))
    .take(window);
  const recent = await ctx.db
    .query("notes")
    .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(window);
  const seen = new Set<string>();
  const out: RailPage[] = [];
  const live = (n: Doc<"notes">) => n.deletedAt === undefined;
  const byRecent = (a: Doc<"notes">, b: Doc<"notes">) => b.updatedAt - a.updatedAt;
  for (const note of [...pinned.filter(live).sort(byRecent), ...recent.filter(live)]) {
    if (seen.has(note._id) || out.length >= limit) continue;
    seen.add(note._id);
    out.push({ _id: note._id, title: note.title, pinned: note.pinned, updatedAt: note.updatedAt });
  }
  return out;
}

export const get = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id || note.deletedAt !== undefined) {
      return null;
    }
    return note;
  },
});

/** URL-param-safe lookup: any string in, note or null out (never throws on a bad id). */
export const getSafe = query({
  args: { noteId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("notes", args.noteId);
    if (!id) return null;
    const note = await ctx.db.get(id);
    if (!note || note.userId !== user._id || note.deletedAt !== undefined) {
      return null;
    }
    return note;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    pinned: v.optional(v.boolean()),
    periodType: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("none"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return createNoteForUser(ctx, user._id, args);
  },
});

type NotePeriod = "daily" | "weekly" | "monthly" | "none";

/** Shared by `create` and the MCP tools. */
export async function createNoteForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    title: string;
    body: string;
    pinned?: boolean;
    periodType?: NotePeriod;
  },
): Promise<Id<"notes">> {
  const now = Date.now();
  return ctx.db.insert("notes", {
    userId,
    title: args.title.trim(),
    body: args.body,
    pinned: args.pinned ?? false,
    periodType: args.periodType ?? "none",
    createdAt: now,
    updatedAt: now,
  });
}

export const update = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    pinned: v.optional(v.boolean()),
    periodType: v.optional(
      v.union(
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("none"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    return updateNoteForUser(ctx, user._id, args);
  },
});

/** Shared by `update` and the MCP tools. Scoped to `userId`. */
export async function updateNoteForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    noteId: Id<"notes">;
    title?: string;
    body?: string;
    pinned?: boolean;
    periodType?: NotePeriod;
  },
): Promise<Id<"notes">> {
  const note = await ctx.db.get(args.noteId);
  if (!note || note.userId !== userId || note.deletedAt !== undefined) {
    throw new Error("Note not found");
  }
  const now = Date.now();
  const patch: Record<string, unknown> = { updatedAt: now };
  if (args.title !== undefined) patch.title = args.title.trim();
  if (args.body !== undefined) patch.body = args.body;
  if (args.pinned !== undefined) patch.pinned = args.pinned;
  if (args.periodType !== undefined) patch.periodType = args.periodType;
  await ctx.db.patch(args.noteId, patch as typeof note);
  return args.noteId;
}

export const togglePin = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id || note.deletedAt !== undefined) {
      throw new Error("Note not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.noteId, {
      pinned: !note.pinned,
      updatedAt: now,
    });
    return { pinned: !note.pinned };
  },
});

export const remove = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id || note.deletedAt !== undefined) {
      throw new Error("Note not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.noteId, { deletedAt: now, updatedAt: now });
    return { success: true, undoUntilMs: undoUntil(now) };
  },
});

export const restore = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== user._id) {
      throw new Error("Note not found");
    }
    const now = Date.now();
    if (!isRestorable(note.deletedAt, now)) {
      return { success: false };
    }
    await ctx.db.patch(args.noteId, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});
