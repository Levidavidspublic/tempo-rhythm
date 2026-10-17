import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { AiAuthError, AiRateLimitedError } from "./lib/ai_errors";
import { callLLM } from "./lib/ai_router";
import { requireApprovedForAi } from "./lib/aiGate";
import { isApproved, requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import {
  VOICE_LIMITS,
  dailyMinutesFor,
  laneFor,
  leaseExpired,
  leaseMs,
  localDateKey,
  utcDateKey,
} from "./lib/voicePolicy";
import { createNoteForUser } from "./notes";
import { createTaskForUser } from "./tasks";

/**
 * Record a meeting or lecture (kitchen T8, S7 RecordSession; PRD F-32, F-90).
 *
 * - Consent happens in the browser before the microphone opens. Audio goes from the browser
 *   straight to Deepgram over a socket opened with a 30-second token that `grant` mints, exactly as
 *   voice mode does (convex/voice.ts). Audio is never stored anywhere.
 * - Each recording is a content-free lease (`recordingSessions`) the client renews. Its minutes
 *   count against the same daily budget as voice mode: both tables are summed (EXTRAPOLATED).
 * - English only, through the Flux lane in `lib/voicePolicy.ts`. Hebrew is off there, so a Hebrew
 *   start returns `{ ok: false, reason: "language" }` and the screen offers typing instead.
 * - `proposeFromTranscript` asks the runtime model for a title, a summary and up to 10 tasks. It
 *   only proposes: nothing is saved until the person accepts on the review screen and presses
 *   Save, which calls `saveSession`. That can be undone for 5 minutes (HARD_RULES §1, §6.2), and
 *   the Undo removes only what that save made, as long as the person hasn't built on it since.
 * - The transcript is never stored by any function here, except inside the page body the person
 *   explicitly saves. No audio, transcript, token or provider body is ever logged.
 *
 * Keys are names only: DEEPGRAM_API_KEY, DEEPINFRA_API_KEY.
 */

const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";

type Db = QueryCtx | MutationCtx;
type Lease = Doc<"recordingSessions">;
type EndReason = NonNullable<Lease["endReason"]>;

const langValidator = v.union(v.literal("en"), v.literal("he"));

/** Lease rows read for the global ceiling, per table. More fails closed, like voice. */
const GLOBAL_ROWS = VOICE_LIMITS.globalRowsPerDay;
const GLOBAL_CAP_MS = VOICE_LIMITS.dailyMinutesGlobal * 60_000;

async function preferencesOf(ctx: Db, userId: Id<"users">) {
  return ctx.db
    .query("userPreferences")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .first();
}

/** The person's live-minute cap today (ms): the same rule as voice mode (paid accounts only). */
function dailyCapMs(user: Doc<"users">): number {
  if (user.userType !== "paid") return 0;
  return dailyMinutesFor(user.entitlementTier) * 60_000;
}

/**
 * Live minutes (ms) and session count on one local day, voice and recordings together, `except`
 * one recording lease. Tombstoned rows count too, as in voice.
 */
async function usedToday(
  ctx: Db,
  userId: Id<"users">,
  dateKey: string,
  now: number,
  except?: Id<"recordingSessions">,
): Promise<{ ms: number; sessions: number }> {
  const voice = await ctx.db
    .query("voiceSessions")
    .withIndex("by_userId_dateKey", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
    .collect();
  const recordings = await ctx.db
    .query("recordingSessions")
    .withIndex("by_userId_dateKey", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
    .collect();
  const mine = recordings.filter((r) => r._id !== except);
  const ms = [...voice, ...mine].reduce((sum, r) => sum + leaseMs(r, now), 0);
  return { ms, sessions: voice.length + recordings.length };
}

/** Everyone's live minutes (ms) on one UTC day, voice and recordings together. Fails closed. */
async function usedGlobalMs(ctx: Db, utcKey: string, now: number, except?: Id<"recordingSessions">) {
  const voice = await ctx.db
    .query("voiceSessions")
    .withIndex("by_utcDateKey", (q) => q.eq("utcDateKey", utcKey))
    .take(GLOBAL_ROWS + 1);
  const recordings = await ctx.db
    .query("recordingSessions")
    .withIndex("by_utcDateKey", (q) => q.eq("utcDateKey", utcKey))
    .take(GLOBAL_ROWS + 1);
  if (voice.length > GLOBAL_ROWS || recordings.length > GLOBAL_ROWS) return Number.POSITIVE_INFINITY;
  return [...voice, ...recordings.filter((r) => r._id !== except)].reduce((sum, r) => sum + leaseMs(r, now), 0);
}

/** Closes a lease; a stale one counts only to its last renewal plus one interval (voice A-5). */
async function endLease(ctx: MutationCtx, lease: Lease, reason: EndReason, now: number) {
  if (lease.status === "ended") return;
  const stale = reason === "expired" || leaseExpired(lease, now);
  const endedAt = Math.min(
    stale ? lease.lastRenewalAt + VOICE_LIMITS.renewEveryMs : now,
    now,
    lease.startedAt + VOICE_LIMITS.maxSessionMs,
  );
  await ctx.db.patch(lease._id, {
    status: "ended",
    endedAt,
    durationMs: Math.max(0, endedAt - lease.startedAt),
    endReason: reason,
    updatedAt: now,
  });
}

/** The caller's own lease, or null. Another person's lease looks exactly like a missing one. */
async function ownedLease(ctx: Db, userId: Id<"users">, sessionId: Id<"recordingSessions">) {
  const lease = await ctx.db.get(sessionId);
  if (!lease || lease.userId !== userId || lease.deletedAt !== undefined) return null;
  return lease;
}

function keysPresent() {
  return {
    live: Boolean(process.env.DEEPGRAM_API_KEY),
    proposals: Boolean(process.env.DEEPINFRA_API_KEY),
  };
}

const availabilityReason = v.union(
  v.null(),
  v.literal("pending"),
  v.literal("no_key"),
  v.literal("language"),
  v.literal("budget"),
  v.literal("resting"),
);

/**
 * Whether live words can start for `lang`, how many minutes are left today (voice and recordings
 * together), and whether the runtime model can propose tasks. Key presence only, never values.
 */
export const availability = query({
  args: { lang: langValidator },
  returns: v.object({
    live: v.boolean(),
    reason: availabilityReason,
    minutesLeft: v.number(),
    proposals: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const keys = keysPresent();
    if (!isApproved(user)) return { live: false, reason: "pending" as const, minutesLeft: 0, proposals: false };
    if (!keys.live) return { live: false, reason: "no_key" as const, minutesLeft: 0, proposals: keys.proposals };
    if (!laneFor(args.lang)) {
      return { live: false, reason: "language" as const, minutesLeft: 0, proposals: keys.proposals };
    }
    const prefs = await preferencesOf(ctx, user._id);
    const now = Date.now();
    const today = await usedToday(ctx, user._id, localDateKey(now, prefs?.timeZone), now);
    const left = dailyCapMs(user) - today.ms;
    const minutesLeft = Math.max(0, Math.floor(left / 60_000));
    if (left < VOICE_LIMITS.minStartMs || today.sessions >= VOICE_LIMITS.sessionsPerUserPerDay) {
      return { live: false, reason: "budget" as const, minutesLeft, proposals: keys.proposals };
    }
    if (GLOBAL_CAP_MS - (await usedGlobalMs(ctx, utcDateKey(now), now)) < VOICE_LIMITS.minStartMs) {
      return { live: false, reason: "resting" as const, minutesLeft, proposals: keys.proposals };
    }
    return { live: true, reason: null, minutesLeft, proposals: keys.proposals };
  },
});

/**
 * Starts a recording lease. English only (the Flux lane); one recording per person at a time, so
 * a new start ends the older one. Refusals are typed results, never errors, so the screen can say
 * why in words and offer typing.
 */
export const start = mutation({
  args: { lang: langValidator },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      sessionId: v.id("recordingSessions"),
      renewEveryMs: v.number(),
      maxSessionMs: v.number(),
      minutesLeft: v.number(),
    }),
    v.object({
      ok: v.literal(false),
      reason: v.union(v.literal("language"), v.literal("no_key"), v.literal("budget"), v.literal("resting")),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    if (!laneFor(args.lang)) return { ok: false as const, reason: "language" as const };
    if (!process.env.DEEPGRAM_API_KEY) return { ok: false as const, reason: "no_key" as const };

    const now = Date.now();
    const active = await ctx.db
      .query("recordingSessions")
      .withIndex("by_userId_status", (q) => q.eq("userId", user._id).eq("status", "active"))
      .collect();
    for (const lease of active) {
      await endLease(ctx, lease, leaseExpired(lease, now) ? "expired" : "replaced", now);
    }

    const prefs = await preferencesOf(ctx, user._id);
    const dateKey = localDateKey(now, prefs?.timeZone);
    const utcKey = utcDateKey(now);
    const today = await usedToday(ctx, user._id, dateKey, now);
    const left = dailyCapMs(user) - today.ms;
    if (left < VOICE_LIMITS.minStartMs || today.sessions >= VOICE_LIMITS.sessionsPerUserPerDay) {
      return { ok: false as const, reason: "budget" as const };
    }
    if (GLOBAL_CAP_MS - (await usedGlobalMs(ctx, utcKey, now)) < VOICE_LIMITS.minStartMs) {
      return { ok: false as const, reason: "resting" as const };
    }
    const sessionId = await ctx.db.insert("recordingSessions", {
      userId: user._id,
      status: "active",
      lang: args.lang,
      startedAt: now,
      lastRenewalAt: now,
      dateKey,
      utcDateKey: utcKey,
      grants: 0,
      createdAt: now,
      updatedAt: now,
    });
    return {
      ok: true as const,
      sessionId,
      renewEveryMs: VOICE_LIMITS.renewEveryMs,
      maxSessionMs: VOICE_LIMITS.maxSessionMs,
      minutesLeft: Math.floor(left / 60_000),
    };
  },
});

/** The heartbeat. Anything but "ok" means the client stops live words (the notes stay). */
export const renew = mutation({
  args: { sessionId: v.id("recordingSessions") },
  returns: v.object({
    status: v.union(v.literal("ok"), v.literal("revoked"), v.literal("exhausted"), v.literal("expired")),
    minutesLeft: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    const now = Date.now();
    if (!lease || lease.status !== "active") return { status: "expired" as const, minutesLeft: 0 };
    if (!isApproved(user)) {
      await endLease(ctx, lease, "revoked", now);
      return { status: "revoked" as const, minutesLeft: 0 };
    }
    if (leaseExpired(lease, now)) {
      await endLease(ctx, lease, "expired", now);
      return { status: "expired" as const, minutesLeft: 0 };
    }
    const spent = (await usedToday(ctx, user._id, lease.dateKey, now, lease._id)).ms + (now - lease.startedAt);
    const globalSpent = (await usedGlobalMs(ctx, lease.utcDateKey, now, lease._id)) + (now - lease.startedAt);
    const cap = dailyCapMs(user);
    if (spent >= cap || globalSpent >= GLOBAL_CAP_MS) {
      await endLease(ctx, lease, "exhausted", now);
      return { status: "exhausted" as const, minutesLeft: 0 };
    }
    await ctx.db.patch(lease._id, { lastRenewalAt: now, updatedAt: now });
    return { status: "ok" as const, minutesLeft: Math.floor((cap - spent) / 60_000) };
  },
});

/** Stop: ends the lease. Idempotent; someone else's lease is left alone. */
export const stop = mutation({
  args: { sessionId: v.id("recordingSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    if (lease) await endLease(ctx, lease, "stopped", Date.now());
    return null;
  },
});

/** Admits one speech token for a live lease (a few per lease, for reconnects). */
export const admitGrant = internalMutation({
  args: { sessionId: v.id("recordingSessions") },
  returns: v.union(v.object({ ok: v.literal(true), url: v.string() }), v.object({ ok: v.literal(false) })),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const now = Date.now();
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    if (!lease || lease.status !== "active") return { ok: false as const };
    if (leaseExpired(lease, now)) {
      await endLease(ctx, lease, "expired", now);
      return { ok: false as const };
    }
    const spent = (await usedToday(ctx, user._id, lease.dateKey, now, lease._id)).ms + leaseMs(lease, now);
    if (spent >= dailyCapMs(user)) return { ok: false as const };
    if (lease.grants >= VOICE_LIMITS.grantsPerLease) return { ok: false as const };
    const lane = laneFor(lease.lang);
    if (!lane) return { ok: false as const };
    await ctx.db.patch(lease._id, { grants: lease.grants + 1, updatedAt: now });
    return { ok: true as const, url: lane.url };
  },
});

/** Gives back a grant whose token couldn't be minted. */
export const releaseGrant = internalMutation({
  args: { sessionId: v.id("recordingSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    if (lease && lease.status === "active" && lease.grants > 0) {
      await ctx.db.patch(lease._id, { grants: lease.grants - 1, updatedAt: Date.now() });
    }
    return null;
  },
});

export type GrantResult =
  | { ok: true; token: string; url: string }
  | { ok: false; reason: "no_key" | "ended" | "connect" };

/**
 * A 30-second Deepgram token for this lease's socket, plus the socket URL the server chose. Minted
 * exactly as `voice.grant` does. The key never leaves the server; the token is never stored or
 * logged. A missing key is a typed `no_key`, never an error.
 */
export const grant = action({
  args: { sessionId: v.id("recordingSessions") },
  returns: v.union(
    v.object({ ok: v.literal(true), token: v.string(), url: v.string() }),
    v.object({ ok: v.literal(false), reason: v.union(v.literal("no_key"), v.literal("ended"), v.literal("connect")) }),
  ),
  handler: async (ctx, args): Promise<GrantResult> => {
    await requireApprovedForAi(ctx);
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) return { ok: false, reason: "no_key" };
    const admitted: { ok: true; url: string } | { ok: false } = await ctx.runMutation(
      internal.recordings.admitGrant,
      args,
    );
    if (!admitted.ok) return { ok: false, reason: "ended" };
    const token = await mintDeepgramToken(key);
    if (token === null) {
      await ctx.runMutation(internal.recordings.releaseGrant, args).catch(() => {});
      return { ok: false, reason: "connect" };
    }
    return { ok: true, token, url: admitted.url };
  },
});

/** One short-lived Deepgram token, or null. Logs say nothing of the provider's body. */
async function mintDeepgramToken(key: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(DEEPGRAM_GRANT_URL, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: VOICE_LIMITS.tokenTtlSeconds }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error(`recordings.grant: Deepgram could not be reached (${error instanceof Error ? error.name : typeof error})`);
    return null;
  }
  if (!response.ok) {
    console.error(`recordings.grant: Deepgram returned HTTP ${response.status}`);
    return null;
  }
  const body: unknown = await response.json().catch(() => null);
  const token = body && typeof body === "object" ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== "string" || token.length < 16 || token.length > 8192) {
    console.error("recordings.grant: Deepgram returned no usable token");
    return null;
  }
  return token;
}

// ---------------------------------------------------------------------------------------------
// Proposals from the transcript (never saves)
// ---------------------------------------------------------------------------------------------

/** The transcript the model sees, at most. */
export const PROPOSE_MAX_CHARS = 20_000;
export const PROPOSE_MAX_TASKS = 10;
const TITLE_MAX = 200;
const TASK_TITLE_MAX = 300;
const SUMMARY_MAX = 1_200;
const MAX_PINS = 200;

export type ProposedTask = { title: string; minutes?: number };
export type ProposeResult =
  | { status: "ready"; title: string; summary: string; tasks: ProposedTask[] }
  | { status: "unavailable"; reason: "no_key" | "too_short" | "busy" | "failed" };

const pinValidator = v.object({ atMs: v.number(), note: v.optional(v.string()) });

function proposeMessages(transcript: string, pins: { atMs: number; note?: string }[], lang: "en" | "he") {
  const pinLines = pins
    .filter((pin) => pin.note && pin.note.trim().length > 0)
    .slice(0, MAX_PINS)
    .map((pin) => `- ${pin.note?.trim().slice(0, 300)}`)
    .join("\n");
  return [
    {
      role: "system" as const,
      content: [
        "You read the notes of a meeting or lecture and propose what to keep.",
        'Reply with one JSON object and nothing else: {"title": string, "summary": string, "tasks": [{"title": string, "minutes"?: number}]}.',
        `The title is at most 80 characters. The summary is 1 to 4 plain sentences. At most ${PROPOSE_MAX_TASKS} tasks, only ones someone said they or the listener will do.`,
        "Each task title starts with a verb and is under 120 characters. minutes is a whole number from 5 to 240, only when it is clear.",
        `Write in ${lang === "he" ? "Hebrew, in a neutral plural" : "English"}. No emoji. Use only what is in the notes.`,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: `${pinLines ? `Pinned moments:\n${pinLines}\n\n` : ""}Notes:\n${transcript.slice(0, PROPOSE_MAX_CHARS)}`,
    },
  ];
}

function parseJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try {
    return JSON.parse(fenced ? (fenced[1] ?? "") : trimmed);
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  return text.slice(0, max);
}

/** Validates the model's reply into a proposal, or null. */
export function validateProposal(raw: unknown): Omit<Extract<ProposeResult, { status: "ready" }>, "status"> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const title = cleanText(obj.title, TITLE_MAX);
  const summary = cleanText(obj.summary, SUMMARY_MAX) ?? "";
  if (!title || !Array.isArray(obj.tasks)) return null;
  const tasks: ProposedTask[] = [];
  const seen = new Set<string>();
  for (const item of obj.tasks) {
    if (tasks.length >= PROPOSE_MAX_TASKS) break;
    if (!item || typeof item !== "object") continue;
    const t = item as Record<string, unknown>;
    const taskTitle = cleanText(t.title, TASK_TITLE_MAX);
    if (!taskTitle || seen.has(taskTitle.toLowerCase())) continue;
    seen.add(taskTitle.toLowerCase());
    const minutes =
      typeof t.minutes === "number" && Number.isInteger(t.minutes) && t.minutes >= 1 && t.minutes <= 600 ? t.minutes : undefined;
    tasks.push(minutes === undefined ? { title: taskTitle } : { title: taskTitle, minutes });
  }
  return { title, summary, tasks };
}

function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * One proposal. `call` is the model seam and `hasKey` the key check; tests pass stand-ins.
 * Approval is checked before any provider is called.
 */
// RAM-ONLY: the transcript is read here, sent to the runtime model and dropped when this returns.
// Nothing from it is written to Convex; only what the person accepts and saves is kept.
export async function runPropose(
  ctx: Pick<ActionCtx, "runQuery">,
  args: { transcript: string; pins: { atMs: number; note?: string }[]; lang: "en" | "he" },
  seams: { call?: typeof callLLM; hasKey?: () => boolean } = {},
): Promise<ProposeResult> {
  await requireApprovedForAi(ctx as ActionCtx);
  const hasKey = seams.hasKey ?? (() => Boolean(process.env.DEEPINFRA_API_KEY));
  if (!hasKey()) return { status: "unavailable", reason: "no_key" };
  if (args.transcript.trim().length < 40) return { status: "unavailable", reason: "too_short" };
  let content: string;
  try {
    const result = await (seams.call ?? callLLM)({
      tier: "balanced",
      messages: proposeMessages(args.transcript, args.pins, args.lang),
      maxTokens: 1500,
      temperature: 0.2,
      responseFormat: "json_object",
    });
    content = result.content;
  } catch (error) {
    if (error instanceof AiAuthError) return { status: "unavailable", reason: "no_key" };
    if (error instanceof AiRateLimitedError) return { status: "unavailable", reason: "busy" };
    console.error(`recordings.proposeFromTranscript: the model could not be reached (${errorKind(error)})`);
    return { status: "unavailable", reason: "failed" };
  }
  const proposal = validateProposal(parseJson(content));
  if (!proposal) return { status: "unavailable", reason: "failed" };
  return { status: "ready", ...proposal };
}

/** A proposed title, summary and tasks from the transcript. Never saves. */
export const proposeFromTranscript = action({
  args: { transcript: v.string(), pins: v.array(pinValidator), lang: langValidator },
  handler: async (ctx, args): Promise<ProposeResult> => runPropose(ctx, args),
});

// ---------------------------------------------------------------------------------------------
// Save (after Accept) and Undo
// ---------------------------------------------------------------------------------------------

const BODY_MAX = 200_000;
const SAVE_MAX_TASKS = 20;

const SAVE_ERRORS = {
  title: "Give the page a title of up to 200 characters.",
  body: "These notes are too long for one page. Try saving a shorter part.",
  tasks: "That is more tasks than one save can hold. Keep up to 20.",
  task: "Each task needs a title of up to 300 characters.",
  minutes: "Minutes are a whole number from 1 to 600.",
  undoGone: "The 5 minutes to undo this have passed.",
  undoMissing: "This page is no longer here to undo.",
} as const;

/**
 * A write to the page this soon after the save is part of making it, not an edit. Later than this,
 * Undo keeps the page (the person has added to it).
 */
const PAGE_EDIT_GRACE_MS = 5_000;

function saveError(code: keyof typeof SAVE_ERRORS) {
  return new ConvexError({ code, message: SAVE_ERRORS[code] });
}

/**
 * Saves the reviewed recording: one page (the body the person saw and edited) and the tasks they
 * accepted. The save is recorded on a row of its own (`recordingSessions`, ended, zero length,
 * empty day keys: it never counts against minutes or sessions) with the page and task ids, so
 * `undoSave` can take back exactly these for 5 minutes. `lang` is the talk's language (default
 * English).
 */
export const saveSession = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    tasks: v.array(v.object({ title: v.string(), minutes: v.optional(v.number()) })),
    lang: v.optional(langValidator),
  },
  returns: v.object({ noteId: v.id("notes"), taskIds: v.array(v.id("tasks")), undoUntil: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (title.length === 0 || title.length > TITLE_MAX) throw saveError("title");
    if (args.body.length > BODY_MAX) throw saveError("body");
    if (args.tasks.length > SAVE_MAX_TASKS) throw saveError("tasks");
    const tasks = args.tasks.map((task) => {
      const taskTitle = task.title.trim();
      if (taskTitle.length === 0 || taskTitle.length > TASK_TITLE_MAX) throw saveError("task");
      if (task.minutes !== undefined && (!Number.isInteger(task.minutes) || task.minutes < 1 || task.minutes > 600)) {
        throw saveError("minutes");
      }
      return { title: taskTitle, minutes: task.minutes };
    });
    const now = Date.now();
    const noteId = await createNoteForUser(ctx, user._id, { title, body: args.body });
    const taskIds: Id<"tasks">[] = [];
    for (const task of tasks) {
      taskIds.push(
        await createTaskForUser(ctx, user._id, {
          title: task.title,
          ...(task.minutes !== undefined ? { timeEstimate: task.minutes * 60_000 } : {}),
        }),
      );
    }
    await ctx.db.insert("recordingSessions", {
      userId: user._id,
      status: "ended",
      lang: args.lang ?? "en",
      startedAt: now,
      lastRenewalAt: now,
      endedAt: now,
      durationMs: 0,
      // No day: a save is not a recording, so the minute and session counts never see it.
      dateKey: "",
      utcDateKey: "",
      grants: 0,
      savedNoteId: noteId,
      savedTaskIds: taskIds,
      createdAt: now,
      updatedAt: now,
    });
    return { noteId, taskIds, undoUntil: now + UNDO_WINDOW_MS };
  },
});

/**
 * Undo `saveSession` within 5 minutes: soft-deletes the page and the tasks that save made, found
 * through the save's own record, never anything else. `taskIds` (what the screen's toast stands
 * for) can only narrow it: a task the save didn't make is left alone. Owner-checked: another
 * person's ids look like missing ones and nothing of theirs is touched.
 *
 * When the person has built on the save since, nothing is removed and the answer says why, so
 * the screen can say it in words: the page changed after the first few seconds (`pageChanged`),
 * or one of its tasks is already done (`taskDone`).
 */
export const undoSave = mutation({
  args: { noteId: v.id("notes"), taskIds: v.array(v.id("tasks")) },
  returns: v.object({
    success: v.boolean(),
    removedTasks: v.number(),
    kept: v.optional(v.union(v.literal("pageChanged"), v.literal("taskDone"))),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.taskIds.length > SAVE_MAX_TASKS) throw saveError("tasks");
    const receipts = await ctx.db
      .query("recordingSessions")
      .withIndex("by_userId_savedNoteId", (q) => q.eq("userId", user._id).eq("savedNoteId", args.noteId))
      .take(2);
    const receipt = receipts.find((row) => row.deletedAt === undefined);
    const note = receipt ? await ctx.db.get(args.noteId) : null;
    if (!receipt || !note || note.userId !== user._id || note.deletedAt !== undefined) {
      throw saveError("undoMissing");
    }
    const now = Date.now();
    if (now - note.createdAt > UNDO_WINDOW_MS) throw saveError("undoGone");
    if (note.updatedAt - note.createdAt > PAGE_EDIT_GRACE_MS) {
      return { success: false, removedTasks: 0, kept: "pageChanged" as const };
    }
    const named = new Set<string>(args.taskIds);
    const tasks: Doc<"tasks">[] = [];
    for (const taskId of receipt.savedTaskIds ?? []) {
      if (!named.has(taskId)) continue;
      const task = await ctx.db.get(taskId);
      if (!task || task.userId !== user._id || task.deletedAt !== undefined) continue;
      if (task.status === "done") return { success: false, removedTasks: 0, kept: "taskDone" as const };
      tasks.push(task);
    }
    await ctx.db.patch(note._id, { deletedAt: now, updatedAt: now });
    for (const task of tasks) await ctx.db.patch(task._id, { deletedAt: now, updatedAt: now });
    await ctx.db.patch(receipt._id, { deletedAt: now, updatedAt: now });
    return { success: true, removedTasks: tasks.length };
  },
});
