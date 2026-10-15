import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireApprovedForAi } from "./lib/aiGate";
import { isApproved, requireApprovedUser } from "./lib/approval";
import { requireUser } from "./lib/requireUser";
import {
  VOICE_LIMITS,
  dailyMinutesFor,
  laneFor,
  leaseExpired,
  leaseMs,
  localDateKey,
  speechSentences,
  ttsLanguage,
  utcDateKey,
} from "./lib/voicePolicy";
import { requireLegacyWritableConversation } from "./messages";

/**
 * Voice mode on the coach (docs/contracts/VOICE.md, recommended defaults; see lib/voicePolicy.ts).
 *
 * - The browser streams the microphone straight to Deepgram with a 30-second token that `grant`
 *   mints (TRD §7 rule 2). The final transcript goes through the ordinary coach send, as typed
 *   text does, so crisis text gets the fixed card and no model call, and every change is still a
 *   proposal with Accept and a 5-minute Undo. Voice has no action path of its own (L-16).
 * - The coach's reply is read aloud one sentence at a time by Chatterbox on DeepInfra (`speak`).
 *   The client names a reply and a sentence index; the text is resolved here, never sent by the
 *   client (A-10). The crisis card is never read aloud (L-12).
 * - Every session is a lease (`voiceSessions`, content-free) that the client renews; the daily
 *   minutes, the global ceiling and the read-aloud characters are counted from it (A-3, A-5, A-6).
 *
 * Off unless both keys are set on the deployment (names only: DEEPGRAM_API_KEY,
 * DEEPINFRA_API_KEY). No audio, transcript, token or provider body is ever stored or logged.
 */

const VOICE_OFF_MESSAGE = "Voice isn't switched on yet. Typing works as always.";
const LANGUAGE_MESSAGE = "Voice in this language isn't ready yet. Typing works as always.";
const DAILY_LIMIT_MESSAGE = "That's today's voice time. Typing works as always.";
const GLOBAL_LIMIT_MESSAGE = "Voice is resting for today. Typing works as always.";
const SESSION_MESSAGE = "This voice session has ended. Start it again when you like.";
const CONNECT_MESSAGE = "Voice couldn't connect just now. Try again in a moment.";

const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
export const CHATTERBOX_URL = "https://api.deepinfra.com/v1/inference/ResembleAI/chatterbox-multilingual";

/** Both providers' keys are set (presence only; the values never leave the server). */
function voiceConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY) && Boolean(process.env.DEEPINFRA_API_KEY);
}

type Db = QueryCtx | MutationCtx;
type Lease = Doc<"voiceSessions">;

async function preferencesOf(ctx: Db, userId: Id<"users">) {
  return ctx.db
    .query("userPreferences")
    .withIndex("by_userId_deletedAt", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .first();
}

/** The person's leases on one local day (at most `sessionsPerUserPerDay`, enforced at start). */
async function leasesToday(ctx: Db, userId: Id<"users">, dateKey: string) {
  const rows = await ctx.db
    .query("voiceSessions")
    .withIndex("by_userId_dateKey", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
    .collect();
  return rows.filter((r) => r.deletedAt === undefined);
}

/** Live minutes used (ms) on one local day, `except` one lease. */
async function usedTodayMs(ctx: Db, userId: Id<"users">, dateKey: string, now: number, except?: Id<"voiceSessions">) {
  const rows = await leasesToday(ctx, userId, dateKey);
  return rows.filter((r) => r._id !== except).reduce((ms, r) => ms + leaseMs(r, now), 0);
}

/**
 * Everyone's live minutes (ms) on one UTC day, `except` one lease. A day with more rows than can
 * be read counts as spent: the ceiling fails closed instead of counting part of the day.
 */
async function usedGlobalMs(ctx: Db, utcKey: string, now: number, except?: Id<"voiceSessions">) {
  const rows = await ctx.db
    .query("voiceSessions")
    .withIndex("by_utcDateKey", (q) => q.eq("utcDateKey", utcKey))
    .take(VOICE_LIMITS.globalRowsPerDay + 1);
  if (rows.length > VOICE_LIMITS.globalRowsPerDay) return Number.POSITIVE_INFINITY;
  return rows.filter((r) => r._id !== except).reduce((ms, r) => ms + leaseMs(r, now), 0);
}

async function ttsCharsToday(ctx: Db, userId: Id<"users">, dateKey: string) {
  const rows = await ctx.db
    .query("voiceSessions")
    .withIndex("by_userId_dateKey", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
    .collect();
  return rows.reduce((n, r) => n + r.ttsChars, 0);
}

/** The person's live-minute cap today (ms): their tier's number under the preview cap. */
function dailyCapMs(user: Doc<"users">): number {
  return dailyMinutesFor(user.entitlementTier) * 60_000;
}
const GLOBAL_CAP_MS = VOICE_LIMITS.dailyMinutesGlobal * 60_000;

type EndReason = NonNullable<Lease["endReason"]>;

/** Closes a lease; an expired one is counted to its last renewal plus one interval (A-5). */
async function endLease(ctx: MutationCtx, lease: Lease, reason: EndReason, now: number) {
  if (lease.status === "ended") return;
  const endedAt =
    reason === "expired" ? Math.min(now, lease.lastRenewalAt + VOICE_LIMITS.renewEveryMs, lease.startedAt + VOICE_LIMITS.maxSessionMs) : now;
  await ctx.db.patch(lease._id, {
    status: "ended",
    endedAt,
    durationMs: Math.max(0, endedAt - lease.startedAt),
    endReason: reason,
    updatedAt: now,
  });
}

/** The caller's own lease, or a not-found error that names nothing. */
async function ownedLease(ctx: Db, userId: Id<"users">, sessionId: Id<"voiceSessions">) {
  const lease = await ctx.db.get(sessionId);
  if (!lease || lease.userId !== userId || lease.deletedAt !== undefined) {
    throw new Error(SESSION_MESSAGE);
  }
  return lease;
}

/** An active, unexpired lease whose conversation is still the caller's and live. */
async function liveLease(ctx: MutationCtx, userId: Id<"users">, sessionId: Id<"voiceSessions">, now: number) {
  const lease = await ownedLease(ctx, userId, sessionId);
  if (lease.status !== "active") throw new Error(SESSION_MESSAGE);
  if (leaseExpired(lease, now)) {
    await endLease(ctx, lease, "expired", now);
    throw new Error(SESSION_MESSAGE);
  }
  await requireLegacyWritableConversation(ctx, userId, lease.conversationId);
  return lease;
}

const availabilityValidator = v.object({
  available: v.boolean(),
  reason: v.union(
    v.null(),
    v.literal("off"),
    v.literal("language"),
    v.literal("budget"),
    v.literal("resting"),
    v.literal("pending"),
  ),
  minutesLeft: v.number(),
});

/**
 * Whether the mic button can start a session, and how many minutes are left today. "budget": the
 * person's own minutes are spent; "resting": everyone's (the global ceiling) are.
 */
export const availability = query({
  args: {},
  returns: availabilityValidator,
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!isApproved(user)) return { available: false, reason: "pending" as const, minutesLeft: 0 };
    if (!voiceConfigured()) return { available: false, reason: "off" as const, minutesLeft: 0 };
    const prefs = await preferencesOf(ctx, user._id);
    if (!laneFor(prefs?.locale)) return { available: false, reason: "language" as const, minutesLeft: 0 };
    const now = Date.now();
    const today = await leasesToday(ctx, user._id, localDateKey(now, prefs?.timeZone));
    const left = dailyCapMs(user) - today.reduce((ms, r) => ms + leaseMs(r, now), 0);
    const minutesLeft = Math.max(0, Math.floor(left / 60_000));
    // The same two limits `start` applies: minutes left, and sessions started today.
    if (left < VOICE_LIMITS.minStartMs || today.length >= VOICE_LIMITS.sessionsPerUserPerDay) {
      return { available: false, reason: "budget" as const, minutesLeft };
    }
    if (GLOBAL_CAP_MS - (await usedGlobalMs(ctx, utcDateKey(now), now)) < VOICE_LIMITS.minStartMs) {
      return { available: false, reason: "resting" as const, minutesLeft };
    }
    return { available: true, reason: null, minutesLeft };
  },
});

/**
 * Starts a voice session (a lease) on one conversation. Admission order (A-1): approved account,
 * the caller's live conversation, voice switched on, a language lane, today's minutes, the global
 * ceiling. One lease per person: a new start ends the older one (A-2); the same `clientKey`
 * returns the same lease.
 */
export const start = mutation({
  args: { conversationId: v.id("conversations"), clientKey: v.string() },
  returns: v.object({
    sessionId: v.id("voiceSessions"),
    language: v.union(v.literal("en"), v.literal("he")),
    renewEveryMs: v.number(),
    minutesLeft: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    await requireLegacyWritableConversation(ctx, user._id, args.conversationId);
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(args.clientKey)) throw new Error(SESSION_MESSAGE);
    if (!voiceConfigured()) throw new Error(VOICE_OFF_MESSAGE);
    const prefs = await preferencesOf(ctx, user._id);
    const lane = laneFor(prefs?.locale);
    if (!lane) throw new Error(LANGUAGE_MESSAGE);

    const now = Date.now();
    const active = await ctx.db
      .query("voiceSessions")
      .withIndex("by_userId_status", (q) => q.eq("userId", user._id).eq("status", "active"))
      .collect();
    for (const lease of active) {
      if (lease.clientKey === args.clientKey && lease.conversationId === args.conversationId && !leaseExpired(lease, now)) {
        const left = dailyCapMs(user) - (await usedTodayMs(ctx, user._id, lease.dateKey, now));
        return { sessionId: lease._id, language: lease.language, renewEveryMs: VOICE_LIMITS.renewEveryMs, minutesLeft: Math.max(0, Math.floor(left / 60_000)) };
      }
      await endLease(ctx, lease, leaseExpired(lease, now) ? "expired" : "replaced", now);
    }

    const dateKey = localDateKey(now, prefs?.timeZone);
    const utcKey = utcDateKey(now);
    const today = await leasesToday(ctx, user._id, dateKey);
    const left = dailyCapMs(user) - today.reduce((ms, r) => ms + leaseMs(r, now), 0);
    if (left < VOICE_LIMITS.minStartMs || today.length >= VOICE_LIMITS.sessionsPerUserPerDay) {
      throw new Error(DAILY_LIMIT_MESSAGE);
    }
    if (GLOBAL_CAP_MS - (await usedGlobalMs(ctx, utcKey, now)) < VOICE_LIMITS.minStartMs) throw new Error(GLOBAL_LIMIT_MESSAGE);

    const sessionId = await ctx.db.insert("voiceSessions", {
      userId: user._id,
      conversationId: args.conversationId,
      clientKey: args.clientKey,
      status: "active",
      language: lane.language,
      startedAt: now,
      lastRenewalAt: now,
      dateKey,
      utcDateKey: utcKey,
      grants: 0,
      sentences: 0,
      ttsChars: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { sessionId, language: lane.language, renewEveryMs: VOICE_LIMITS.renewEveryMs, minutesLeft: Math.floor(left / 60_000) };
  },
});

/**
 * The heartbeat (A-3). Every renewal re-checks the account, the conversation, the lease and the
 * budgets; anything but "ok" means the client tears the session down (L-14).
 */
export const renew = mutation({
  args: { sessionId: v.id("voiceSessions") },
  returns: v.object({
    status: v.union(v.literal("ok"), v.literal("revoked"), v.literal("exhausted"), v.literal("expired")),
    minutesLeft: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    const now = Date.now();
    if (lease.status !== "active") return { status: "expired" as const, minutesLeft: 0 };
    if (!isApproved(user)) {
      await endLease(ctx, lease, "revoked", now);
      return { status: "revoked" as const, minutesLeft: 0 };
    }
    try {
      await requireLegacyWritableConversation(ctx, user._id, lease.conversationId);
    } catch {
      await endLease(ctx, lease, "revoked", now);
      return { status: "revoked" as const, minutesLeft: 0 };
    }
    if (leaseExpired(lease, now)) {
      await endLease(ctx, lease, "expired", now);
      return { status: "expired" as const, minutesLeft: 0 };
    }
    const spent = (await usedTodayMs(ctx, user._id, lease.dateKey, now, lease._id)) + (now - lease.startedAt);
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

/** Stop: ends the lease. Idempotent. */
export const stop = mutation({
  args: { sessionId: v.id("voiceSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ownedLease(ctx, user._id, args.sessionId);
    await endLease(ctx, lease, "stopped", Date.now());
    return null;
  },
});

/** Admits one speech token for a live lease (A-4): a few per lease, for reconnects. */
export const admitGrant = internalMutation({
  args: { sessionId: v.id("voiceSessions") },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const now = Date.now();
    const lease = await liveLease(ctx, user._id, args.sessionId, now);
    if (lease.grants >= VOICE_LIMITS.grantsPerLease) throw new Error(SESSION_MESSAGE);
    const lane = laneFor(lease.language);
    if (!lane) throw new Error(LANGUAGE_MESSAGE);
    await ctx.db.patch(lease._id, { grants: lease.grants + 1, lastRenewalAt: now, updatedAt: now });
    return { url: lane.url };
  },
});

/**
 * A 30-second Deepgram token for this lease's speech socket, plus the socket URL the server chose.
 * The browser opens the socket with the token as its `bearer` subprotocol. The key never leaves
 * the server; the token is never stored or logged.
 */
export const grant = action({
  args: { sessionId: v.id("voiceSessions") },
  returns: v.object({ token: v.string(), url: v.string() }),
  handler: async (ctx, args): Promise<{ token: string; url: string }> => {
    await requireApprovedForAi(ctx);
    const { url }: { url: string } = await ctx.runMutation(internal.voice.admitGrant, args);
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error(VOICE_OFF_MESSAGE);
    let response: Response;
    try {
      response = await fetch(DEEPGRAM_GRANT_URL, {
        method: "POST",
        headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl_seconds: VOICE_LIMITS.tokenTtlSeconds }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error(`voice.grant: Deepgram could not be reached (${error instanceof Error ? error.name : typeof error})`);
      throw new Error(CONNECT_MESSAGE);
    }
    if (!response.ok) {
      console.error(`voice.grant: Deepgram returned HTTP ${response.status}`);
      throw new Error(CONNECT_MESSAGE);
    }
    const body: unknown = await response.json().catch(() => null);
    const token = body && typeof body === "object" ? (body as { access_token?: unknown }).access_token : undefined;
    if (typeof token !== "string" || token.length < 16 || token.length > 8192) {
      console.error("voice.grant: Deepgram returned no usable token");
      throw new Error(CONNECT_MESSAGE);
    }
    return { token, url };
  },
});

type SentenceResult =
  | { status: "sentence"; text: string; language: string; count: number }
  | { status: "done" }
  | { status: "exhausted" };

type SpeakResult = { status: "audio"; audio: ArrayBuffer; mime: string; count: number } | { status: "done" } | { status: "exhausted" };

const sentenceResult = v.union(
  v.object({ status: v.literal("sentence"), text: v.string(), language: v.string(), count: v.number() }),
  v.object({ status: v.literal("done") }),
  v.object({ status: v.literal("exhausted") }),
);

/**
 * Resolves sentence `index` of a coach reply for reading aloud (A-10): the caller's live lease,
 * an assistant message in the lease's conversation, never the crisis card, within today's
 * read-aloud characters. Counts what it admits.
 */
export const admitSentence = internalMutation({
  args: { sessionId: v.id("voiceSessions"), messageId: v.id("messages"), index: v.number() },
  returns: sentenceResult,
  handler: async (ctx, args) => {
    const user = await requireApprovedUser(ctx);
    const now = Date.now();
    const lease = await liveLease(ctx, user._id, args.sessionId, now);
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.deletedAt !== undefined ||
      message.role !== "assistant" ||
      message.conversationId !== lease.conversationId
    ) {
      throw new Error(SESSION_MESSAGE);
    }
    // The crisis card is shown, never spoken, and nothing about a crisis turn reaches TTS (L-12).
    if (message.modelUsed === "crisis-card") return { status: "done" as const };
    if (!Number.isInteger(args.index) || args.index < 0) throw new Error(SESSION_MESSAGE);
    const sentences = speechSentences(message.content);
    const text = sentences[args.index];
    if (text === undefined) return { status: "done" as const };
    if ((await ttsCharsToday(ctx, user._id, lease.dateKey)) + text.length > VOICE_LIMITS.dailyTtsCharsPerUser) {
      return { status: "exhausted" as const };
    }
    await ctx.db.patch(lease._id, {
      sentences: lease.sentences + 1,
      ttsChars: lease.ttsChars + text.length,
      updatedAt: now,
    });
    return { status: "sentence" as const, text, language: ttsLanguage(lease.language), count: sentences.length };
  },
});

/** Audio bytes from a TTS response: raw audio, or JSON carrying base64 or a data: URL. */
export async function audioFrom(response: Response): Promise<{ bytes: ArrayBuffer; mime: string } | null> {
  const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("audio/")) {
    return { bytes: await response.arrayBuffer(), mime: type };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const raw = (body as { audio?: unknown }).audio;
  if (typeof raw !== "string" || raw.length === 0) return null;
  const match = /^data:(audio\/[a-z0-9.+-]+);base64,(.*)$/i.exec(raw);
  const mime = match?.[1]?.toLowerCase() ?? "audio/wav";
  const base64 = match ? (match[2] ?? "") : raw;
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes: bytes.buffer, mime };
  } catch {
    return null;
  }
}

/** One sentence of a coach reply as audio (Chatterbox multilingual on DeepInfra). Transient bytes only. */
export const speak = action({
  args: { sessionId: v.id("voiceSessions"), messageId: v.id("messages"), index: v.number() },
  returns: v.union(
    v.object({ status: v.literal("audio"), audio: v.bytes(), mime: v.string(), count: v.number() }),
    v.object({ status: v.literal("done") }),
    v.object({ status: v.literal("exhausted") }),
  ),
  handler: async (ctx, args): Promise<SpeakResult> => {
    await requireApprovedForAi(ctx);
    const admitted: SentenceResult = await ctx.runMutation(internal.voice.admitSentence, args);
    if (admitted.status !== "sentence") return admitted;
    const key = process.env.DEEPINFRA_API_KEY;
    if (!key) throw new Error(VOICE_OFF_MESSAGE);
    let response: Response;
    try {
      response = await fetch(CHATTERBOX_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: admitted.text, language_id: admitted.language }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      console.error(`voice.speak: DeepInfra could not be reached (${error instanceof Error ? error.name : typeof error})`);
      throw new Error(CONNECT_MESSAGE);
    }
    if (!response.ok) {
      console.error(`voice.speak: DeepInfra returned HTTP ${response.status}`);
      throw new Error(CONNECT_MESSAGE);
    }
    const audio = await audioFrom(response);
    if (!audio || audio.bytes.byteLength === 0 || audio.bytes.byteLength > VOICE_LIMITS.maxAudioBytes) {
      console.error("voice.speak: DeepInfra returned no usable audio");
      throw new Error(CONNECT_MESSAGE);
    }
    return { status: "audio" as const, audio: audio.bytes, mime: audio.mime, count: admitted.count };
  },
});
