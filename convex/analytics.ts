import { v } from "convex/values";
import { query } from "./_generated/server";
import { computeInsightsSummary } from "./lib/insights_summary";
import { requireUser } from "./lib/requireUser";

/** Guard against absurd client windows (DST-tolerant day, one-week lookback). */
const maxDayWindowMs = 48 * 60 * 60 * 1000;
const maxWeekLookbackMs = 9 * 24 * 60 * 60 * 1000;

export type OverviewTaskRow = {
  status: "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: number;
};

export type OverviewNoteRow = {
  pinned: boolean;
};

export type OverviewGoalRow = {
  status: "active" | "completed" | "archived";
};

export type OverviewCounts = {
  tasksTotal: number;
  taskTodo: number;
  taskDone: number;
  tasksDueToday: number;
  notesTotal: number;
  notesPinned: number;
  habitsTotal: number;
  goalsActive: number;
  goalsTotal: number;
  memoriesTotal: number;
  coachSessionsTotal: number;
};

/**
 * Pure aggregation over already-fetched rows — exported for unit tests
 * (analytics.test.ts); the query handler is a thin wrapper around this.
 */
export function computeOverview(input: {
  tasks: OverviewTaskRow[];
  notes: OverviewNoteRow[];
  habitsCount: number;
  goals: OverviewGoalRow[];
  memoriesCount: number;
  conversationsCount: number;
  todayStartMs?: number;
  todayEndMs?: number;
}): OverviewCounts {
  const taskTodo = input.tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  ).length;
  const taskDone = input.tasks.filter((t) => t.status === "done").length;
  const notesPinned = input.notes.filter((n) => n.pinned).length;
  const goalsActive = input.goals.filter((g) => g.status === "active").length;

  let tasksDueToday = 0;
  if (input.todayStartMs !== undefined && input.todayEndMs !== undefined) {
    const startMs = input.todayStartMs;
    const endMs = input.todayEndMs;
    tasksDueToday = input.tasks.filter(
      (t) =>
        t.dueAt !== undefined &&
        t.dueAt >= startMs &&
        t.dueAt < endMs &&
        t.status !== "done" &&
        t.status !== "cancelled",
    ).length;
  }

  return {
    tasksTotal: input.tasks.length,
    taskTodo,
    taskDone,
    tasksDueToday,
    notesTotal: input.notes.length,
    notesPinned,
    habitsTotal: input.habitsCount,
    goalsActive,
    goalsTotal: input.goals.length,
    memoriesTotal: input.memoriesCount,
    coachSessionsTotal: input.conversationsCount,
  };
}

/**
 * Aggregated counts for dashboard and analytics screens.
 *
 * HARD_RULES §10 / Convex rule `no-date-now-in-queries`:
 * the caller passes `todayStartMs` and `todayEndMs` derived from the user's
 * local calendar day. We never call `Date.now()` inside the query body —
 * that would break Convex caching + reactivity and make the result depend
 * on wall-clock time rather than data.
 *
 * If the caller omits both window args, `tasksDueToday` is reported as 0.
 * The web and mobile apps should compute the window from
 * `profiles.timezone` (see HARD_RULES §9) before calling.
 */
export const overview = query({
  args: {
    /** Epoch ms at the start of the user's local "today". Pair with `todayEndMs`. */
    todayStartMs: v.optional(v.number()),
    /** Epoch ms at the end of the user's local "today" (exclusive). Pair with `todayStartMs`. */
    todayEndMs: v.optional(v.number()),
  },
  returns: v.object({
    tasksTotal: v.number(),
    taskTodo: v.number(),
    taskDone: v.number(),
    tasksDueToday: v.number(),
    notesTotal: v.number(),
    notesPinned: v.number(),
    habitsTotal: v.number(),
    goalsActive: v.number(),
    goalsTotal: v.number(),
    memoriesTotal: v.number(),
    coachSessionsTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const [tasks, notes, habits, goals, memories, conversations] = await Promise.all([
      ctx.db
        .query("tasks")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("notes")
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
      ctx.db
        .query("memories")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    return computeOverview({
      tasks,
      notes,
      habitsCount: habits.length,
      goals,
      memoriesCount: memories.length,
      conversationsCount: conversations.length,
      todayStartMs: args.todayStartMs,
      todayEndMs: args.todayEndMs,
    });
  },
});

/**
 * Read-only Insights screen summary. Lives on `analytics` so the committed
 * generated API types already know the module.
 *
 * HARD_RULES §10: caller passes local-day and local-week windows.
 */
export const insightsSummary = query({
  args: {
    todayStartMs: v.number(),
    todayEndMs: v.number(),
    weekStartMs: v.number(),
  },
  returns: v.object({
    tasksOpen: v.number(),
    tasksDueToday: v.number(),
    tasksOverdue: v.number(),
    tasksCompletedThisWeek: v.number(),
    openByEnergy: v.object({ low: v.number(), medium: v.number(), high: v.number() }),
    openByPriority: v.object({ low: v.number(), medium: v.number(), high: v.number() }),
    habitsTotal: v.number(),
    habitsWithActiveStreak: v.number(),
    bestStreak: v.number(),
    goalsActive: v.number(),
    goalsAverageProgressPercent: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.todayEndMs <= args.todayStartMs) {
      throw new Error("Today window must end after it starts.");
    }
    if (args.todayEndMs - args.todayStartMs > maxDayWindowMs) {
      throw new Error("Today window is too large.");
    }
    if (args.weekStartMs > args.todayStartMs) {
      throw new Error("Week must start on or before today.");
    }
    if (args.todayStartMs - args.weekStartMs > maxWeekLookbackMs) {
      throw new Error("Week window is too large.");
    }

    const user = await requireUser(ctx);

    const [tasks, habits, goals] = await Promise.all([
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

    return computeInsightsSummary({
      tasks,
      habits,
      goals,
      todayStartMs: args.todayStartMs,
      todayEndMs: args.todayEndMs,
      weekStartMs: args.weekStartMs,
    });
  },
});
