/** Inactive session logic: effects are data for a future adapter, never executed here. */
export const MAX_VOICE_TEXT_UNITS = 4000;
export type VoiceIdentity = Readonly<{
  conversationId: string;
  turnId: string;
  requestKey: string;
  generation: number;
}>;
export type VoiceSessionError =
  | "permission_denied"
  | "unsupported_transport"
  | "capture_failed"
  | "reply_failed"
  | "playback_failed";
export type VoiceSessionState = Readonly<{
  phase: "idle" | "listening" | "transcribing" | "awaitingReply" | "speaking" | "error";
  /** High-water mark survives teardown; callers must supply a strictly newer generation. */
  generation: number;
  identity: VoiceIdentity | null;
  interimText: string;
  acceptedText: string | null;
  /** Local callback fence; never part of the durable request key or payload. */
  replyAttempt: number;
  retryable: boolean;
  error: VoiceSessionError | null;
  /** Content-free guard against immediate request-key reuse after teardown. */
  lastRequest: Readonly<{ conversationId: string; requestKey: string }> | null;
}>;
type Identified = Readonly<{ identity: VoiceIdentity }>;
type ReplyAttempt = Readonly<{ attempt: number }>;
export type VoiceSessionEvent =
  | ({ type: "start" } & Identified)
  | ({ type: "replace" | "bargeIn"; next: VoiceIdentity } & Identified)
  | ({ type: "stop" | "unmount" | "revoke" | "captureEnded" | "playbackEnded" } & Identified)
  | ({ type: "interim" | "final"; text: string } & Identified)
  | ({ type: "retry"; text: string } & Identified & ReplyAttempt)
  | ({ type: "reply"; text: string; crisis: boolean } & Identified & ReplyAttempt)
  | ({ type: "failure"; code: "reply_failed" } & Identified & ReplyAttempt)
  | ({ type: "failure"; code: Exclude<VoiceSessionError, "reply_failed"> } & Identified);
export type VoiceSessionEffect = Readonly<
  | ({ type: "startCapture" | "cancelCapture" | "cancelPlayback" | "clearBuffers" } & Identified)
  | ({ type: "submitTurn"; text: string } & Identified & ReplyAttempt)
  | ({ type: "speak"; text: string } & Identified)
>;
export type VoiceSessionResult = Readonly<{
  state: VoiceSessionState;
  effects: readonly VoiceSessionEffect[];
  rejected?:
    | "invalid_event"
    | "invalid_identity"
    | "invalid_attempt"
    | "attempt_exhausted"
    | "invalid_generation"
    | "generation_exhausted"
    | "stale_event"
    | "invalid_transition"
    | "invalid_text"
    | "request_key_reused"
    | "invalid_error";
}>;

export function createVoiceSessionState(): VoiceSessionState {
  return {
    phase: "idle",
    generation: -1,
    identity: null,
    interimText: "",
    acceptedText: null,
    replyAttempt: 0,
    retryable: false,
    error: null,
    lastRequest: null,
  };
}

/** Read only own data properties; never invoke an adapter's accessor. */
function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor)) throw new Error("Accessor-backed voice event");
  return descriptor.value;
}

function snapshotIdentity(value: unknown): VoiceIdentity {
  // These captured values remain untrusted until invalidIdentity checks them.
  return Object.freeze({
    conversationId: ownData(value, "conversationId"),
    turnId: ownData(value, "turnId"),
    requestKey: ownData(value, "requestKey"),
    generation: ownData(value, "generation"),
  }) as VoiceIdentity;
}

function snapshotEvent(input: VoiceSessionEvent): VoiceSessionEvent | null {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const type = ownData(input, "type");
    if (typeof type !== "string") return null;
    // A Proxy can change each descriptor it exposes. Capture each allowlisted
    // field once, including nested identities, then validate/use only this copy.
    return Object.freeze({
      type,
      identity: snapshotIdentity(ownData(input, "identity")),
      next: snapshotIdentity(ownData(input, "next")),
      text: ownData(input, "text"),
      attempt: ownData(input, "attempt"),
      crisis: ownData(input, "crisis"),
      code: ownData(input, "code"),
    }) as VoiceSessionEvent;
  } catch {
    // Accessors, revoked proxies and throwing descriptor traps cannot authorize effects.
    return null;
  }
}

function validOpaqueId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 256 &&
    !Array.from(value).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    })
  );
}

function invalidIdentity(identity: VoiceIdentity): VoiceSessionResult["rejected"] {
  if (
    !identity ||
    !validOpaqueId(identity.conversationId) ||
    !validOpaqueId(identity.turnId) ||
    typeof identity.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(identity.requestKey)
  )
    return "invalid_identity";
  if (!Number.isSafeInteger(identity.generation) || identity.generation < 0)
    return "invalid_generation";
  return undefined;
}

function matches(a: VoiceIdentity | null, b: VoiceIdentity): boolean {
  return (
    a !== null &&
    a.conversationId === b.conversationId &&
    a.turnId === b.turnId &&
    a.requestKey === b.requestKey &&
    a.generation === b.generation
  );
}

function validText(text: unknown, allowBlank = false): text is string {
  return (
    typeof text === "string" &&
    text.length <= MAX_VOICE_TEXT_UNITS &&
    (allowBlank || text.trim().length > 0)
  );
}

function rejected(
  state: VoiceSessionState,
  reason: NonNullable<VoiceSessionResult["rejected"]>
): VoiceSessionResult {
  return { state, effects: [], rejected: reason };
}

function cancellation(identity: VoiceIdentity): VoiceSessionEffect[] {
  // Playback cancellation is first so a replacement/barge-in cannot overlap capture.
  return [
    { type: "cancelPlayback", identity },
    { type: "cancelCapture", identity },
    { type: "clearBuffers", identity },
  ];
}

function ended(state: VoiceSessionState): VoiceSessionResult {
  return {
    state: {
      ...createVoiceSessionState(),
      generation: state.generation,
      lastRequest: state.lastRequest,
    },
    effects: state.identity ? cancellation(state.identity) : [],
  };
}

function started(
  state: VoiceSessionState,
  next: VoiceIdentity,
  effects: readonly VoiceSessionEffect[] = []
): VoiceSessionResult {
  const invalid = invalidIdentity(next);
  if (invalid) return rejected(state, invalid);
  if (state.generation === Number.MAX_SAFE_INTEGER) return rejected(state, "generation_exhausted");
  if (next.generation <= state.generation) return rejected(state, "stale_event");
  if (
    state.lastRequest?.conversationId === next.conversationId &&
    state.lastRequest.requestKey === next.requestKey
  ) {
    return rejected(state, "request_key_reused");
  }
  // Copy only the allowlisted identity fields, not caller-owned arbitrary metadata.
  const identity: VoiceIdentity = {
    conversationId: next.conversationId,
    turnId: next.turnId,
    requestKey: next.requestKey,
    generation: next.generation,
  };
  return {
    state: {
      phase: "listening",
      generation: identity.generation,
      identity,
      interimText: "",
      acceptedText: null,
      replyAttempt: 0,
      retryable: false,
      error: null,
      lastRequest: { conversationId: identity.conversationId, requestKey: identity.requestKey },
    },
    effects: [...effects, { type: "startCapture", identity }],
  };
}

/**
 * All asynchronous events and explicit teardown/replacement events must identify the
 * current session. A caller starting from idle must supply a newer generation.
 * Adapters must echo each submitTurn attempt on its reply/reply_failed callbacks;
 * Retry references the failed attempt and increments this local fence without changing
 * the durable request key or accepted text. A delayed previous attempt has no effects.
 * Request-key/content checks cover the current turn (and immediate key reuse); durable
 * deduplication across older sessions belongs to the canonical backend, not this reducer.
 * clearBuffers means adapter capture/playback buffers; a reply-failure retry keeps only
 * the exact accepted text in this transient state until retry or explicit teardown.
 */
export function reduceVoiceSession(
  state: VoiceSessionState,
  input: VoiceSessionEvent
): VoiceSessionResult {
  const event = snapshotEvent(input);
  if (!event) return rejected(state, "invalid_event");
  switch (event.type) {
    case "start":
    case "replace":
    case "bargeIn":
    case "stop":
    case "unmount":
    case "revoke":
    case "captureEnded":
    case "playbackEnded":
    case "interim":
    case "final":
    case "retry":
    case "reply":
    case "failure":
      break;
    default:
      return rejected(state, "invalid_event");
  }
  const invalid = invalidIdentity(event.identity);
  if (invalid) return rejected(state, invalid);
  if (event.type === "start") {
    if (state.phase !== "idle") return rejected(state, "invalid_transition");
    return started(state, event.identity);
  }
  if (!matches(state.identity, event.identity)) return rejected(state, "stale_event");
  const identity = state.identity!;
  if (
    event.type === "reply" ||
    event.type === "retry" ||
    (event.type === "failure" && event.code === "reply_failed")
  ) {
    if (!Number.isSafeInteger(event.attempt) || event.attempt < 0)
      return rejected(state, "invalid_attempt");
    if (event.attempt !== state.replyAttempt) return rejected(state, "stale_event");
  }
  switch (event.type) {
    case "stop":
    case "unmount":
    case "revoke":
      return ended(state);
    case "replace":
      return started(state, event.next, cancellation(identity));
    case "bargeIn": {
      const invalidNext = invalidIdentity(event.next);
      if (invalidNext) return rejected(state, invalidNext);
      if (state.phase !== "speaking" || event.next.conversationId !== identity.conversationId) {
        return rejected(state, "invalid_transition");
      }
      return started(state, event.next, cancellation(identity));
    }
    case "captureEnded":
      return state.phase === "listening"
        ? { state: { ...state, phase: "transcribing" }, effects: [] }
        : rejected(state, "invalid_transition");
    case "interim":
      if (state.phase !== "listening" && state.phase !== "transcribing")
        return rejected(state, "invalid_transition");
      if (!validText(event.text, true)) return rejected(state, "invalid_text");
      return { state: { ...state, interimText: event.text }, effects: [] };
    case "final":
      if (state.acceptedText !== null) {
        return event.text === state.acceptedText
          ? { state, effects: [] }
          : rejected(state, "request_key_reused");
      }
      if (state.phase !== "listening" && state.phase !== "transcribing")
        return rejected(state, "invalid_transition");
      if (!validText(event.text)) return rejected(state, "invalid_text");
      return {
        state: { ...state, phase: "awaitingReply", interimText: "", acceptedText: event.text },
        effects: [
          { type: "cancelCapture", identity },
          { type: "submitTurn", identity, text: event.text, attempt: state.replyAttempt },
        ],
      };
    case "retry":
      if (state.acceptedText !== null && event.text !== state.acceptedText)
        return rejected(state, "request_key_reused");
      if (state.phase !== "error" || !state.retryable || state.acceptedText === null)
        return rejected(state, "invalid_transition");
      if (state.replyAttempt === Number.MAX_SAFE_INTEGER)
        return rejected(state, "attempt_exhausted");
      return {
        state: {
          ...state,
          phase: "awaitingReply",
          replyAttempt: state.replyAttempt + 1,
          retryable: false,
          error: null,
        },
        effects: [
          {
            type: "submitTurn",
            identity,
            text: state.acceptedText,
            attempt: state.replyAttempt + 1,
          },
        ],
      };
    case "reply":
      if (state.phase !== "awaitingReply") return rejected(state, "invalid_transition");
      if (event.crisis === true) return ended(state);
      if (event.crisis !== false || !validText(event.text)) return rejected(state, "invalid_text");
      return {
        state: { ...state, phase: "speaking", acceptedText: null, retryable: false, error: null },
        effects: [{ type: "speak", identity, text: event.text }],
      };
    case "playbackEnded":
      return state.phase === "speaking" ? ended(state) : rejected(state, "invalid_transition");
    case "failure": {
      const allowed = {
        listening: ["permission_denied", "unsupported_transport", "capture_failed"],
        transcribing: ["capture_failed"],
        awaitingReply: ["reply_failed"],
        speaking: ["playback_failed"],
        idle: [],
        error: [],
      };
      if (!(allowed[state.phase] as readonly string[]).includes(event.code))
        return rejected(state, "invalid_error");
      const retryable = state.phase === "awaitingReply" && state.acceptedText !== null;
      return {
        state: {
          ...state,
          phase: "error",
          interimText: "",
          acceptedText: retryable ? state.acceptedText : null,
          retryable,
          error: event.code,
        },
        effects: cancellation(identity),
      };
    }
  }
}
