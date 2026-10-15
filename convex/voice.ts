import { ConvexError, v } from "convex/values";
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

/** Calm refusals the client shows, by machine code. */
const VOICE_ERRORS = {
  voice_off: "Voice isn't switched on yet. Typing works as always.",
  voice_language: "Voice in this language isn't ready yet. Typing works as always.",
  voice_daily_limit: "That's today's voice time. Typing works as always.",
  voice_resting: "Voice is resting for today. Typing works as always.",
  voice_session_ended: "This voice session has ended. Start it again when you like.",
  voice_connect: "Voice couldn't connect just now. Try again in a moment.",
} as const;

/**
 * A `ConvexError`, so the calm copy reaches the client on production deployments too (a plain
 * `Error` message is replaced there; see convex/messages.ts). Same `{ code, message }` shape.
 */
function voiceError(code: keyof typeof VOICE_ERRORS) {
  return new ConvexError({ code, message: VOICE_ERRORS[code] });
}

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

/**
 * The person's live-minute cap today (ms): their tier's number under the preview cap, and none
 * unless the account is paid. The tier alone unlocks nothing (convex/lib/entitlements.ts):
 * `userType` is what a cancelled subscription changes.
 */
function dailyCapMs(user: Doc<"users">): number {
  if (user.userType !== "paid") return 0;
  return dailyMinutesFor(user.entitlementTier) * 60_000;
}
const GLOBAL_CAP_MS = VOICE_LIMITS.dailyMinutesGlobal * 60_000;

type EndReason = NonNullable<Lease["endReason"]>;

/**
 * Closes a lease. Whatever ends it (stop, revocation, a newer start), a lease that already went
 * stale is counted only to its last renewal plus one interval (A-5), and no lease past the
 * longest session.
 */
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

/** The caller's own lease, or a not-found error that names nothing. */
async function ownedLease(ctx: Db, userId: Id<"users">, sessionId: Id<"voiceSessions">) {
  const lease = await ctx.db.get(sessionId);
  if (!lease || lease.userId !== userId || lease.deletedAt !== undefined) {
    throw voiceError("voice_session_ended");
  }
  return lease;
}

/**
 * An active, unexpired lease whose conversation is still the caller's and live, within the
 * caller's minutes today. Provider work (a token, a sentence) re-checks the cap, so an account that
 * stops being paid mid-session gets no more of either; the next heartbeat ends the lease.
 */
async function liveLease(ctx: MutationCtx, user: Doc<"users">, sessionId: Id<"voiceSessions">, now: number) {
  const lease = await ownedLease(ctx, user._id, sessionId);
  if (lease.status !== "active") throw voiceError("voice_session_ended");
  if (leaseExpired(lease, now)) {
    await endLease(ctx, lease, "expired", now);
    throw voiceError("voice_session_ended");
  }
  await requireLegacyWritableConversation(ctx, user._id, lease.conversationId);
  const spent = (await usedTodayMs(ctx, user._id, lease.dateKey, now, lease._id)) + leaseMs(lease, now);
  if (spent >= dailyCapMs(user)) throw voiceError("voice_daily_limit");
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
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(args.clientKey)) throw voiceError("voice_session_ended");
    if (!voiceConfigured()) throw voiceError("voice_off");
    const prefs = await preferencesOf(ctx, user._id);
    const lane = laneFor(prefs?.locale);
    if (!lane) throw voiceError("voice_language");

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
      throw voiceError("voice_daily_limit");
    }
    if (GLOBAL_CAP_MS - (await usedGlobalMs(ctx, utcKey, now)) < VOICE_LIMITS.minStartMs) throw voiceError("voice_resting");

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
    const lease = await liveLease(ctx, user, args.sessionId, now);
    if (lease.grants >= VOICE_LIMITS.grantsPerLease) throw voiceError("voice_session_ended");
    const lane = laneFor(lease.language);
    if (!lane) throw voiceError("voice_language");
    // A grant is not a heartbeat: only `renew` keeps a lease alive, so failed mints can't.
    await ctx.db.patch(lease._id, { grants: lease.grants + 1, updatedAt: now });
    return { url: lane.url };
  },
});

/** Gives back a grant whose token couldn't be minted, so failed attempts don't use up the lease. */
export const releaseGrant = internalMutation({
  args: { sessionId: v.id("voiceSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ctx.db.get(args.sessionId);
    if (lease && lease.userId === user._id && lease.status === "active" && lease.grants > 0) {
      await ctx.db.patch(lease._id, { grants: lease.grants - 1, updatedAt: Date.now() });
    }
    return null;
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
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw voiceError("voice_off");
    // The grant is reserved first (so concurrent calls can't pass the limit) and given back if no
    // token comes of it.
    const { url }: { url: string } = await ctx.runMutation(internal.voice.admitGrant, args);
    try {
      return { token: await mintDeepgramToken(key), url };
    } catch (error) {
      await ctx.runMutation(internal.voice.releaseGrant, args).catch(() => {});
      throw error;
    }
  },
});

/** One short-lived Deepgram token (TRD §5a step 1). Errors say nothing of the provider's body. */
async function mintDeepgramToken(key: string): Promise<string> {
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
    throw voiceError("voice_connect");
  }
  if (!response.ok) {
    console.error(`voice.grant: Deepgram returned HTTP ${response.status}`);
    throw voiceError("voice_connect");
  }
  const body: unknown = await response.json().catch(() => null);
  const token = body && typeof body === "object" ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== "string" || token.length < 16 || token.length > 8192) {
    console.error("voice.grant: Deepgram returned no usable token");
    throw voiceError("voice_connect");
  }
  return token;
}

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
    const lease = await liveLease(ctx, user, args.sessionId, now);
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.deletedAt !== undefined ||
      message.role !== "assistant" ||
      message.conversationId !== lease.conversationId
    ) {
      throw voiceError("voice_session_ended");
    }
    // The crisis card is shown, never spoken, and nothing about a crisis turn reaches TTS (L-12).
    if (message.modelUsed === "crisis-card") return { status: "done" as const };
    if (!Number.isInteger(args.index) || args.index < 0) throw voiceError("voice_session_ended");
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

/** Gives back a sentence that produced no audio, so a provider outage can't use up the day's read-aloud. */
export const releaseSentence = internalMutation({
  args: { sessionId: v.id("voiceSessions"), chars: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lease = await ctx.db.get(args.sessionId);
    if (lease && lease.userId === user._id && lease.sentences > 0) {
      await ctx.db.patch(lease._id, {
        sentences: lease.sentences - 1,
        ttsChars: Math.max(0, lease.ttsChars - args.chars),
        updatedAt: Date.now(),
      });
    }
    return null;
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
    const key = process.env.DEEPINFRA_API_KEY;
    if (!key) throw voiceError("voice_off");
    // The sentence is counted first (so concurrent calls can't pass the day's allowance) and given
    // back if no audio comes of it.
    const admitted: SentenceResult = await ctx.runMutation(internal.voice.admitSentence, args);
    if (admitted.status !== "sentence") return admitted;
    try {
      const audio = await synthesize(key, admitted.text, admitted.language);
      return { status: "audio" as const, audio: audio.bytes, mime: audio.mime, count: admitted.count };
    } catch (error) {
      await ctx.runMutation(internal.voice.releaseSentence, { sessionId: args.sessionId, chars: admitted.text.length }).catch(() => {});
      throw error;
    }
  },
});

/** One sentence as audio from DeepInfra. Errors say nothing of the provider's body. */
async function synthesize(key: string, text: string, language: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  let response: Response;
  try {
    response = await fetch(CHATTERBOX_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, language_id: language }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    console.error(`voice.speak: DeepInfra could not be reached (${error instanceof Error ? error.name : typeof error})`);
    throw voiceError("voice_connect");
  }
  if (!response.ok) {
    console.error(`voice.speak: DeepInfra returned HTTP ${response.status}`);
    throw voiceError("voice_connect");
  }
  const audio = await audioFrom(response);
  if (!audio || audio.bytes.byteLength === 0 || audio.bytes.byteLength > VOICE_LIMITS.maxAudioBytes) {
    console.error("voice.speak: DeepInfra returned no usable audio");
    throw voiceError("voice_connect");
  }
  return audio;
}
