import { v } from "convex/values";
import { BLOCK_CODEC_LIMITS, parseTempoBlocks, projectPageText, type TempoBlock } from "@tempo/utils";
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
  type CoachDecisionStep,
  type CoachProposal,
  type CoachTaskContext,
  buildCoachMessages,
  cardOutcome,
  parseCoachReply,
  readProposal,
} from "./lib/coachPrompt";
import { requireUser } from "./lib/requireUser";
import { isValidLocalDate } from "./lib/pageLedger";
import { undoUntil } from "./lib/softDelete";
import { requireLegacyWritableConversation } from "./messages";
import { updateNoteForUser } from "./notes";
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
 * The coach only proposes. A proposal (task, note, template or decision) rides on its reply's
 * `toolCalls.coachProposal`; nothing changes until `acceptProposal`, and every accepted change can
 * be undone for 5 minutes with `undoProposal` (HARD_RULES §1, §6.2). A decision ("what order should
 * I do these in?") is saved as task blocks at the end of today's daily page.
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
  v.object({
    kind: v.literal("decision"),
    title: v.optional(v.string()),
    steps: v.array(v.object({ title: v.string(), minutes: v.number(), reason: v.optional(v.string()) })),
  }),
);

export type StoredProposal = CoachProposal & {
  status: "pending" | "accepted" | "rejected" | "undone";
  /** The row Accept made: a task, a note or a template; for a decision, the daily page it wrote to. */
  createdId?: string;
  undoUntilMs?: number;
  decidedAt?: number;
  /** A saved decision: the exact text added to the page, and its task blocks' ids (for Undo). */
  appended?: string;
  blockIds?: string[];
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
    ...(typeof r.appended === "string" ? { appended: r.appended } : {}),
    ...(Array.isArray(r.blockIds) && r.blockIds.every((id) => typeof id === "string")
      ? { blockIds: r.blockIds as string[] }
      : {}),
  };
}

const turnContextValidator = v.object({
  replyTo: v.id("messages"),
  claim: v.string(),
  dial: v.number(),
  history: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() })),
  page: v.union(v.null(), v.object({ title: v.string(), text: v.string() })),
  tasks: v.array(v.object({ title: v.string(), minutes: v.union(v.null(), v.number()) })),
});

/** The caller's local day, from the client. Anything that is not about one day is ignored. */
const dayBoundsArgs = { dayStartMs: v.optional(v.number()), dayEndMs: v.optional(v.number()) };
const MAX_DAY_MS = 26 * 60 * 60_000;

function dayBounds(args: { dayStartMs?: number; dayEndMs?: number }): { start: number; end: number } | null {
  const { dayStartMs: start, dayEndMs: end } = args;
  if (start === undefined || end === undefined || !Number.isFinite(start) || !Number.isFinite(end)) return null;
  return end > start && end - start <= MAX_DAY_MS ? { start, end } : null;
}

/** Most task rows one turn reads while looking for the day's open tasks (bounds the read). */
const MAX_DAY_TASKS_SCANNED = 500;

/**
 * The caller's open tasks due in their day, soonest first: what "these" means in "what order
 * should I do these in?". Done and deleted rows are skipped while reading, so they never crowd
 * open tasks out of the cap (Codex P2 on #940).
 */
async function openTasksForDay(ctx: Db, userId: UserId, day: { start: number; end: number }): Promise<CoachTaskContext[]> {
  const open: CoachTaskContext[] = [];
  let scanned = 0;
  for await (const t of ctx.db
    .query("tasks")
    .withIndex("by_userId_dueAt", (q) => q.eq("userId", userId).gte("dueAt", day.start).lt("dueAt", day.end))) {
    scanned += 1;
    if (t.deletedAt === undefined && (t.status === "todo" || t.status === "in_progress")) {
      open.push({
        title: t.title,
        minutes: t.timeEstimate !== undefined && t.timeEstimate > 0 ? Math.round(t.timeEstimate / 60_000) : null,
      });
      if (open.length === COACH_LIMITS.contextTasks) break;
    }
    if (scanned === MAX_DAY_TASKS_SCANNED) break;
  }
  return open;
}

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
  args: { conversationId: v.id("conversations"), noteId: v.optional(v.id("notes")), ...dayBoundsArgs },
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

    // An earlier reply's card carries what happened to it, so the coach never takes an undone or
    // declined change for one that happened (alpha run, L4: "It's already on your list").
    const history = newest
      .filter((m) => m.role === "user" || m.role === "assistant")
      .reverse()
      .map((m) => {
        const card = m.role === "assistant" ? storedProposal(m.toolCalls) : null;
        return {
          role: m.role as "user" | "assistant",
          content: card ? `${m.content}\n${cardOutcome(card, card.status)}` : m.content,
        };
      });

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
    const day = dayBounds(args);
    const tasks = day ? await openTasksForDay(ctx, user._id, day) : [];
    const settings = await loadSettings(ctx, user._id);
    return { replyTo: last._id, claim, dial: settings?.dial ?? DEFAULT_DIAL, history, page, tasks };
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

/**
 * "busy": another reply holds this turn; its answer appears in the thread when it lands.
 * "superseded": a newer message arrived while the model ran, so this reply was not saved.
 */
export type CoachReplyStatus = "replied" | "unavailable" | "idle" | "busy" | "superseded";

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
  args: {
    conversationId: Id<"conversations">;
    noteId?: Id<"notes">;
    dayStartMs?: number;
    dayEndMs?: number;
    todayDate?: string;
  },
  call: typeof callLLM = callLLM,
): Promise<CoachReplyStatus> {
  await requireApprovedForAi(ctx as ActionCtx);
  const { todayDate, ...turn } = args;
  // The person's date tells the coach whether "Friday" is today. Only a date that is today
  // somewhere on Earth is used; anything else is left out rather than trusted.
  const today = todayDate !== undefined && isTodaySomewhere(todayDate, Date.now()) ? todayDate : undefined;
  const context = await ctx.runMutation(internal.coach.claimTurn, turn);
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
      messages: buildCoachMessages({ ...context, ...(today ? { today } : {}) }),
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
  let saved: boolean;
  try {
    saved = await ctx.runMutation(internal.coach.saveReply, {
      conversationId: args.conversationId,
      replyTo: context.replyTo,
      claim: context.claim,
      content: answer.reply,
      ...(answer.proposal ? { proposal: answer.proposal } : {}),
      modelUsed: model,
    });
  } catch (error) {
    // A failed save must not hold the turn for the whole lease (Codex P2 on #923).
    console.error(`coach.reply: the reply could not be saved (${errorKind(error)})`);
    await release();
    return "unavailable";
  }
  return saved ? "replied" : "superseded";
}

export const reply = action({
  args: {
    conversationId: v.id("conversations"),
    noteId: v.optional(v.id("notes")),
    ...dayBoundsArgs,
    todayDate: v.optional(v.string()),
  },
  returns: v.object({
    status: v.union(
      v.literal("replied"),
      v.literal("unavailable"),
      v.literal("idle"),
      v.literal("busy"),
      v.literal("superseded"),
    ),
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

/** The person's changes to a proposal before Accept (HARD_RULES §1: confirm / edit / reject). */
const proposalEditValidator = v.object({
  title: v.optional(v.string()),
  minutes: v.optional(v.number()),
  when: v.optional(v.union(v.literal("today"), v.literal("later"))),
  name: v.optional(v.string()),
  body: v.optional(v.string()),
  period: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("none"))),
});

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A block id the codec accepts: `blk_` + a 26-character ULID (time first, then randomness). */
function newBlockId(now: number): string {
  let time = "";
  let t = Math.max(0, Math.floor(now));
  for (let i = 0; i < 10; i += 1) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i += 1) rand += CROCKFORD[Math.floor(Math.random() * 32) % 32];
  return `blk_${time}${rand}`;
}

/** A decision step as the task block the decision card draws: the first is "now", the rest "later". */
function decisionBlock(step: CoachDecisionStep, index: number, now: number): TempoBlock {
  return {
    id: newBlockId(now),
    v: 1,
    type: "task",
    data: {
      title: step.title,
      durationMin: step.minutes,
      status: index === 0 ? "now" : "later",
      order: index,
      inelastic: false,
      ...(step.reason ? { reason: step.reason } : {}),
    },
  };
}

/** The heading a decision's title becomes on the page. */
function decisionHeading(title: string): string {
  return `### ${title}\n\n`;
}

/** The decision as page text: its title as a heading (when it has one), then one task fence per step. */
function decisionText(proposal: Extract<CoachProposal, { kind: "decision" }>, now: number) {
  const blocks = proposal.steps.map((step, index) => decisionBlock(step, index, now));
  const heading = proposal.title ? decisionHeading(proposal.title) : "";
  const fences = blocks.map((block) => `\`\`\`json tempo\n${JSON.stringify(block)}\n\`\`\`\n`).join("");
  return { text: heading + fences, blockIds: blocks.map((block) => block.id) };
}

/**
 * True when `date` is today in some time zone (UTC-12 to UTC+14): "Save to today" never writes to
 * another day's page (Codex P2 on #940). Only the client knows its own zone.
 */
function isTodaySomewhere(date: string, now: number): boolean {
  if (!isValidLocalDate(date)) return false;
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  return now >= midnightUtc - 14 * 60 * 60_000 && now < midnightUtc + 36 * 60 * 60_000;
}

/** The caller's live daily page for `date`. */
async function dailyPage(ctx: MutationCtx, userId: UserId, date: string) {
  return ctx.db
    .query("notes")
    .withIndex("by_userId_deletedAt_pageType_date", (q) =>
      q.eq("userId", userId).eq("deletedAt", undefined).eq("pageType", "daily").eq("date", date),
    )
    .first();
}

/**
 * Saves a decision at the end of today's daily page. The page must exist (Today makes it on first
 * open) and must have room for the new blocks under the codec's limit, so no step is ever saved as
 * a broken block.
 */
async function saveDecision(
  ctx: MutationCtx,
  userId: UserId,
  proposal: Extract<CoachProposal, { kind: "decision" }>,
  todayDate: string | undefined,
  now: number,
) {
  if (todayDate === undefined || !isTodaySomewhere(todayDate, now)) {
    throw new Error("Open Today to save this.");
  }
  const page = await dailyPage(ctx, userId, todayDate);
  if (!page) {
    throw new Error("Today's page isn't ready yet. Try again in a moment.");
  }
  const blocks = parseTempoBlocks(page.body).filter((segment) => segment.kind !== "markdown").length;
  if (blocks + proposal.steps.length > BLOCK_CODEC_LIMITS.maxBlocks) {
    throw new Error("Today's page is full. Make some room first.");
  }
  const { text, blockIds } = decisionText(proposal, now);
  const separator = page.body === "" || page.body.endsWith("\n\n") ? "" : page.body.endsWith("\n") ? "\n" : "\n\n";
  const appended = separator + text;
  await updateNoteForUser(ctx, userId, { noteId: page._id, body: page.body + appended });
  return { createdId: page._id as string, appended, blockIds };
}

/**
 * Takes a saved decision back off the page, keeping everything the person wrote since. The exact
 * text that was added goes, wherever it now sits. If the person changed it (ticked a step, say),
 * the decision's own task blocks go by id, and so does its generated heading, but only where it
 * still sits right above the decision's first block: an edited heading is theirs, and another
 * heading with the same title is never touched (Codex P2s on #940).
 */
function withoutDecision(
  body: string,
  appended: string | undefined,
  blockIds: readonly string[],
  title: string | undefined,
): string {
  if (appended) {
    const at = body.lastIndexOf(appended);
    if (at >= 0) return body.slice(0, at) + body.slice(at + appended.length);
  }
  const ids = new Set(blockIds);
  const segments = parseTempoBlocks(body);
  const ours = (segment: (typeof segments)[number]) => segment.kind === "valid" && ids.has(segment.block.id);
  const first = segments.findIndex(ours);
  const heading = title ? decisionHeading(title) : "";
  return segments
    .map((segment, index) => {
      if (ours(segment)) return "";
      if (heading && index === first - 1 && segment.kind === "markdown" && segment.source.endsWith(heading)) {
        const before = segment.source.slice(0, -heading.length);
        if (before === "" || before.endsWith("\n")) return before;
      }
      return segment.source;
    })
    .join("");
}

/**
 * Accept: the one place a coach proposal changes anything. `edit` carries the person's changes;
 * they pass the same checks the model's proposal did, and the kind never changes. A decision needs
 * `todayDate`, the caller's local date, and is saved to that day's page. Returns where the new row
 * lives (for a decision, the page).
 */
export const acceptProposal = mutation({
  args: {
    messageId: v.id("messages"),
    dueTodayAt: v.optional(v.number()),
    todayDate: v.optional(v.string()),
    edit: v.optional(proposalEditValidator),
  },
  returns: v.object({
    kind: v.union(v.literal("task"), v.literal("note"), v.literal("template"), v.literal("decision")),
    createdId: v.string(),
    undoUntilMs: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const { message, proposal: stored } = await ownedProposal(ctx, user._id, args.messageId);
    if (stored.status !== "pending") {
      throw new Error("This proposal was already decided.");
    }
    let proposal: StoredProposal = stored;
    if (args.edit) {
      const edited = readProposal({ ...stored, ...args.edit, kind: stored.kind });
      if (!edited) {
        throw new Error("Give it a name and some words first.");
      }
      proposal = { ...edited, status: "pending" };
    }
    const now = Date.now();
    let createdId: string;
    let saved: { appended: string; blockIds: string[] } | null = null;
    if (proposal.kind === "decision") {
      const decision = await saveDecision(ctx, user._id, proposal, args.todayDate, now);
      createdId = decision.createdId;
      saved = { appended: decision.appended, blockIds: decision.blockIds };
    } else if (proposal.kind === "task") {
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
    await setProposal(ctx, message._id, {
      ...proposal,
      status: "accepted",
      createdId,
      undoUntilMs,
      decidedAt: now,
      ...(saved ?? {}),
    });
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

/**
 * Undo, within 5 minutes of Accept: the row Accept made is soft-deleted, as any delete is. A saved
 * decision is taken back off its page instead (the page itself stays).
 */
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
    if (proposal.kind === "decision") {
      const pageId = ctx.db.normalizeId("notes", proposal.createdId);
      const page = pageId ? await ctx.db.get(pageId) : null;
      if (pageId && page && page.userId === user._id && page.deletedAt === undefined) {
        const body = withoutDecision(page.body, proposal.appended, proposal.blockIds ?? [], proposal.title);
        if (body !== page.body) {
          await updateNoteForUser(ctx, user._id, { noteId: pageId, body });
        }
      }
      await setProposal(ctx, message._id, { ...proposal, status: "undone", decidedAt: now });
      return null;
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
