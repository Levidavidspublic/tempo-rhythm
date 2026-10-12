import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { backlinksFor } from "@tempo/utils";
import { isLocalDate } from "./lib/habitCheckInStreak";
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

/**
 * Most pages the rail shows: pinned first, then the newest pages. Every read loads whole
 * documents (bodies included), and Convex caps one query at 16 MiB read with documents of up
 * to 1 MiB, so the rail reads at most 2 * RAIL_PAGE_LIMIT_MAX = 14 documents.
 */
export const RAIL_PAGE_LIMIT_MAX = 7;

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
  const limit = Math.min(Math.max(Math.floor(requested ?? RAIL_PAGE_LIMIT_MAX), 1), RAIL_PAGE_LIMIT_MAX);
  const toRow = (note: Doc<"notes">): RailPage => ({
    _id: note._id,
    title: note.title,
    pinned: note.pinned,
    updatedAt: note.updatedAt,
  });
  // At most `limit` reads each. Pins: the newest pinned pages, live ones ordered by last edit.
  const pins = await ctx.db
    .query("notes")
    .withIndex("by_userId_pinned", (q) => q.eq("userId", userId).eq("pinned", true))
    .order("desc")
    .take(limit);
  const out = pins
    .filter((n) => n.deletedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toRow);
  if (out.length >= limit) return out;
  // Then the newest live pages: by_userId_deletedAt holds only live rows under
  // deletedAt = undefined, so soft-deleted pages never use up the bound.
  const live = await ctx.db
    .query("notes")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .order("desc")
    .take(limit);
  // Dedupe by id, not by the pinned flag: a live pin the pinned window missed (its newest
  // pins were tombstones) can still show among the newest live pages.
  const seen = new Set<string>(out.map((row) => row._id));
  for (const note of live) {
    if (out.length >= limit) break;
    if (seen.has(note._id)) continue;
    seen.add(note._id);
    out.push(toRow(note));
  }
  return out;
}

/** How many of the owner's most recently edited pages the link queries read. */
export const LINK_SCAN_LIMIT = 500;

export type PageTitle = Pick<Doc<"notes">, "_id" | "title" | "pinned" | "updatedAt">;

/**
 * Titles for the "[[" picker and for resolving a clicked [[link]]. Metadata only, bounded:
 * best match (title starts with the query) first, then most recently edited.
 */
export const searchTitles = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 8), 1), 20);
    const q = args.query.trim().toLocaleLowerCase();
    const rows = await ctx.db
      .query("notes")
      .withIndex("by_userId_updatedAt", (iq) => iq.eq("userId", user._id))
      .order("desc")
      .take(LINK_SCAN_LIMIT);
    // Exact titles first, so resolving a clicked [[Title]] never misses its page behind
    // newer prefix matches; then titles that start with the query; then the rest.
    const exact: PageTitle[] = [];
    const starts: PageTitle[] = [];
    const contains: PageTitle[] = [];
    for (const n of rows) {
      if (n.deletedAt !== undefined || !n.title.trim()) continue;
      const title = n.title.trim().toLocaleLowerCase();
      const row = { _id: n._id, title: n.title, pinned: n.pinned, updatedAt: n.updatedAt };
      if (q && title === q) exact.push(row);
      else if (!q || title.startsWith(q)) starts.push(row);
      else if (title.includes(q)) contains.push(row);
    }
    return [...exact, ...starts, ...contains].slice(0, limit);
  },
});

/**
 * "Linked here": the owner's live pages whose body has a [[link]] to this page's title, with
 * the linking line as plain context. Computed from bodies (bodies are the only truth); no body
 * leaves the server.
 */
export const backlinks = query({
  args: { noteId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const id = ctx.db.normalizeId("notes", args.noteId);
    if (!id) return [];
    const self = await ctx.db.get(id);
    if (!self || self.userId !== user._id || self.deletedAt !== undefined || !self.title.trim()) return [];
    const rows = await ctx.db
      .query("notes")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LINK_SCAN_LIMIT);
    const pages = rows
      .filter((n) => n.deletedAt === undefined)
      .map((n) => ({ id: n._id as string, title: n.title, body: n.body }));
    return backlinksFor(self.title, self._id, pages).slice(0, 50);
  },
});

/* ------------------------------------------------------------------ */
/* Dated pages (v3 OVERNIGHT-RUN.md decision 6, contract NT-07)          */
/* ------------------------------------------------------------------ */

/** A daily page is keyed by its local date; a weekly page by the Monday that starts its week. */
export const periodPageType = v.union(v.literal("daily"), v.literal("weekly"));
export type PeriodPageType = "daily" | "weekly";

/** Upper bounds for a page made from a template. */
export const PERIOD_TITLE_MAX = 200;
export const PERIOD_BODY_MAX = 100_000;

/** True when `date` is a real YYYY-MM-DD date that can key a page of this type. */
export function isPeriodDate(pageType: PeriodPageType, date: string): boolean {
  if (!isLocalDate(date)) return false;
  // Weekly pages are keyed by the ISO week's Monday, so one week never gets two pages.
  return pageType === "daily" || new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

async function findPeriodPage(ctx: QueryCtx, userId: Id<"users">, pageType: PeriodPageType, date: string) {
  return ctx.db
    .query("notes")
    .withIndex("by_userId_deletedAt_pageType_date", (q) =>
      q.eq("userId", userId).eq("deletedAt", undefined).eq("pageType", pageType).eq("date", date),
    )
    .first();
}

/** The owner's live daily or weekly page for a date: id and title only, or null. */
export const getPeriodPage = query({
  args: { pageType: periodPageType, date: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isPeriodDate(args.pageType, args.date)) return null;
    const note = await findPeriodPage(ctx, user._id, args.pageType, args.date);
    return note ? { _id: note._id, title: note.title } : null;
  },
});

/**
 * Opens the day's (or week's) page, making it from the given template text on first open.
 * Idempotent: when a live page for the date exists, its id comes back and nothing is written.
 */
export const ensurePeriodPage = mutation({
  args: { pageType: periodPageType, date: v.string(), title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!isPeriodDate(args.pageType, args.date)) throw new Error("Invalid page date");
    if (args.body.length > PERIOD_BODY_MAX) throw new Error("Page body is too long");
    const existing = await findPeriodPage(ctx, user._id, args.pageType, args.date);
    if (existing) return existing._id;
    const now = Date.now();
    return ctx.db.insert("notes", {
      userId: user._id,
      title: args.title.trim().slice(0, PERIOD_TITLE_MAX) || args.date,
      body: args.body,
      pinned: false,
      periodType: args.pageType,
      pageType: args.pageType,
      date: args.date,
      createdAt: now,
      updatedAt: now,
    });
  },
});

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
    // A dated page restored after a new page was made for the same date comes back as a plain
    // page, so one date never has two live pages (its text is kept either way).
    const kind = note.pageType === "daily" || note.pageType === "weekly" ? note.pageType : null;
    const clash = kind && note.date ? await findPeriodPage(ctx, user._id, kind, note.date) : null;
    if (clash && clash._id !== note._id) {
      await ctx.db.patch(args.noteId, {
        deletedAt: undefined,
        updatedAt: now,
        pageType: "plain",
        periodType: "none",
        date: undefined,
      });
      return { success: true };
    }
    await ctx.db.patch(args.noteId, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});
