/**
 * Pure pieces of the voice call runtime (components/coach/voice/useVoiceCall.ts): reading the
 * speech socket's messages, choosing a recorder format, and the client's own time bounds
 * (docs/contracts/VOICE.md L-15 defaults). No audio, no network.
 */

export type SpeechEvent =
  /** The person started talking (the barge-in signal, L-6). */
  | { kind: "speechStarted" }
  /** Words so far in this turn: shown, never sent or stored (R-2). */
  | { kind: "interim"; text: string }
  /** The turn's final words: sent through the ordinary coach path. */
  | { kind: "final"; text: string }
  | null;

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * One message from the speech socket. Flux (/v2/listen) sends TurnInfo events: StartOfTurn,
 * Update, EagerEndOfTurn, TurnResumed and EndOfTurn. Nova (/v1/listen) sends SpeechStarted and
 * Results; a Results with speech_final ends the turn. Anything else is ignored.
 */
export function speechEvent(raw: unknown): SpeechEvent {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.type === "TurnInfo") {
    const text = textOf(m.transcript);
    if (m.event === "StartOfTurn") return { kind: "speechStarted" };
    if (m.event === "EndOfTurn") return text ? { kind: "final", text } : null;
    if (m.event === "Update" || m.event === "EagerEndOfTurn" || m.event === "TurnResumed") {
      return text ? { kind: "interim", text } : null;
    }
    return null;
  }
  if (m.type === "SpeechStarted") return { kind: "speechStarted" };
  if (m.type === "Results") {
    const channel = m.channel as { alternatives?: Array<{ transcript?: unknown }> } | undefined;
    const text = textOf(channel?.alternatives?.[0]?.transcript);
    if (!text) return null;
    return m.speech_final === true ? { kind: "final", text } : { kind: "interim", text };
  }
  return null;
}

/** The first recorder format the browser supports; never guessed (VOICE.md L-3). */
export function recorderMime(isSupported: (mime: string) => boolean): string | null {
  for (const mime of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"]) {
    if (isSupported(mime)) return mime;
  }
  return null;
}

/** The client's own bounds (L-15): no speech and no playback, and a hidden page. */
export const VOICE_CLIENT_LIMITS = {
  idleMs: 90_000,
  hiddenMs: 30_000,
  /** Microphone audio is sent in chunks this long (Flux asks for about 80 ms). */
  chunkMs: 100,
  /** Coach sentences fetched ahead of playback (A-10). */
  sentencesAhead: 2,
} as const;

/** A key for one Start, so a repeated start returns the same lease. */
export function newClientKey(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  return `vk_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Whether `replyId` is the answer to the pending spoken turn: a turn is pending, `send` said its
 * reply was written (`ready`), and the reply is neither the one that was newest when the turn was
 * sent nor one already read. Matched by id, never by comparing the server's clock with the device's.
 */
export function isTurnReply(
  replyId: string,
  turn: { awaiting: boolean; ready: boolean; before: string | null; spoken: ReadonlySet<string> },
): boolean {
  return turn.awaiting && turn.ready && replyId !== turn.before && !turn.spoken.has(replyId);
}

/** Whether a final transcript may be sent: no turn of this call is pending and no reply is running. */
export function acceptsSpokenTurn(turn: { awaiting: boolean; replyInFlight: boolean }): boolean {
  return !turn.awaiting && !turn.replyInFlight;
}
