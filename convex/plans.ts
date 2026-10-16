import { v } from "convex/values";
import { isLocalDate, parseLocalDate } from "../packages/core/plan/calendar-math";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { createTaskForUser } from "./tasks";

/**
 * Study plans, kitchen T8 (Plan backend).
 *
 * `createFromPreview` turns the sessions the person saw in the "Plan back from a deadline"
 * preview into ordinary tasks (one per session, elastic, grouped by `projectName` = plan title)
 * plus one `studyPlans` row that remembers them. Nothing is written before the person presses
 * "Add these sessions", and `undoCreate` takes the whole plan back for 5 minutes (HARD_RULES §1).
 */

const MAX_SESSIONS = 300;
const MAX_TITLE = 200;
const MAX_SESSION_MINUTES = 12 * 60;
/** Real zones run from UTC-12 to UTC+14. */
const MAX_OFFSET_MINUTES = 14 * 60;

const sessionKindValidator = v.union(
  v.literal("learn"),
  v.literal("review"),
  v.literal("practice"),
  v.literal("rest"),
);

const sessionValidator = v.object({
  title: v.string(),
  /** Local `YYYY-MM-DD`. */
  date: v.string(),
  /** Local clock minute the session starts, 0–1439. */
  startMinute: v.number(),
  minutes: v.number(),
  kind: sessionKindValidator,
});

const planValidator = v.object({
  _id: v.id("studyPlans"),
  _creationTime: v.number(),
  userId: v.id("users"),
  title: v.string(),
  deadline: v.string(),
  sourceSetId: v.optional(v.string()),
  taskIds: v.array(v.id("tasks")),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
});

const planTaskValidator = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  status: v.union(
    v.literal("todo"),
    v.literal("in_progress"),
    v.literal("done"),
    v.literal("cancelled"),
  ),
  dueAt: v.optional(v.number()),
  timeEstimate: v.optional(v.number()),
  flexibility: v.optional(v.union(v.literal("fixed"), v.literal("elastic"))),
});

/**
 * Unix ms for a local date and clock minute. `timezoneOffsetMinutes` follows
 * `Date#getTimezoneOffset`: UTC minus local, so Israel in summer (UTC+3) passes -180.
 */
export function localStartToUtcMs(
  date: string,
  startMinute: number,
  timezoneOffsetMinutes: number,
): number {
  const { year, month, day } = parseLocalDate(date);
  return Date.UTC(year, month - 1, day) + (startMinute + timezoneOffsetMinutes) * 60_000;
}

function cleanTitle(raw: string, what: string): string {
  const title = raw.trim();
  if (title === "") throw new Error(`Give the ${what} a name first.`);
  if (title.length > MAX_TITLE) throw new Error(`That ${what} name is too long.`);
  return title;
}

async function ownedPlan(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  planId: Id<"studyPlans">,
): Promise<Doc<"studyPlans"> | null> {
  const plan = await ctx.db.get(planId);
  if (!plan || plan.userId !== userId) return null;
  return plan;
}

export const createFromPreview = mutation({
  args: {
    title: v.string(),
    deadline: v.string(),
    sourceSetId: v.optional(v.string()),
    sessions: v.array(sessionValidator),
    timezoneOffsetMinutes: v.number(),
  },
  returns: v.object({ planId: v.id("studyPlans"), undoUntil: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = cleanTitle(args.title, "plan");
    if (!isLocalDate(args.deadline)) throw new Error("Pick the date as YYYY-MM-DD.");
    const offset = args.timezoneOffsetMinutes;
    if (!Number.isInteger(offset) || Math.abs(offset) > MAX_OFFSET_MINUTES) {
      throw new Error("That time zone offset isn't one we know.");
    }
    if (args.sessions.length === 0) throw new Error("There are no sessions to add yet.");
    if (args.sessions.length > MAX_SESSIONS) throw new Error("That plan has too many sessions.");
    for (const session of args.sessions) {
      cleanTitle(session.title, "session");
      if (!isLocalDate(session.date)) throw new Error("Every session needs a YYYY-MM-DD date.");
      if (
        !Number.isInteger(session.startMinute) ||
        session.startMinute < 0 ||
        session.startMinute > 1439
      ) {
        throw new Error("Every session needs a start time within the day.");
      }
      if (
        !Number.isFinite(session.minutes) ||
        session.minutes <= 0 ||
        session.minutes > MAX_SESSION_MINUTES
      ) {
        throw new Error("Every session needs a length between 1 minute and 12 hours.");
      }
    }

    const taskIds: Id<"tasks">[] = [];
    for (const session of args.sessions) {
      taskIds.push(
        await createTaskForUser(ctx, user._id, {
          title: session.title,
          status: "todo",
          priority: "medium",
          flexibility: "elastic",
          timeEstimate: Math.round(session.minutes * 60_000),
          projectName: title,
          dueAt: localStartToUtcMs(session.date, session.startMinute, offset),
        }),
      );
    }

    const now = Date.now();
    const planId = await ctx.db.insert("studyPlans", {
      userId: user._id,
      title,
      deadline: args.deadline,
      ...(args.sourceSetId !== undefined ? { sourceSetId: args.sourceSetId } : {}),
      taskIds,
      createdAt: now,
      updatedAt: now,
    });
    return { planId, undoUntil: now + UNDO_WINDOW_MS };
  },
});

/** Takes a just-made plan back: the plan and its tasks are soft-deleted. Only for 5 minutes. */
export const undoCreate = mutation({
  args: { planId: v.id("studyPlans") },
  returns: v.object({ removedTasks: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ownedPlan(ctx, user._id, args.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.deletedAt !== undefined) return { removedTasks: 0 };
    const now = Date.now();
    if (now - plan.createdAt > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this plan have passed. You can still edit each session.");
    }
    let removedTasks = 0;
    for (const taskId of plan.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) continue;
      await ctx.db.patch(taskId, { deletedAt: now, updatedAt: now });
      removedTasks += 1;
    }
    await ctx.db.patch(args.planId, { deletedAt: now, updatedAt: now });
    return { removedTasks };
  },
});

/** The caller's live plans, most recently changed first. */
export const list = query({
  args: {},
  returns: v.array(planValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("studyPlans")
      .withIndex("by_userId_updated", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
    return rows.filter((row) => row.deletedAt === undefined);
  },
});

/** One live plan with its live tasks, or null when it isn't the caller's (or is gone). */
export const get = query({
  args: { planId: v.id("studyPlans") },
  returns: v.union(v.null(), v.object({ plan: planValidator, tasks: v.array(planTaskValidator) })),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ownedPlan(ctx, user._id, args.planId);
    if (!plan || plan.deletedAt !== undefined) return null;
    const tasks = [];
    for (const taskId of plan.taskIds) {
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) continue;
      tasks.push({
        _id: task._id,
        title: task.title,
        status: task.status,
        ...(task.dueAt !== undefined ? { dueAt: task.dueAt } : {}),
        ...(task.timeEstimate !== undefined ? { timeEstimate: task.timeEstimate } : {}),
        ...(task.flexibility !== undefined ? { flexibility: task.flexibility } : {}),
      });
    }
    return { plan, tasks };
  },
});
