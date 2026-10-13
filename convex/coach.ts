import { v } from "convex/values";
import { projectPageText } from "@tempo/utils";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
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
import { callLLM } from "./lib/ai_router";
import { requireApprovedForAi } from "./lib/aiGate";
import { requireApprovedUser } from "./lib/approval";
import {
  COACH_LIMITS,
  type CoachProposal,
  buildCoachMessages,
  parseCoachReply,
  readProposal,
} from "./lib/coachPrompt";
import { requireUser } from "./lib/requireUser";
import { undoUntil } from "./lib/softDelete";
import { requireLegacyWritableConversation } from "./messages";
import { createTaskForUser } from "./tasks";

const DEFAULT_DIAL = 5;
const PANIC_MS = 30 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** No completed task in this many days counts as a quiet stretch, never as failure. */
const LOW_ACTIVITY_DAYS = 3;
const AVAILABLE_MINUTES = 120;
const AVAILABLE_MINUTES_BAD_DAY = 60;

/**
 * The coach chat (OVERNIGHT-RUN.md run 2, item 2). A turn is two calls from the client:
 *
 * 1. `sendMessage` (mutation) stores the user's message. Crisis text also stores the fixed
 *    resources card, and no model is ever called for it.
 * 2. `reply` (action) checks AI approval first, claims the turn (so overlapping replies make one
 *    model call), reads the open page and the newest messages, and asks the one model seam
 *    (`callLLM`, convex/lib/ai_router.ts) for a reply. A missing key or a provider error is logged
 *    and answered with `unavailable`, and the claim is released; the user's message stays saved.
 *
 * The coach only proposes. A proposal (task, note or template) rides on its reply's
 * `toolCalls.coachProposal`; nothing changes until `acceptProposal`, and every accepted change can
 * be undone for 5 minutes with `undoProposal` (HARD_RULES §1, §6.2).
 */

/** Longest message the coach takes. */
export const MAX_MESSAGE_CHARS = 4000;

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  returns: v.object({ success: v.literal(true), crisis: v.optional(v.boolean()) }),
  handler: async (ctx, args) => {
    // Coach chat is an AI surface: pending/revoked accounts are rejected server-side.
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);
    const text = args.content.trim();
    if (!text) {
      throw new Error("Message is empty");
    }
    if (text.length > MAX_MESSAGE_CHARS) {
      throw new Error("That message is too long. Try a shorter one.");
    }

    const now = Date.now();
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      content: text,
      createdAt: now,
    });

    const crisis = isCrisisText(text);
    if (crisis) {
      await ctx.db.insert("messages", {
        conversationId: args.conversationId,
        role: "assistant",
        content: crisisCardText(CRISIS_CARD),
        modelUsed: "crisis-card",
        createdAt: now + 1,
      });
    }
    await ctx.db.patch(args.conversationId, { updatedAt: crisis ? now + 1 : now });
    return crisis ? { success: true as const, crisis: true } : { success: true as const };
  },
});

const chatProposalValidator = v.union(
  v.object({
    kind: v.literal("task"),
    title: v.string(),
    minutes: v.number(),
    when: v.union(v.literal("today"), v.literal("later")),
  }),
  v.object({ kind: v.literal("note"), title: v.string(), body: v.string() }),
  v.object({
    kind: v.literal("template"),
    name: v.string(),
    body: v.string(),
    period: v.union(v.literal("daily"), v.literal("weekly"), v.literal("none")),
  }),
);

export type StoredProposal = CoachProposal & {
  status: "pending" | "accepted" | "rejected" | "undone";
  /** The row Accept made: a task, a note or a template. */
  createdId?: string;
  undoUntilMs?: number;
  decidedAt?: number;
};

/** The proposal on an assistant message, read back through the same checks the model output passed. */
export function storedProposal(toolCalls: unknown): StoredProposal | null {
  if (!toolCalls || typeof toolCalls !== "object") return null;
  const raw = (toolCalls as { coachProposal?: unknown }).coachProposal;
  const proposal = readProposal(raw);
  if (!proposal || !raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const status = r.status === "accepted" || r.status === "rejected" || r.status === "undone" ? r.status : "pending";
  return {
    ...proposal,
    status,
    ...(typeof r.createdId === "string" ? { createdId: r.createdId } : {}),
    ...(typeof r.undoUntilMs === "number" ? { undoUntilMs: r.undoUntilMs } : {}),
    ...(typeof r.decidedAt === "number" ? { decidedAt: r.decidedAt } : {}),
  };
}

const turnContextValidator = v.object({
  replyTo: v.id("messages"),
  claim: v.string(),
  dial: v.number(),
  history: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() })),
  page: v.union(v.null(), v.object({ title: v.string(), text: v.string() })),
});

/**
 * How long one `coach.reply` holds the pending turn: as long as a Convex action may run (10
 * minutes). `callLLM`'s abort timer stops at the response headers, so a slow body can outlast any
 * shorter lease and let a retry make a second paid call (Codex P1 on #923). A failed reply gives
 * the turn back at once; only a reply killed mid-call keeps it until then.
 */
export const TURN_CLAIM_MS = 10 * 60_000;

/** The claim a `coach.reply` puts on the user message it answers (on that message's `toolCalls`). */
function claimOf(toolCalls: unknown): { until: number; token: string | null } | null {
  if (!toolCalls || typeof toolCalls !== "object") return null;
  const { coachClaimUntil, coachClaim } = toolCalls as { coachClaimUntil?: unknown; coachClaim?: unknown };
  if (typeof coachClaimUntil !== "number") return null;
  return { until: coachClaimUntil, token: typeof coachClaim === "string" ? coachClaim : null };
}

/**
 * Claims the newest user message for one reply and returns what the model sees. Mutations are
 * transactional, so of two overlapping replies (two tabs, a double Try again) only one claims
 * the turn and reaches the model; the other gets "busy" (Codex P1 on #923). Null when nothing
 * waits for a reply: the newest message is already answered, or is crisis text, which only ever
 * gets the fixed card.
 */
export const claimTurn = internalMutation({
  args: { conversationId: v.id("conversations"), noteId: v.optional(v.id("notes")) },
  returns: v.union(v.null(), v.literal("busy"), turnContextValidator),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);
    const newest = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_deletedAt", (q) =>
        q.eq("conversationId", args.conversationId).eq("deletedAt", undefined),
      )
      .order("desc")
      .take(COACH_LIMITS.historyMessages);
    const last = newest[0];
    if (!last || last.role !== "user" || isCrisisText(last.content)) {
      return null;
    }
    const now = Date.now();
    const held = claimOf(last.toolCalls);
    if (held !== null && held.until > now) {
      return "busy" as const;
    }
    // Only the reply holding this token may give the turn back or answer it.
    const claim = crypto.randomUUID();
    await ctx.db.patch(last._id, { toolCalls: { coachClaimUntil: now + TURN_CLAIM_MS, coachClaim: claim } });

    const history = newest
      .filter((m) => m.role === "user" || m.role === "assistant")
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    let page: { title: string; text: string } | null = null;
    if (args.noteId) {
      const note = await ctx.db.get(args.noteId);
      // Only the caller's own live page; anything else is left out, never named.
      if (note && note.userId === user._id && note.deletedAt === undefined) {
        page = {
          title: note.title,
          text: projectPageText(note.body, { searchChars: COACH_LIMITS.pageChars }).searchText,
        };
      }
    }
    const settings = await loadSettings(ctx, user._id);
    return { replyTo: last._id, claim, dial: settings?.dial ?? DEFAULT_DIAL, history, page };
  },
});

/** Gives the turn back after a failed reply, so Try again works at once. Only its own claim. */
export const releaseTurn = internalMutation({
  args: { conversationId: v.id("conversations"), messageId: v.id("messages"), claim: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);
    const message = await ctx.db.get(args.messageId);
    if (message && message.conversationId === args.conversationId && claimOf(message.toolCalls)?.token === args.claim) {
      await ctx.db.patch(message._id, { toolCalls: undefined });
    }
    return null;
  },
});

/**
 * Stores the reply, unless a newer message arrived, another reply landed first, or this reply
 * no longer holds the turn.
 */
export const saveReply = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    replyTo: v.id("messages"),
    claim: v.string(),
    content: v.string(),
    proposal: v.optional(chatProposalValidator),
    modelUsed: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);
    const newest = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_deletedAt", (q) =>
        q.eq("conversationId", args.conversationId).eq("deletedAt", undefined),
      )
      .order("desc")
      .first();
    if (!newest || newest._id !== args.replyTo || claimOf(newest.toolCalls)?.token !== args.claim) {
      return false;
    }
    const now = Math.max(Date.now(), newest.createdAt + 1);
    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      content: args.content,
      modelUsed: args.modelUsed,
      ...(args.proposal ? { toolCalls: { coachProposal: { ...args.proposal, status: "pending" } } } : {}),
      createdAt: now,
    });
    await ctx.db.patch(args.conversationId, { updatedAt: now });
    return true;
  },
});

/** "busy": another reply holds this turn; its answer appears in the thread when it lands. */
export type CoachReplyStatus = "replied" | "unavailable" | "idle" | "busy";

/** The error's class name only: never its message, which can carry provider text. */
function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * One coach turn for the newest user message. `call` is the model seam; tests pass a stand-in.
 * Approval is checked before anything is read or any provider is called.
 */
export async function runCoachReply(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  args: { conversationId: Id<"conversations">; noteId?: Id<"notes"> },
  call: typeof callLLM = callLLM,
): Promise<CoachReplyStatus> {
  await requireApprovedForAi(ctx as ActionCtx);
  const context = await ctx.runMutation(internal.coach.claimTurn, args);
  if (context === null) {
    return "idle";
  }
  if (context === "busy") {
    return "busy";
  }
  const release = () =>
    ctx.runMutation(internal.coach.releaseTurn, {
      conversationId: args.conversationId,
      messageId: context.replyTo,
      claim: context.claim,
    });
  let answer: { reply: string; proposal: CoachProposal | null } | null;
  let model: string;
  try {
    const result = await call({
      tier: "balanced",
      messages: buildCoachMessages(context),
      maxTokens: 900,
      temperature: 0.4,
      responseFormat: "json_object",
    });
    answer = parseCoachReply(result.content);
    model = result.model;
  } catch (error) {
    console.error(`coach.reply: the model could not be reached (${errorKind(error)})`);
    await release();
    return "unavailable";
  }
  if (!answer) {
    console.error("coach.reply: the model gave an empty answer");
    await release();
    return "unavailable";
  }
  await ctx.runMutation(internal.coach.saveReply, {
    conversationId: args.conversationId,
    replyTo: context.replyTo,
    claim: context.claim,
    content: answer.reply,
    ...(answer.proposal ? { proposal: answer.proposal } : {}),
    modelUsed: model,
  });
  return "replied";
}

export const reply = action({
  args: { conversationId: v.id("conversations"), noteId: v.optional(v.id("notes")) },
  returns: v.object({
    status: v.union(v.literal("replied"), v.literal("unavailable"), v.literal("idle"), v.literal("busy")),
  }),
  handler: async (ctx, args) => ({ status: await runCoachReply(ctx, args) }),
});

/** The caller's assistant message with a proposal, in a live conversation they own. */
async function ownedProposal(ctx: MutationCtx, userId: Id<"users">, messageId: Id<"messages">) {
  const message = await ctx.db.get(messageId);
  if (!message || message.deletedAt !== undefined || message.role !== "assistant") {
    throw new Error("Proposal not found");
  }
  const conversation = await ctx.db.get(message.conversationId);
  if (!conversation || conversation.userId !== userId || conversation.deletedAt !== undefined) {
    throw new Error("Proposal not found");
  }
  const proposal = storedProposal(message.toolCalls);
  if (!proposal) {
    throw new Error("Proposal not found");
  }
  return { message, proposal };
}

async function setProposal(ctx: MutationCtx, messageId: Id<"messages">, proposal: StoredProposal) {
  await ctx.db.patch(messageId, { toolCalls: { coachProposal: proposal } });
}

/** A "today" task is due at the end of the caller's local day, which only the client knows. */
const LOCAL_DAY_SLACK_MS = 36 * 60 * 60_000;

/** Accept: the one place a coach proposal changes anything. Returns where the new row lives. */
export const acceptProposal = mutation({
  args: { messageId: v.id("messages"), dueTodayAt: v.optional(v.number()) },
  returns: v.object({
    kind: v.union(v.literal("task"), v.literal("note"), v.literal("template")),
    createdId: v.string(),
    undoUntilMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const { message, proposal } = await ownedProposal(ctx, user._id, args.messageId);
    if (proposal.status !== "pending") {
      throw new Error("This proposal was already decided.");
    }
    const now = Date.now();
    let createdId: string;
    if (proposal.kind === "task") {
      const due =
        proposal.when === "today" &&
        args.dueTodayAt !== undefined &&
        Number.isFinite(args.dueTodayAt) &&
        Math.abs(args.dueTodayAt - now) <= LOCAL_DAY_SLACK_MS
          ? args.dueTodayAt
          : undefined;
      createdId = await createTaskForUser(ctx, user._id, {
        title: proposal.title,
        timeEstimate: proposal.minutes * 60_000,
        ...(due !== undefined ? { dueAt: due } : {}),
      });
    } else if (proposal.kind === "note") {
      createdId = await ctx.db.insert("notes", {
        userId: user._id,
        title: proposal.title,
        body: proposal.body,
        pinned: false,
        periodType: "none",
        pageType: "plain",
        aiGenerated: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      createdId = await ctx.db.insert("templates", {
        userId: user._id,
        name: proposal.name,
        periodType: proposal.period,
        body: proposal.body,
        createdAt: now,
        updatedAt: now,
      });
    }
    const undoUntilMs = undoUntil(now);
    await setProposal(ctx, message._id, { ...proposal, status: "accepted", createdId, undoUntilMs, decidedAt: now });
    return { kind: proposal.kind, createdId, undoUntilMs };
  },
});

/** Reject: nothing changes; the card says so. */
export const rejectProposal = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const { message, proposal } = await ownedProposal(ctx, user._id, args.messageId);
    if (proposal.status !== "pending") {
      throw new Error("This proposal was already decided.");
    }
    await setProposal(ctx, message._id, { ...proposal, status: "rejected", decidedAt: Date.now() });
    return null;
  },
});

/** Undo, within 5 minutes of Accept: the row Accept made is soft-deleted, as any delete is. */
export const undoProposal = mutation({
  args: { messageId: v.id("messages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const { message, proposal } = await ownedProposal(ctx, user._id, args.messageId);
    const now = Date.now();
    if (proposal.status !== "accepted" || proposal.createdId === undefined || proposal.undoUntilMs === undefined) {
      throw new Error("There is nothing to undo.");
    }
    if (now > proposal.undoUntilMs) {
      throw new Error("The 5 minutes to undo this have passed.");
    }
    const table = proposal.kind === "task" ? "tasks" : proposal.kind === "note" ? "notes" : "templates";
    const id = ctx.db.normalizeId(table, proposal.createdId);
    const row = id ? await ctx.db.get(id) : null;
    if (id && row && row.userId === user._id && row.deletedAt === undefined) {
      await ctx.db.patch(id, { deletedAt: now, updatedAt: now });
    }
    await setProposal(ctx, message._id, { ...proposal, status: "undone", decidedAt: now });
    return null;
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
