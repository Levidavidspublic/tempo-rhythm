/**
 * Voice mode policy (docs/contracts/VOICE.md, PR #871): limits, the speech lane per language, the
 * sentence split for read-aloud, and how a lease is counted. Pure, so every rule is unit-tested
 * without a provider (voicePolicy.test.ts).
 *
 * VOICE.md is still a proposal. The values here are its RECOMMENDED DEFAULTS, applied for the
 * weekend alpha run on the owner's instruction to build voice mode; each one is an OWNER-DECISION
 * Amit can change. They fail closed: no key, no lane, no budget, no voice. App-side limits only
 * bind honest clients; the real spend ceiling is a cap set at each provider (VOICE.md §5).
 */

export const VOICE_LIMITS = {
  /**
   * Preview cap on live minutes per person per local day: 50 for the beta testers (Amit, 18 Oct
   * 2026; VOICE.md A-7 had 15). It only ever lowers the tier's HARD_RULES §9 number
   * (`dailyMinutesFor`); it never raises it. Recording (convex/recordings.ts) shares it.
   */
  dailyMinutesPerUser: 50,
  /** Voice sessions one person can start per local day, so no client floods the day's rows. */
  sessionsPerUserPerDay: 40,
  /**
   * Session rows read for the global ceiling. A day with more fails closed (no new voice, every
   * renewal exhausted) rather than counting only part of the day.
   */
  globalRowsPerDay: 5000,
  /** Live minutes for everyone together per UTC day: the app-side global ceiling (A-7). */
  dailyMinutesGlobal: 120,
  /** Characters of coach replies read aloud per person per local day (A-7 TTS cap). */
  dailyTtsCharsPerUser: 20_000,
  /** A session must have at least this much budget left to start (HARD_RULES §9: 1 minute). */
  minStartMs: 60_000,
  /** The client renews its lease this often (A-3)… */
  renewEveryMs: 15_000,
  /** …and a lease with no renewal for this long is over (A-3). */
  leaseExpiresAfterMs: 45_000,
  /** Longest session (L-15). */
  maxSessionMs: 15 * 60_000,
  /** Speech tokens per lease, for reconnects (A-4). */
  grantsPerLease: 3,
  /** Deepgram token lifetime: it only has to be valid when the socket opens (TRD §5a). */
  tokenTtlSeconds: 30,
  /** Longest sentence sent to TTS in one request (A-10). */
  maxSentenceChars: 300,
  /** Sentences requested ahead of playback (A-10: K = 2). */
  sentencesAhead: 2,
  /** Largest audio clip accepted back from TTS. */
  maxAudioBytes: 4 * 1024 * 1024,
} as const;

/** Live (streaming) voice minutes per local day by entitlement tier (HARD_RULES §9). */
export const TIER_LIVE_MINUTES = { none: 0, basic: 30, pro: 90, max: 180, god: 180 } as const;

/**
 * Today's live-minute cap for a tier: its HARD_RULES §9 number, held under the preview cap (A-7).
 * No tier, or an unknown one, gets none: it fails closed.
 */
export function dailyMinutesFor(tier: string | undefined): number {
  const known = tier !== undefined && Object.keys(TIER_LIVE_MINUTES).includes(tier);
  const byTier = known ? TIER_LIVE_MINUTES[tier as keyof typeof TIER_LIVE_MINUTES] : 0;
  return Math.min(byTier, VOICE_LIMITS.dailyMinutesPerUser);
}

/** Where the browser streams microphone audio, per language (P-1, P-2, P-9). */
export type VoiceLane = {
  language: "en" | "he";
  /** Deepgram endpoint with the model chosen by the server; the client never picks it. */
  url: string;
};

const LANES: Record<"en" | "he", VoiceLane> = {
  // P-1: Flux, English, on /v2/listen. WebM/Opus from MediaRecorder needs no encoding params.
  en: { language: "en", url: "wss://api.deepgram.com/v2/listen?model=flux-general-en" },
  // P-2: Nova-3 Hebrew (Flux has no Hebrew).
  he: {
    language: "he",
    url: "wss://api.deepgram.com/v1/listen?model=nova-3&language=he&interim_results=true&smart_format=true&endpointing=500&utterance_end_ms=1500&vad_events=true",
  },
};

/**
 * The lane for a person's language, or null when live voice is off for it. Hebrew stays off until
 * the owner approves a Hebrew crisis phrase list (VOICE.md L-12(d) default): the crisis check runs
 * on the transcript, and today's list has English phrases only.
 */
export function laneFor(locale: string | undefined): VoiceLane | null {
  if (locale === undefined || locale === "en") return LANES.en;
  return null;
}

/** TTS language id for a lane (Chatterbox multilingual). */
export function ttsLanguage(lane: VoiceLane["language"]): string {
  return lane;
}

/**
 * The reply as the sentences read aloud, in order. Deterministic: the server resolves a sentence
 * from (reply, index) alone (A-10). Splits after . ! ? … (and their full-width forms) and at line
 * breaks; Markdown marks are dropped; a long sentence is cut at a comma or space under the limit.
 */
export function speechSentences(reply: string): string[] {
  const plain = reply
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}\s+|[-*+]\s+(\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/gm, "")
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1");
  const out: string[] = [];
  for (const line of plain.split(/\n+/)) {
    const parts = line.match(/[^.!?…。！？]+(?:[.!?…。！？]+["'”’)\]]*|$)/g) ?? [];
    for (const raw of parts) {
      const sentence = raw.replace(/\s+/g, " ").trim();
      if (!/[\p{L}\p{N}]/u.test(sentence)) continue;
      out.push(...cut(sentence, VOICE_LIMITS.maxSentenceChars));
    }
  }
  return out;
}

function cut(sentence: string, max: number): string[] {
  const pieces: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const at = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" "));
    const end = at > max / 3 ? at + 1 : max;
    pieces.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

export type LeaseTimes = { startedAt: number; lastRenewalAt: number; endedAt?: number };

/**
 * Lease time counted against the budget (A-5): server start to server end. A lease that stopped
 * renewing counts until its last renewal plus one renewal interval, never less.
 */
export function leaseMs(lease: LeaseTimes, now: number): number {
  const end =
    lease.endedAt ?? Math.min(now, lease.lastRenewalAt + VOICE_LIMITS.renewEveryMs, lease.startedAt + VOICE_LIMITS.maxSessionMs);
  return Math.max(0, end - lease.startedAt);
}

/** True when an open lease has missed renewals for too long or run past the session limit. */
export function leaseExpired(lease: LeaseTimes, now: number): boolean {
  return (
    now - lease.lastRenewalAt > VOICE_LIMITS.leaseExpiresAfterMs || now - lease.startedAt > VOICE_LIMITS.maxSessionMs
  );
}

/** The calendar date (YYYY-MM-DD) of `now` in `timeZone`; UTC when the zone is unknown (A-6). */
export function localDateKey(now: number, timeZone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

/** The UTC calendar date of `now`, for the global ceiling. */
export function utcDateKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}
