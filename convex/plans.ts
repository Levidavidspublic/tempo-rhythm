import { v } from "convex/values";
import { isLocalDate, parseLocalDate, toDayNumber } from "../packages/core/plan/calendar-math";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { requireUser } from "./lib/requireUser";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { replanRecordValidator } from "./schema/plans";
import { createTaskForUser } from "./tasks";

/**
 * Study plans, kitchen T8 (Plan backend).
 *
 * `createFromPreview` turns the sessions the person saw in the "Plan back from a deadline"
 * preview into ordinary tasks (one per session, elastic, grouped by `projectName` = plan title)
 * plus one `studyPlans` row that remembers them. Nothing is written before the person presses
 * "Add these sessions", and `undoCreate` takes the whole plan back for 5 minutes (HARD_RULES §1).
 *
 * `replan` ("Re-plan the rest", PRD F-07) moves the plan's missed or clashing sessions to the new
 * times the person accepted on the plan screen (worked out there by `replanRest` in
 * packages/core/plan), can leave some out and can move the deadline later; `undoReplan` takes it
 * back for 5 minutes from what `replan` kept on the plan row (`lastReplan`).
 */

const MAX_SESSIONS = 300;
const MAX_TITLE = 200;
const MAX_SESSION_MINUTES = 12 * 60;
/** Real zones run from UTC-12 to UTC+14. */
const MAX_OFFSET_MINUTES = 14 * 60;
const DAY_MINUTES = 24 * 60;
const PLAN_GONE = "This plan isn't here any more. Make a new one whenever you like.";

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
  /**
   * The session's start as Unix ms, worked out in the browser for that date, so a plan that
   * crosses a daylight-saving change keeps each session at its local clock time. Optional; without
   * it the start comes from `timezoneOffsetMinutes`.
   */
  startAt: v.optional(v.number()),
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
  lastReplan: v.optional(replanRecordValidator),
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

/**
 * A daylight-saving shift moves a local time by at most this much against today's offset. Real
 * shifts are one hour or less; a wider bound would let a 23:30 session land on the next local day.
 */
const MAX_DST_SHIFT_MS = 60 * 60_000;

/**
 * The session's start: the browser's own `startAt` when it is within a DST shift of the time the
 * offset gives (so a wrong or hostile value can't move a session to another day), else the
 * offset-based time.
 */
function sessionStart(
  session: { date: string; startMinute: number; startAt?: number },
  offset: number,
): number {
  const fromOffset = localStartToUtcMs(session.date, session.startMinute, offset);
  const startAt = session.startAt;
  if (startAt !== undefined && Number.isFinite(startAt) && Math.abs(startAt - fromOffset) <= MAX_DST_SHIFT_MS) {
    return startAt;
  }
  return fromOffset;
}

function checkOffset(offset: number): number {
  if (!Number.isInteger(offset) || Math.abs(offset) > MAX_OFFSET_MINUTES) {
    throw new Error("That time zone offset isn't one we know.");
  }
  return offset;
}

/** A session's local date and start: a real date before the deadline day, a minute in the day. */
function checkSessionTime(
  session: { date: string; startMinute: number },
  deadlineDay: number,
): void {
  if (!isLocalDate(session.date)) throw new Error("Every session needs a YYYY-MM-DD date.");
  // The deadline day is the exam itself; study happens before it.
  if (toDayNumber(session.date) >= deadlineDay) {
    throw new Error("Every session needs a date before the deadline.");
  }
  if (
    !Number.isInteger(session.startMinute) ||
    session.startMinute < 0 ||
    session.startMinute > 1439
  ) {
    throw new Error("Every session needs a start time within the day.");
  }
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
    const offset = checkOffset(args.timezoneOffsetMinutes);
    if (args.sessions.length === 0) throw new Error("There are no sessions to add yet.");
    if (args.sessions.length > MAX_SESSIONS) throw new Error("That plan has too many sessions.");
    const deadlineDay = toDayNumber(args.deadline);
    for (const session of args.sessions) {
      cleanTitle(session.title, "session");
      checkSessionTime(session, deadlineDay);
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
          dueAt: sessionStart(session, offset),
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

const replanMoveValidator = v.object({
  taskId: v.id("tasks"),
  /** Local `YYYY-MM-DD`. */
  date: v.string(),
  /** Local clock minute the session starts, 0–1439. */
  startMinute: v.number(),
  /** The new start as Unix ms, worked out in the browser for that date (DST), like a session's. */
  startAt: v.optional(v.number()),
});

type ReplanMoveArgs = { taskId: Id<"tasks">; date: string; startMinute: number; startAt?: number };
type ReplanRecord = NonNullable<Doc<"studyPlans">["lastReplan"]>;

/** The same ids, each once, in any order. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  const set = new Set(a);
  return (
    a.length === b.length &&
    set.size === a.length &&
    new Set(b).size === b.length &&
    b.every((id) => set.has(id))
  );
}

/**
 * True when this exact re-plan is already in place (a double tap, or a retry after a lost reply):
 * the last re-plan made the same moves and left out the same sessions, and nothing has moved since.
 */
async function alreadyApplied(
  ctx: MutationCtx,
  userId: Id<"users">,
  last: ReplanRecord,
  moves: readonly ReplanMoveArgs[],
  remove: readonly Id<"tasks">[],
  offset: number,
): Promise<boolean> {
  if (last.undoneAt !== undefined || !sameIds(last.removed, remove)) return false;
  const moved = last.moves.map((move) => move.taskId);
  if (!sameIds(moved, moves.map((move) => move.taskId))) return false;
  const lastTo = new Map(last.moves.map((move) => [move.taskId as string, move.to]));
  for (const move of moves) {
    if (!isLocalDate(move.date) || !Number.isInteger(move.startMinute)) return false;
    const to = sessionStart(move, offset);
    if (lastTo.get(move.taskId) !== to) return false;
    const task = await ctx.db.get(move.taskId);
    if (!task || task.userId !== userId || task.deletedAt !== undefined || task.dueAt !== to) {
      return false;
    }
  }
  for (const taskId of remove) {
    const task = await ctx.db.get(taskId);
    if (!task || task.userId !== userId || task.deletedAt !== last.at) return false;
  }
  return true;
}

/**
 * "Re-plan the rest": moves sessions of a live plan to the new times the person accepted, and can
 * leave some out (soft delete) and move the deadline later (the planner's ways out). Only the
 * plan's own live sessions that aren't done can move, each once, to a date before the deadline,
 * ending by midnight; each start uses the browser's `startAt` within the DST bound, like
 * `createFromPreview`. Nothing is written unless all of it is valid. What was there before is kept
 * on the plan (`lastReplan`) so `undoReplan` can take it back for 5 minutes. The same re-plan sent
 * twice changes nothing the second time and returns the first one's Undo window.
 */
export const replan = mutation({
  args: {
    planId: v.id("studyPlans"),
    moves: v.array(replanMoveValidator),
    /** Sessions to leave out of the plan ("fewer sessions"). */
    remove: v.optional(v.array(v.id("tasks"))),
    /** A later deadline ("a later date"). */
    deadline: v.optional(v.string()),
    timezoneOffsetMinutes: v.number(),
  },
  returns: v.object({ undoUntil: v.number(), moved: v.number(), removed: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ownedPlan(ctx, user._id, args.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.deletedAt !== undefined) throw new Error(PLAN_GONE);
    const offset = checkOffset(args.timezoneOffsetMinutes);
    const remove = args.remove ?? [];

    const last = plan.lastReplan;
    if (
      last &&
      (args.deadline === undefined || args.deadline === plan.deadline) &&
      (await alreadyApplied(ctx, user._id, last, args.moves, remove, offset))
    ) {
      return {
        undoUntil: last.at + UNDO_WINDOW_MS,
        moved: last.moves.length,
        removed: last.removed.length,
      };
    }

    const count = args.moves.length + remove.length;
    if (count === 0) throw new Error("There is nothing to move yet.");
    if (count > MAX_SESSIONS) throw new Error("That plan has too many sessions.");
    let deadline = plan.deadline;
    if (args.deadline !== undefined && args.deadline !== plan.deadline) {
      if (!isLocalDate(args.deadline)) throw new Error("Pick the date as YYYY-MM-DD.");
      if (toDayNumber(args.deadline) <= toDayNumber(plan.deadline)) {
        throw new Error("A new date needs to be later than the plan's date.");
      }
      deadline = args.deadline;
    }

    const inPlan = new Set<string>(plan.taskIds);
    const seen = new Set<string>();
    const liveSession = async (taskId: Id<"tasks">): Promise<Doc<"tasks">> => {
      if (!inPlan.has(taskId) || seen.has(taskId)) {
        throw new Error("Only this plan's own sessions can move, each one once.");
      }
      seen.add(taskId);
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) {
        throw new Error(
          "One of these sessions isn't here any more. Open the plan again to see it now.",
        );
      }
      if (task.status === "done") throw new Error("Done sessions stay where they are.");
      return task;
    };

    const deadlineDay = toDayNumber(deadline);
    const planned: Array<{ task: Doc<"tasks">; to: number }> = [];
    for (const move of args.moves) {
      const task = await liveSession(move.taskId);
      checkSessionTime(move, deadlineDay);
      const minutes = task.timeEstimate !== undefined ? Math.round(task.timeEstimate / 60_000) : 0;
      if (move.startMinute + minutes > DAY_MINUTES) {
        throw new Error("Every session needs to end by midnight.");
      }
      planned.push({ task, to: sessionStart(move, offset) });
    }
    const leaving: Doc<"tasks">[] = [];
    for (const taskId of remove) leaving.push(await liveSession(taskId));

    const now = Date.now();
    const moves: ReplanRecord["moves"] = [];
    for (const { task, to } of planned) {
      moves.push({
        taskId: task._id,
        ...(task.dueAt !== undefined ? { from: task.dueAt } : {}),
        to,
      });
      await ctx.db.patch(task._id, { dueAt: to, updatedAt: now });
    }
    for (const task of leaving) await ctx.db.patch(task._id, { deletedAt: now, updatedAt: now });
    const movedDeadline = deadline !== plan.deadline;
    await ctx.db.patch(plan._id, {
      ...(movedDeadline ? { deadline } : {}),
      lastReplan: {
        at: now,
        moves,
        removed: leaving.map((task) => task._id),
        ...(movedDeadline ? { deadlineBefore: plan.deadline } : {}),
      },
      updatedAt: now,
    });
    return { undoUntil: now + UNDO_WINDOW_MS, moved: moves.length, removed: leaving.length };
  },
});

/**
 * Takes the last re-plan back, for 5 minutes: moved sessions go back to their old times, left-out
 * ones come back and the deadline returns. A session moved again by hand since then keeps its new
 * time. A second undo, or one with no re-plan to undo, changes nothing.
 */
export const undoReplan = mutation({
  args: { planId: v.id("studyPlans") },
  returns: v.object({ restored: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const plan = await ownedPlan(ctx, user._id, args.planId);
    if (!plan) throw new Error("Plan not found");
    if (plan.deletedAt !== undefined) throw new Error(PLAN_GONE);
    const last = plan.lastReplan;
    if (!last || last.undoneAt !== undefined) return { restored: 0 };
    const now = Date.now();
    if (now - last.at > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this have passed. You can still move each session.");
    }
    let restored = 0;
    for (const move of last.moves) {
      const task = await ctx.db.get(move.taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) continue;
      if (task.dueAt !== move.to) continue;
      await ctx.db.patch(move.taskId, { dueAt: move.from, updatedAt: now });
      restored += 1;
    }
    for (const taskId of last.removed) {
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== last.at) continue;
      await ctx.db.patch(taskId, { deletedAt: undefined, updatedAt: now });
      restored += 1;
    }
    await ctx.db.patch(plan._id, {
      ...(last.deadlineBefore !== undefined ? { deadline: last.deadlineBefore } : {}),
      lastReplan: { ...last, undoneAt: now },
      updatedAt: now,
    });
    return { restored };
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
