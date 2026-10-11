import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  MIN_LOAD,
  afterAccept,
  afterReject,
  checkRealism,
  effectiveLoad,
  pickTenSecondAction,
  taskMinutes,
} from "./lib/coachLoad";
import { CRISIS_CARD, crisisCardText, isCrisisText } from "./lib/crisisWords";
import { requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";

const DEFAULT_DIAL = 5;
const PANIC_MS = 30 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** No completed task in this many days counts as a quiet stretch, never as failure. */
const LOW_ACTIVITY_DAYS = 3;
const AVAILABLE_MINUTES = 120;
const AVAILABLE_MINUTES_BAD_DAY = 60;

/**
 * English-first, anti-shame coach replies per technique (HARD_RULES §1).
 * Copy never implies the user is behind, failing, or lazy — it always offers
 * one small, optional next step.
 *
 * Keyed by `conversations.technique`; unknown or missing techniques fall back
 * to `general`.
 */
const COACH_REPLIES: Record<string, string> = {
  pomodoro:
    "Try one 25-minute stretch with a single timer. After a 5-minute break, you get to choose: another stretch, or move on. Either answer is a win.",
  body_double:
    "Work alongside someone — in person or on a quiet video call — without talking about the task. Just having company nearby makes it easier to stay with it.",
  eat_the_frog:
    "Pick the task that feels heaviest today and start there, before anything else. Only the first small step counts right now — nothing more.",
  time_blocking:
    "Block a short window on your calendar for one task, and set a single reminder for the end of the window. No mid-plan changes — the window does the deciding for you.",
  two_minute:
    "If it truly takes under two minutes, do it now. If not, shrink it into a step so small it starts in one second.",
  general:
    "What's the smallest step you could take without any resistance? Start there — that's the whole assignment.",
};

/**
 * Resolve the coach reply for a conversation technique.
 * Pure helper so the copy is unit-testable (see coach.test.ts).
 */
export function coachReplyForTechnique(technique: string | undefined): string {
  if (technique !== undefined && Object.prototype.hasOwnProperty.call(COACH_REPLIES, technique)) {
    return COACH_REPLIES[technique] as string;
  }
  return COACH_REPLIES.general as string;
}

/**
 * Append a user message and a coach reply (template by conversation technique).
 * Crisis text gets the fixed resources card instead, with no model call.
 * Does not silently change tasks or notes — only chat rows.
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.object({ success: v.literal(true), crisis: v.optional(v.boolean()) }),
  handler: async (ctx, args) => {
    // Coach chat is an AI surface: pending/revoked accounts are rejected server-side.
    const user = await requireApprovedUser(ctx);
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== user._id) {
      throw new Error("Conversation not found");
    }
    const text = args.content.trim();
    if (!text) {
      throw new Error("Message is empty");
    }

    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: text,
      createdAt: now,
    });

    const crisis = isCrisisText(text);
    const assistantBody = crisis ? crisisCardText(CRISIS_CARD) : coachReplyForTechnique(conv.technique);

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: assistantBody,
      modelUsed: crisis ? "crisis-card" : "coach-template",
      createdAt: now + 1,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now + 1,
    });

    return crisis ? { success: true as const, crisis: true } : { success: true as const };
  },
});

type Db = QueryCtx | MutationCtx;
type UserId = Doc<"users">["_id"];

async function loadSettings(ctx: Db, userId: UserId) {
  return ctx.db
    .query("coachSettings")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .first();
}

async function ensureSettings(ctx: MutationCtx, userId: UserId): Promise<Doc<"coachSettings">> {
  const existing = await loadSettings(ctx, userId);
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("coachSettings", {
    userId,
    dial: DEFAULT_DIAL,
    taskLoad: MIN_LOAD,
    acceptedStreak: 0,
    updatedAt: Date.now(),
  });
  return (await ctx.db.get(id)) as Doc<"coachSettings">;
}

async function computeBadDay(ctx: Db, userId: UserId, now: number) {
  const settings = await loadSettings(ctx, userId);
  const taskLoad = settings?.taskLoad ?? MIN_LOAD;
  if (settings?.panicUntil !== undefined && settings.panicUntil > now) {
    return { isBadDay: true, reason: "panic" as "panic" | "low_activity" | null, suggestedLoad: MIN_LOAD };
  }
  const done = await ctx.db
    .query("tasks")
    .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "done"))
    .collect();
  const since = now - LOW_ACTIVITY_DAYS * DAY_MS;
  const recent = done.some((t) => t.deletedAt === undefined && (t.completedAt ?? 0) >= since);
  if (!recent) {
    return { isBadDay: true, reason: "low_activity" as "panic" | "low_activity" | null, suggestedLoad: MIN_LOAD };
  }
  return {
    isBadDay: false,
    reason: null as "panic" | "low_activity" | null,
    suggestedLoad: effectiveLoad(taskLoad, false),
  };
}

export const getSettings = query({
  args: {},
  returns: v.object({
    dial: v.number(),
    taskLoad: v.number(),
    panicUntil: v.union(v.number(), v.null()),
    acceptedStreak: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const s = await loadSettings(ctx, user._id);
    return {
      dial: s?.dial ?? DEFAULT_DIAL,
      taskLoad: s?.taskLoad ?? MIN_LOAD,
      panicUntil: s?.panicUntil ?? null,
      acceptedStreak: s?.acceptedStreak ?? 0,
    };
  },
});

export const setDial = mutation({
  args: { dial: v.number() },
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!Number.isInteger(args.dial) || args.dial < 0 || args.dial > 10) {
      throw new Error("The dial is a whole number from 0 to 10.");
    }
    const s = await ensureSettings(ctx, user._id);
    await ctx.db.patch(s._id, { dial: args.dial, updatedAt: Date.now() });
    return { success: true as const };
  },
});

export const pressPanic = mutation({
  args: {},
  returns: v.object({ panicUntil: v.number(), action: v.object({ text: v.string() }) }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const s = await ensureSettings(ctx, user._id);
    const now = Date.now();
    const panicUntil = now + PANIC_MS;
    await ctx.db.patch(s._id, { panicUntil, updatedAt: now });
    return { panicUntil, action: { text: pickTenSecondAction(now) } };
  },
});

export const clearPanic = mutation({
  args: {},
  returns: v.object({ success: v.literal(true) }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const s = await ensureSettings(ctx, user._id);
    await ctx.db.patch(s._id, { panicUntil: undefined, updatedAt: Date.now() });
    return { success: true as const };
  },
});

export const badDay = query({
  args: {},
  returns: v.object({
    isBadDay: v.boolean(),
    reason: v.union(v.literal("panic"), v.literal("low_activity"), v.null()),
    suggestedLoad: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return computeBadDay(ctx, user._id, Date.now());
  },
});

const realismValidator = v.object({
  ok: v.boolean(),
  totalMinutes: v.number(),
  availableMinutes: v.number(),
  note: v.string(),
});

const proposalValidator = v.object({
  _id: v.id("coachProposals"),
  status: v.literal("pending"),
  tasks: v.array(v.object({ taskId: v.id("tasks"), title: v.string(), minutes: v.number() })),
  tenSecondAction: v.string(),
  realism: realismValidator,
  createdAt: v.number(),
});

/** Open work: todo or in progress, not soft-deleted. Closed tasks never enter or stay on a plan. */
export function isOpenTask(t: Pick<Doc<"tasks">, "status" | "deletedAt">): boolean {
  return t.deletedAt === undefined && (t.status === "todo" || t.status === "in_progress");
}

async function pendingProposal(ctx: Db, userId: UserId) {
  return ctx.db
    .query("coachProposals")
    .withIndex("by_userId_status_deletedAt", (q) =>
      q.eq("userId", userId).eq("status", "pending").eq("deletedAt", undefined),
    )
    .first();
}

export const currentProposal = query({
  args: {},
  returns: v.union(proposalValidator, v.null()),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const p = await pendingProposal(ctx, user._id);
    if (!p) {
      return null;
    }
    const tasks: { taskId: Doc<"tasks">["_id"]; title: string; minutes: number }[] = [];
    for (const taskId of p.taskIds) {
      const t = await ctx.db.get(taskId);
      if (t && t.userId === user._id && isOpenTask(t)) {
        tasks.push({ taskId, title: t.title, minutes: taskMinutes(t) });
      }
    }
    return {
      _id: p._id,
      status: "pending" as const,
      tasks,
      tenSecondAction: p.tenSecondAction,
      realism: p.realism,
      createdAt: p.createdAt,
    };
  },
});

/** Code picks the tasks and the action; no model is involved. */
export const createProposal = mutation({
  args: {},
  returns: v.id("coachProposals"),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const existing = await pendingProposal(ctx, user._id);
    if (existing) {
      return existing._id;
    }
    const now = Date.now();
    const settings = await ensureSettings(ctx, user._id);
    const bad = await computeBadDay(ctx, user._id, now);
    const load = effectiveLoad(settings.taskLoad, bad.isBadDay);

    const candidates = [];
    for (const status of ["todo", "in_progress"] as const) {
      const rows = await ctx.db
        .query("tasks")
        .withIndex("by_userId_status", (q) => q.eq("userId", user._id).eq("status", status))
        .collect();
      candidates.push(...rows);
    }
    const open = candidates
      .filter(isOpenTask)
      .sort(
        (a, b) =>
          (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt - b.createdAt,
      )
      .slice(0, load);
    if (open.length === 0) {
      throw new Error("No open tasks to plan yet. Add one and come back.");
    }

    return ctx.db.insert("coachProposals", {
      userId: user._id,
      status: "pending",
      taskIds: open.map((t) => t._id),
      tenSecondAction: pickTenSecondAction(now),
      realism: checkRealism(open, bad.isBadDay ? AVAILABLE_MINUTES_BAD_DAY : AVAILABLE_MINUTES),
      createdAt: now,
    });
  },
});

/** Accept / reject is law: only this mutation changes tasks, and only on accept. */
export const decideProposal = mutation({
  args: {
    proposalId: v.id("coachProposals"),
    decision: v.union(v.literal("accept"), v.literal("reject")),
  },
  returns: v.object({
    status: v.union(v.literal("accepted"), v.literal("rejected")),
    taskLoad: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.get(args.proposalId);
    if (!p || p.userId !== user._id || p.deletedAt !== undefined) {
      throw new Error("Proposal not found");
    }
    if (p.status !== "pending") {
      throw new Error("This proposal was already decided.");
    }
    const now = Date.now();
    const settings = await ensureSettings(ctx, user._id);

    if (args.decision === "accept") {
      for (const taskId of p.taskIds) {
        const t = await ctx.db.get(taskId);
        if (t && t.userId === user._id && isOpenTask(t)) {
          await ctx.db.patch(taskId, { dueAt: now, updatedAt: now });
        }
      }
      const next = afterAccept(settings.taskLoad, settings.acceptedStreak);
      await ctx.db.patch(settings._id, { ...next, updatedAt: now });
      await ctx.db.patch(p._id, { status: "accepted", decidedAt: now });
      return { status: "accepted" as const, taskLoad: next.taskLoad };
    }

    const next = afterReject();
    await ctx.db.patch(settings._id, { ...next, updatedAt: now });
    await ctx.db.patch(p._id, { status: "rejected", decidedAt: now });
    return { status: "rejected" as const, taskLoad: next.taskLoad };
  },
});
