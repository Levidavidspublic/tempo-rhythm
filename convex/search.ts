import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";

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
