import { v } from "convex/values";
import { action, internalMutation, query, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUser } from "./lib/requireUser";
import { requireApprovedUser } from "./lib/approval";
import { requireApprovedForAi } from "./lib/aiGate";
import { isCrisisText } from "./lib/crisisWords";
import { preferencesFor } from "./preferences";
import { WEB_SEARCH_DAILY_LIMIT } from "./coach";
import { emptySearchLookup, kbSearchCapabilities, kbSearchConfigured, kbSearchSupport, lookupConfiguredSearch,
  normalizeSearchOptions, pruneOldWebSearches, searchCategoryValidator, searchOptionsValidator, utcDay, validateLookupQuery,
  type SearchOptions, type SearchCategory, type SearchLookup } from "./lib/webSearch";

const SNIPPET_MAX = 120;
const GROUP_LIMIT = 8;

const taskStatusValidator = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("cancelled"),
);

const searchResultValidator = v.object({
  notes: v.array(
    v.object({
      _id: v.id("notes"),
      title: v.string(),
      snippet: v.string(),
    }),
  ),
  tasks: v.array(
    v.object({
      _id: v.id("tasks"),
      title: v.string(),
      status: taskStatusValidator,
    }),
  ),
  habits: v.array(
    v.object({
      _id: v.id("habits"),
      name: v.string(),
    }),
  ),
  goals: v.array(
    v.object({
      _id: v.id("goals"),
      title: v.string(),
    }),
  ),
});

function emptySearchResult() {
  return {
    notes: [],
    tasks: [],
    habits: [],
    goals: [],
  };
}

function includesQuery(value: string, queryText: string): boolean {
  return value.toLowerCase().includes(queryText);
}

function snippetFromBody(body: string, queryText: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= SNIPPET_MAX) {
    return trimmed;
  }
  const at = trimmed.toLowerCase().indexOf(queryText);
  if (at === -1) {
    return trimmed.slice(0, SNIPPET_MAX);
  }
  const start = Math.max(0, at - 20);
  return trimmed.slice(start, start + SNIPPET_MAX);
}

export const all = query({
  args: { query: v.string() },
  returns: searchResultValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const queryText = args.query.trim().toLowerCase();
    if (!queryText) {
      return emptySearchResult();
    }

    const [notes, tasks, habits, goals] = await Promise.all([
      ctx.db
        .query("notes")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("habits")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("goals")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    return {
      notes: notes
        .filter((row) => row.deletedAt === undefined)
        .filter((row) => includesQuery(row.title, queryText) || includesQuery(row.body, queryText))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, GROUP_LIMIT)
        .map((row) => ({
          _id: row._id,
          title: row.title,
          snippet: snippetFromBody(row.body, queryText),
        })),
      tasks: tasks
        .filter((row) => row.deletedAt === undefined)
        .filter((row) => includesQuery(row.title, queryText))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, GROUP_LIMIT)
        .map((row) => ({
          _id: row._id,
          title: row.title,
          status: row.status,
        })),
      habits: habits
        .filter((row) => row.deletedAt === undefined)
        .filter((row) => includesQuery(row.name, queryText))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, GROUP_LIMIT)
        .map((row) => ({
          _id: row._id,
          name: row.name,
        })),
      goals: goals
        .filter((row) => row.deletedAt === undefined)
        .filter((row) => includesQuery(row.title, queryText))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, GROUP_LIMIT)
        .map((row) => ({
          _id: row._id,
          title: row.title,
        })),
    };
  },
});

export const capabilities = query({
  args: {},
  returns: v.object({ enabled: v.boolean(), modes: v.array(v.union(v.literal("speed"), v.literal("balanced"), v.literal("quality"))),
    sources: v.array(v.union(v.literal("web"), v.literal("discussions"), v.literal("academic"))), categories: v.array(searchCategoryValidator) }),
  handler: async (ctx) => { await requireUser(ctx); return kbSearchCapabilities(); },
});

/** One content-free reservation in the same ten-per-UTC-day counter as coach. */
export const reserveLookup = internalMutation({
  args: {}, returns: v.object({ status: v.union(v.literal("reserved"), v.literal("off"), v.literal("limit")) }),
  handler: async (ctx) => {
    const user = await requireApprovedUser(ctx);
    if (!kbSearchConfigured() || !(await preferencesFor(ctx, user._id)).coachWebSearch) return { status: "off" as const };
    const now = Date.now(), day = utcDay(now);
    const used = await ctx.db.query("coachWebSearches").withIndex("by_userId_utcDateKey",
      (q) => q.eq("userId", user._id).eq("utcDateKey", day)).take(WEB_SEARCH_DAILY_LIMIT);
    if (used.length >= WEB_SEARCH_DAILY_LIMIT) return { status: "limit" as const };
    await pruneOldWebSearches(ctx, user._id, now);
    await ctx.db.insert("coachWebSearches", { userId: user._id, utcDateKey: day, createdAt: now, updatedAt: now });
    return { status: "reserved" as const };
  },
});

export async function runSearchLookup(ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  args: { query: string; options: SearchOptions; category: SearchCategory },
  lookup: typeof lookupConfiguredSearch = lookupConfiguredSearch): Promise<SearchLookup> {
  await requireApprovedForAi(ctx as ActionCtx);
  const query = validateLookupQuery(args.query), options = normalizeSearchOptions(args.options);
  if (isCrisisText(query)) return emptySearchLookup("crisis");
  const support = kbSearchSupport(options, args.category);
  if (support !== "ready") return emptySearchLookup(support);
  const reservation = await ctx.runMutation(internal.search.reserveLookup, {});
  if (reservation.status !== "reserved") return emptySearchLookup(reservation.status);
  return lookup(query, options, args.category);
}

export const lookup = action({
  args: { query: v.string(), options: searchOptionsValidator, category: searchCategoryValidator },
  returns: v.object({ status: v.union(v.literal("ok"), v.literal("off"), v.literal("limit"), v.literal("unavailable"), v.literal("unsupported"), v.literal("crisis")),
    rows: v.array(v.object({ title: v.string(), site: v.string(), url: v.string(), snippet: v.string(), imageUrl: v.null(), thumbnailUrl: v.null(),
      durationSeconds: v.null(), publishedAt: v.null() })), retrievedAt: v.union(v.number(), v.null()), truncated: v.boolean() }),
  handler: (ctx, args) => runSearchLookup(ctx, args),
});
