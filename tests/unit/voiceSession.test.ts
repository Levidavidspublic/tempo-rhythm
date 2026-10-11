import { describe, expect, test } from "bun:test";
import {
  createVoiceSessionState,
  MAX_VOICE_TEXT_UNITS,
  reduceVoiceSession,
  type VoiceIdentity,
  type VoiceSessionError,
  type VoiceSessionEvent,
  type VoiceSessionState,
} from "../../apps/web/components/coach/voice/voiceSession";

const id: VoiceIdentity = {
  conversationId: "conversation-a",
  turnId: "turn-a",
  requestKey: "request_a",
  generation: 0,
};
const next: VoiceIdentity = { ...id, turnId: "turn-b", requestKey: "request_b", generation: 1 };
const start = () => reduceVoiceSession(createVoiceSessionState(), { type: "start", identity: id });
const awaiting = () =>
  reduceVoiceSession(start().state, { type: "final", identity: id, text: "Plan one thing" });
const speaking = () =>
  reduceVoiceSession(awaiting().state, {
    type: "reply",
    attempt: 0,
    identity: id,
    text: "One small step",
    crisis: false,
  });
const phases = (): VoiceSessionState[] => [
  start().state,
  reduceVoiceSession(start().state, { type: "captureEnded", identity: id }).state,
  awaiting().state,
  speaking().state,
  reduceVoiceSession(awaiting().state, {
    type: "failure",
    identity: id,
    code: "reply_failed",
    attempt: 0,
  }).state,
];
const effectTypes = (result: ReturnType<typeof reduceVoiceSession>) =>
  result.effects.map((effect) => effect.type);

describe("inactive voice session reducer", () => {
  test("malformed envelopes are rejected without changing any session phase", () => {
    for (const state of [createVoiceSessionState(), ...phases()]) {
      for (const event of [null, undefined, false, true, 0, 1, "start", [], ["start"]]) {
        const result = reduceVoiceSession(state, event as unknown as VoiceSessionEvent);
        expect(result.rejected).toBe("invalid_event");
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
      }
    }
  });

  test("missing and unknown event discriminators reject even with a matching identity", () => {
    for (const state of [createVoiceSessionState(), ...phases()]) {
      for (const type of [undefined, null, "", "unknown", "toString", 1, {}, []]) {
        const event = { identity: state.identity ?? id, type };
        const result = reduceVoiceSession(state, event as unknown as VoiceSessionEvent);
        expect(result.rejected).toBe("invalid_event");
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
      }
      const result = reduceVoiceSession(state, { identity: state.identity ?? id } as VoiceSessionEvent);
      expect(result.rejected).toBe("invalid_event");
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
    }
  });

  test("inherited discriminators never authorize effects in any session phase", () => {
    const types: VoiceSessionEvent["type"][] = [
      "start",
      "replace",
      "bargeIn",
      "stop",
      "unmount",
      "revoke",
      "captureEnded",
      "playbackEnded",
      "interim",
      "final",
      "retry",
      "reply",
      "failure",
    ];
    for (const state of [createVoiceSessionState(), ...phases()]) {
      for (const type of types) {
        const event = Object.assign(Object.create({ type }), {
          identity: state.identity ?? id,
          next,
          text: "Plan one thing",
          attempt: state.replyAttempt,
          crisis: false,
          code: "reply_failed",
          hasOwnProperty: () => true,
        });
        const result = reduceVoiceSession(state, event);
        expect(result.rejected).toBe("invalid_event");
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
      }
    }
  });

  test("rejects inherited type getters without evaluating them", () => {
    let reads = 0;
    const prototype = Object.defineProperty({}, "type", {
      get() {
        reads += 1;
        return "stop";
      },
    });
    const state = start().state;
    const event = Object.assign(Object.create(prototype), { identity: id });
    const result = reduceVoiceSession(state, event);
    expect(result.rejected).toBe("invalid_event");
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
    expect(reads).toBe(0);
  });

  test("accepts an own valid discriminator on a null-prototype envelope", () => {
    const event = Object.assign(Object.create(null), { type: "stop", identity: id });
    const state = start().state;
    expect(reduceVoiceSession(state, event)).toEqual(
      reduceVoiceSession(state, { type: "stop", identity: id })
    );
  });

  test("rejects own accessor fields without evaluating mutable or throwing getters", () => {
    for (const key of ["type", "identity", "next", "text", "attempt", "crisis", "code"]) {
      let reads = 0;
      const event = Object.defineProperty({ type: "reply", identity: id, attempt: 0 }, key, {
        get() { reads++; throw new Error("must not execute"); },
      });
      const state = awaiting().state;
      const result = reduceVoiceSession(state, event as VoiceSessionEvent);
      expect(result.rejected).toBe("invalid_event");
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
      expect(reads).toBe(0);
    }
  });

  test("rejects nested identity accessors before cancellation or capture", () => {
    for (const field of ["identity", "next"]) {
      for (const key of ["conversationId", "turnId", "requestKey", "generation"]) {
        let reads = 0;
        const supplied = Object.defineProperty({ ...(field === "identity" ? id : next) }, key, {
          get() { reads++; return "changed"; },
        });
        const event = { type: "replace", identity: id, next, [field]: supplied };
        const state = speaking().state;
        const result = reduceVoiceSession(state, event as VoiceSessionEvent);
        expect(result.rejected).toBe("invalid_event");
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
        expect(reads).toBe(0);
      }
    }
  });

  test("captures proxy fields once so validated text and submitted payload stay identical", () => {
    const reads = new Map<PropertyKey, number>();
    const nestedReads = new Map<PropertyKey, number>();
    const identity = new Proxy({ ...id }, {
      get() { throw new Error("must use captured data descriptors"); },
      getOwnPropertyDescriptor(target, key) {
        const count = (nestedReads.get(key) ?? 0) + 1;
        nestedReads.set(key, count);
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return descriptor && { ...descriptor, value: count === 1 ? descriptor.value : "changed" };
      },
    });
    const event = new Proxy({ type: "final", identity, text: "short" }, {
      get() { throw new Error("must not execute property getters"); },
      getOwnPropertyDescriptor(target, key) {
        const count = (reads.get(key) ?? 0) + 1;
        reads.set(key, count);
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return descriptor && { ...descriptor, value: count === 1 ? descriptor.value : "x".repeat(5001) };
      },
    });
    const result = reduceVoiceSession(start().state, event as VoiceSessionEvent);
    expect(result.rejected).toBeUndefined();
    expect(result.state.acceptedText).toBe("short");
    expect(result.effects.find((effect) => effect.type === "submitTurn")).toEqual({
      type: "submitTurn", identity: id, text: "short", attempt: 0,
    });
    expect([...reads.values()].every((count) => count === 1)).toBe(true);
    expect([...nestedReads.values()]).toEqual([1, 1, 1, 1]);
  });

  test("proxy snapshots preserve attempt, crisis, error and bounds validation", () => {
    const cases = [
      { state: awaiting().state, event: { type: "reply", identity: id, text: "hello", crisis: false }, key: "type", later: "stop", reason: "invalid_attempt" },
      { state: awaiting().state, event: { type: "reply", identity: id, text: "hello", crisis: false, attempt: 1 }, key: "attempt", later: 0, reason: "stale_event" },
      { state: awaiting().state, event: { type: "failure", identity: id, code: "reply_failed" }, key: "code", later: "capture_failed", reason: "invalid_attempt" },
      { state: start().state, event: { type: "final", identity: id, text: "x".repeat(5001) }, key: "text", later: "short", reason: "invalid_text" },
      { state: awaiting().state, event: { type: "reply", identity: id, text: "hello", crisis: true, attempt: 0 }, key: "crisis", later: false, reason: undefined },
    ];
    for (const { state, event, key, later, reason } of cases) {
      let reads = 0;
      const proxy = new Proxy(event, {
        getOwnPropertyDescriptor(target, property) {
          const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
          if (property !== key || !descriptor) return descriptor;
          return { ...descriptor, value: ++reads === 1 ? descriptor.value : later };
        },
      });
      const result = reduceVoiceSession(state, proxy as VoiceSessionEvent);
      expect(reads).toBe(1);
      expect(result.rejected).toBe(reason);
      expect(result.effects.some((effect) => effect.type === "speak")).toBe(false);
      if (reason) {
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
      } else {
        expect(result.state.phase).toBe("idle");
      }
    }
  });

  test("replacement copies each next identity field once before validating and capturing", () => {
    const reads = new Map<PropertyKey, number>();
    const supplied = new Proxy({ ...next }, {
      getOwnPropertyDescriptor(target, key) {
        const count = (reads.get(key) ?? 0) + 1;
        reads.set(key, count);
        const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
        return descriptor && { ...descriptor, value: count === 1 ? descriptor.value : -1 };
      },
    });
    const result = reduceVoiceSession(start().state, { type: "replace", identity: id, next: supplied });
    expect(result.rejected).toBeUndefined();
    expect(result.state.identity).toEqual(next);
    expect(result.state.identity).not.toBe(supplied);
    expect(result.effects.at(-1)).toEqual({ type: "startCapture", identity: next });
    expect([...reads.values()]).toEqual([1, 1, 1, 1]);
  });

  test("revoked and throwing proxies reject safely at every untrusted object boundary", () => {
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    const throwing = new Proxy({}, { getOwnPropertyDescriptor() { throw new Error("private"); } });
    for (const malformed of [revoked.proxy, throwing]) {
      for (const event of [malformed, { type: "stop", identity: malformed }, { type: "replace", identity: id, next: malformed }]) {
        const state = start().state;
        const result = reduceVoiceSession(state, event as VoiceSessionEvent);
        expect(result.rejected).toBe("invalid_event");
        expect(result.state).toBe(state);
        expect(result.effects).toEqual([]);
      }
    }
  });

  test("starts only explicitly, with a copied allowlisted identity and inert capture intent", () => {
    expect(createVoiceSessionState()).toEqual({
      phase: "idle",
      generation: -1,
      replyAttempt: 0,
      identity: null,
      interimText: "",
      acceptedText: null,
      retryable: false,
      error: null,
      lastRequest: null,
    });
    const supplied = { ...id, privateMetadata: "do not copy" };
    const result = reduceVoiceSession(createVoiceSessionState(), {
      type: "start",
      identity: supplied,
    });
    expect(result.state.phase).toBe("listening");
    expect(result.state.identity).toEqual(id);
    expect(result.state.identity).not.toBe(supplied);
    expect(result.effects).toEqual([{ type: "startCapture", identity: id }]);
    expect(JSON.stringify(result)).not.toContain("privateMetadata");
    expect(reduceVoiceSession(result.state, { type: "start", identity: next }).rejected).toBe(
      "invalid_transition"
    );
  });

  test("interim and capture end never submit; final cancels capture then submits once", () => {
    let state = start().state;
    for (const text of ["", "hello", "hello שלום 😀\r\n"]) {
      const result = reduceVoiceSession(state, { type: "interim", identity: id, text });
      expect(result.effects).toEqual([]);
      expect(result.state.interimText).toBe(text);
      state = result.state;
    }
    const transcribing = reduceVoiceSession(state, { type: "captureEnded", identity: id });
    expect(transcribing.state.phase).toBe("transcribing");
    expect(transcribing.effects).toEqual([]);
    const text = "  hello שלום 😀\r\n  exact text  ";
    const final = reduceVoiceSession(transcribing.state, { type: "final", identity: id, text });
    expect(final.state.acceptedText).toBe(text);
    expect(final.state.interimText).toBe("");
    expect(final.state.phase).toBe("awaitingReply");
    expect(final.effects).toEqual([
      { type: "cancelCapture", identity: id },
      { type: "submitTurn", attempt: 0, identity: id, text },
    ]);
    expect(reduceVoiceSession(final.state, { type: "final", identity: id, text }).effects).toEqual(
      []
    );
    expect(
      reduceVoiceSession(final.state, { type: "final", identity: id, text: text.trim() }).rejected
    ).toBe("request_key_reused");
  });

  test("stable retry uses the same exact payload and key, with no repeat in-flight submit", () => {
    const text = "  שלום\r\n😀  ";
    const sent = reduceVoiceSession(start().state, { type: "final", identity: id, text });
    const failed = reduceVoiceSession(sent.state, {
      type: "failure",
      identity: id,
      code: "reply_failed",
      attempt: 0,
    });
    expect(failed.state.phase).toBe("error");
    expect(failed.state.retryable).toBe(true);
    expect(failed.state.acceptedText).toBe(text);
    expect(
      reduceVoiceSession(failed.state, {
        type: "retry",
        attempt: 0,
        identity: id,
        text: text.trim(),
      }).rejected
    ).toBe("request_key_reused");
    const retry = reduceVoiceSession(failed.state, {
      type: "retry",
      attempt: 0,
      identity: id,
      text,
    });
    expect(retry.effects).toEqual([{ type: "submitTurn", attempt: 1, identity: id, text }]);
    expect(retry.state.error).toBeNull();
    expect(retry.state.phase).toBe("awaitingReply");
    expect(
      reduceVoiceSession(retry.state, { type: "retry", attempt: 0, identity: id, text }).effects
    ).toEqual([]);
    expect(reduceVoiceSession(failed.state, { type: "final", identity: id, text }).effects).toEqual(
      []
    );
  });

  test("equal text with a new turn/key is distinct; immediate same-key restart is rejected", () => {
    const stopped = reduceVoiceSession(awaiting().state, { type: "stop", identity: id });
    expect(
      reduceVoiceSession(stopped.state, {
        type: "start",
        identity: { ...next, requestKey: id.requestKey },
      }).rejected
    ).toBe("request_key_reused");
    const restarted = reduceVoiceSession(stopped.state, { type: "start", identity: next });
    const final = reduceVoiceSession(restarted.state, {
      type: "final",
      identity: next,
      text: "Plan one thing",
    });
    expect(final.effects[1]).toEqual({
      type: "submitTurn",
      attempt: 0,
      identity: next,
      text: "Plan one thing",
    });
  });

  test.each([
    "stop",
    "unmount",
    "revoke",
  ] as const)("%s clears every active phase and invalidates all late results", (type) => {
    for (const state of phases()) {
      const stopped = reduceVoiceSession(state, { type, identity: id });
      expect(stopped.state).toEqual({
        ...createVoiceSessionState(),
        generation: 0,
        lastRequest: { conversationId: id.conversationId, requestKey: id.requestKey },
      });
      expect(effectTypes(stopped)).toEqual(["cancelPlayback", "cancelCapture", "clearBuffers"]);
      const late: VoiceSessionEvent[] = [
        { type: "interim", identity: id, text: "late" },
        { type: "final", identity: id, text: "late" },
        { type: "reply", attempt: 0, identity: id, text: "late", crisis: false },
        { type: "playbackEnded", identity: id },
        { type: "failure", identity: id, code: "reply_failed", attempt: 0 },
        { type: "retry", attempt: 0, identity: id, text: "Plan one thing" },
        { type, identity: id },
      ];
      for (const event of late) {
        const result = reduceVoiceSession(stopped.state, event);
        expect(result.effects).toEqual([]);
        expect(result.state).toBe(stopped.state);
        expect(result.rejected).toBe("stale_event");
      }
      expect(reduceVoiceSession(stopped.state, { type: "start", identity: id }).rejected).toBe(
        "stale_event"
      );
    }
  });

  test("replacement switches conversation with cancellation first, and rejects old completions", () => {
    const target = { ...next, conversationId: "conversation-b" };
    for (const state of phases()) {
      const replaced = reduceVoiceSession(state, { type: "replace", identity: id, next: target });
      expect(effectTypes(replaced)).toEqual([
        "cancelPlayback",
        "cancelCapture",
        "clearBuffers",
        "startCapture",
      ]);
      expect(replaced.state.identity).toEqual(target);
      expect(replaced.state.acceptedText).toBeNull();
      expect(
        reduceVoiceSession(replaced.state, {
          type: "reply",
          attempt: 0,
          identity: id,
          text: "old",
          crisis: false,
        }).rejected
      ).toBe("stale_event");
      expect(reduceVoiceSession(replaced.state, { type: "stop", identity: id }).effects).toEqual(
        []
      );
    }
  });

  test("barge-in cancels old playback before capture, and late playback cannot end the new turn", () => {
    const result = reduceVoiceSession(speaking().state, { type: "bargeIn", identity: id, next });
    expect(result.effects[0]).toEqual({ type: "cancelPlayback", identity: id });
    expect(result.effects[3]).toEqual({ type: "startCapture", identity: next });
    expect(result.state.phase).toBe("listening");
    expect(reduceVoiceSession(result.state, { type: "playbackEnded", identity: id }).state).toBe(
      result.state
    );
    expect(
      reduceVoiceSession(result.state, { type: "playbackEnded", identity: next }).effects
    ).toEqual([]);
    expect(
      reduceVoiceSession(start().state, { type: "bargeIn", identity: id, next }).rejected
    ).toBe("invalid_transition");
    expect(
      reduceVoiceSession(speaking().state, {
        type: "bargeIn",
        identity: id,
        next: { ...next, conversationId: "other" },
      }).effects
    ).toEqual([]);
  });

  test("committed reply speaks once, completion clears state, crisis never speaks", () => {
    const pending = awaiting().state;
    const reply: VoiceSessionEvent = {
      type: "reply",
      attempt: 0,
      identity: id,
      text: "Hello שלום",
      crisis: false,
    };
    const result = reduceVoiceSession(pending, reply);
    expect(result.effects).toEqual([{ type: "speak", identity: id, text: "Hello שלום" }]);
    expect(result.state.acceptedText).toBeNull();
    expect(reduceVoiceSession(result.state, reply).effects).toEqual([]);
    const finished = reduceVoiceSession(result.state, { type: "playbackEnded", identity: id });
    expect(finished.state.phase).toBe("idle");
    expect(finished.state.identity).toBeNull();
    const crisis = reduceVoiceSession(pending, {
      type: "reply",
      attempt: 0,
      identity: id,
      text: "resources",
      crisis: true,
    });
    expect(crisis.state.phase).toBe("idle");
    expect(
      crisis.effects.some((effect) => effect.type === "speak" || effect.type === "submitTurn")
    ).toBe(false);
    expect(reduceVoiceSession(crisis.state, reply).effects).toEqual([]);
  });

  test.each([
    "conversationId",
    "turnId",
    "requestKey",
    "generation",
  ] as const)("all current-session effect paths reject mismatched %s", (field) => {
    const wrong = { ...id, [field]: field === "generation" ? 1 : "other" };
    const events: VoiceSessionEvent[] = [
      { type: "stop", identity: wrong },
      { type: "unmount", identity: wrong },
      { type: "revoke", identity: wrong },
      { type: "replace", identity: wrong, next },
      { type: "bargeIn", identity: wrong, next },
      { type: "final", identity: wrong, text: "hello" },
      { type: "retry", attempt: 0, identity: wrong, text: "Plan one thing" },
      { type: "reply", attempt: 0, identity: wrong, text: "hello", crisis: false },
      { type: "playbackEnded", identity: wrong },
      { type: "failure", identity: wrong, code: "reply_failed", attempt: 0 },
    ];
    for (const state of phases())
      for (const event of events) {
        const result = reduceVoiceSession(state, event);
        expect(result.rejected).toBe("stale_event");
        expect(result.effects).toEqual([]);
        expect(result.state).toBe(state);
      }
  });

  test.each([
    "permission_denied",
    "unsupported_transport",
    "capture_failed",
  ] as const)("capture error %s is allowlisted and not a reply retry", (code) => {
    const result = reduceVoiceSession(start().state, { type: "failure", identity: id, code });
    expect(result.state.error).toBe(code);
    expect(result.state.phase).toBe("error");
    expect(result.state.retryable).toBe(false);
    expect(
      reduceVoiceSession(result.state, { type: "retry", attempt: 0, identity: id, text: "hello" })
        .effects
    ).toEqual([]);
  });

  test("late errors for another phase cannot clobber state; arbitrary error payloads do not escape", () => {
    const pending = awaiting().state;
    const result = reduceVoiceSession(pending, {
      type: "failure",
      identity: id,
      code: "permission_denied",
    });
    expect(result.state).toBe(pending);
    expect(result.rejected).toBe("invalid_error");
    const bad = reduceVoiceSession(start().state, {
      type: "failure",
      identity: id,
      code: "private provider exception" as Exclude<VoiceSessionError, "reply_failed">,
    });
    expect(bad.rejected).toBe("invalid_error");
    expect(JSON.stringify(bad)).not.toContain("private provider exception");
    expect(
      reduceVoiceSession(speaking().state, {
        type: "failure",
        identity: id,
        code: "playback_failed",
      }).state.error
    ).toBe("playback_failed");
  });

  test.each([
    "",
    " \r\n",
    "x".repeat(4001),
    "😀".repeat(2001),
  ])("invalid final text is rejected without truncation %j", (text) => {
    const result = reduceVoiceSession(start().state, { type: "final", identity: id, text });
    expect(result.rejected).toBe("invalid_text");
    expect(result.effects).toEqual([]);
    expect(result.state.acceptedText).toBeNull();
  });

  test("UTF-16 text limits are exact for interim/final and bounded reply", () => {
    expect(MAX_VOICE_TEXT_UNITS).toBe(4000);
    for (const text of ["x".repeat(4000), "😀".repeat(2000)]) {
      expect(
        reduceVoiceSession(start().state, { type: "final", identity: id, text }).state.acceptedText
      ).toBe(text);
      expect(
        reduceVoiceSession(start().state, { type: "interim", identity: id, text }).state.interimText
      ).toBe(text);
      expect(
        reduceVoiceSession(awaiting().state, {
          type: "reply",
          attempt: 0,
          identity: id,
          text,
          crisis: false,
        }).effects[0]
      ).toEqual({ type: "speak", identity: id, text });
    }
    expect(
      reduceVoiceSession(start().state, { type: "interim", identity: id, text: "x".repeat(4001) })
        .rejected
    ).toBe("invalid_text");
    expect(
      reduceVoiceSession(awaiting().state, {
        type: "reply",
        attempt: 0,
        identity: id,
        text: "x".repeat(4001),
        crisis: false,
      }).rejected
    ).toBe("invalid_text");
  });

  test.each([
    "",
    "space key",
    "a.b",
    "ש",
    "a".repeat(129),
    "key\n",
  ])("rejects invalid request key %j", (requestKey) => {
    const result = reduceVoiceSession(createVoiceSessionState(), {
      type: "start",
      identity: { ...id, requestKey },
    });
    expect(result.rejected).toBe("invalid_identity");
    expect(result.effects).toEqual([]);
  });

  test("exact key/opaque identity boundaries and unknown identity metadata", () => {
    expect(
      reduceVoiceSession(createVoiceSessionState(), {
        type: "start",
        identity: { ...id, requestKey: "A_-0".repeat(32), turnId: "ש".repeat(256) },
      }).state.phase
    ).toBe("listening");
    for (const field of ["turnId", "conversationId"] as const)
      for (const value of ["", " ", "x\u0000", "x\u0085", "x".repeat(257)]) {
        expect(
          reduceVoiceSession(createVoiceSessionState(), {
            type: "start",
            identity: { ...id, [field]: value },
          }).rejected
        ).toBe("invalid_identity");
      }
  });

  test.each([
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects invalid generation %s", (generation) => {
    const result = reduceVoiceSession(createVoiceSessionState(), {
      type: "start",
      identity: { ...id, generation },
    });
    expect(result.rejected).toBe("invalid_generation");
    expect(result.effects).toEqual([]);
  });

  test("generation high-water survives teardown and exhaustion never wraps", () => {
    const highest = { ...id, generation: Number.MAX_SAFE_INTEGER };
    const active = reduceVoiceSession(createVoiceSessionState(), {
      type: "start",
      identity: highest,
    });
    expect(active.state.generation).toBe(Number.MAX_SAFE_INTEGER);
    const stopped = reduceVoiceSession(active.state, { type: "stop", identity: highest });
    expect(stopped.state.generation).toBe(Number.MAX_SAFE_INTEGER);
    expect(reduceVoiceSession(stopped.state, { type: "start", identity: next }).rejected).toBe(
      "generation_exhausted"
    );
    expect(
      reduceVoiceSession(stopped.state, {
        type: "start",
        identity: { ...next, generation: Number.MAX_SAFE_INTEGER + 1 },
      }).rejected
    ).toBe("invalid_generation");
  });

  test("invalid replacement leaves current session running without cancellation", () => {
    const state = speaking().state;
    for (const candidate of [
      { ...next, generation: 0 },
      { ...next, generation: -1 },
      { ...next, requestKey: id.requestKey },
      { ...next, requestKey: "" },
    ]) {
      const result = reduceVoiceSession(state, { type: "replace", identity: id, next: candidate });
      expect(result.state).toBe(state);
      expect(result.effects).toEqual([]);
      expect(result.rejected).toBeDefined();
    }
  });

  test("malformed runtime identity objects reject safely before any cancellation", () => {
    for (const invalid of [null, undefined, {}, { ...next, requestKey: 42 }]) {
      const identity = invalid as unknown as VoiceIdentity;
      expect(
        reduceVoiceSession(createVoiceSessionState(), { type: "start", identity }).rejected
      ).toBe("invalid_identity");
      for (const type of ["replace", "bargeIn"] as const) {
        const state = speaking().state;
        const result = reduceVoiceSession(state, { type, identity: id, next: identity });
        expect(result.rejected).toBe("invalid_identity");
        expect(result.effects).toEqual([]);
        expect(result.state).toBe(state);
      }
    }
  });

  test("retry fences delayed failure, success and crisis from the previous attempt", () => {
    const failed = reduceVoiceSession(awaiting().state, {
      type: "failure",
      identity: id,
      code: "reply_failed",
      attempt: 0,
    });
    const retry = reduceVoiceSession(failed.state, {
      type: "retry",
      identity: id,
      text: "Plan one thing",
      attempt: 0,
    });
    expect(retry.state.replyAttempt).toBe(1);
    expect(retry.effects).toEqual([
      { type: "submitTurn", identity: id, text: "Plan one thing", attempt: 1 },
    ]);
    const late: VoiceSessionEvent[] = [
      { type: "failure", identity: id, code: "reply_failed", attempt: 0 },
      { type: "reply", identity: id, text: "stale success", crisis: false, attempt: 0 },
      { type: "reply", identity: id, text: "stale crisis", crisis: true, attempt: 0 },
    ];
    for (const event of late) {
      const ignored = reduceVoiceSession(retry.state, event);
      expect(ignored.rejected).toBe("stale_event");
      expect(ignored.state).toBe(retry.state);
      expect(ignored.effects).toEqual([]);
      const success = reduceVoiceSession(ignored.state, {
        type: "reply",
        identity: id,
        text: "current success",
        crisis: false,
        attempt: 1,
      });
      expect(success.state.phase).toBe("speaking");
      expect(success.effects).toEqual([{ type: "speak", identity: id, text: "current success" }]);
      expect(reduceVoiceSession(success.state, event).state).toBe(success.state);
    }
  });

  test("successive retries fence stale retry clicks while preserving durable identity and text", () => {
    let state = awaiting().state;
    for (let attempt = 0; attempt < 3; attempt++) {
      state = reduceVoiceSession(state, {
        type: "failure",
        identity: id,
        code: "reply_failed",
        attempt,
      }).state;
      if (attempt > 0) {
        const stale = reduceVoiceSession(state, {
          type: "retry",
          identity: id,
          text: "Plan one thing",
          attempt: attempt - 1,
        });
        expect(stale.rejected).toBe("stale_event");
        expect(stale.effects).toEqual([]);
      }
      const retry = reduceVoiceSession(state, {
        type: "retry",
        identity: id,
        text: "Plan one thing",
        attempt,
      });
      expect(retry.state.identity).toEqual(id);
      expect(retry.state.acceptedText).toBe("Plan one thing");
      expect(retry.state.replyAttempt).toBe(attempt + 1);
      expect(retry.effects).toEqual([
        { type: "submitTurn", identity: id, text: "Plan one thing", attempt: attempt + 1 },
      ]);
      state = retry.state;
    }
    const stopped = reduceVoiceSession(state, { type: "stop", identity: id }).state;
    expect(stopped.acceptedText).toBeNull();
    expect(
      reduceVoiceSession(stopped, {
        type: "reply",
        identity: id,
        text: "late",
        crisis: false,
        attempt: 3,
      }).effects
    ).toEqual([]);
    const restarted = reduceVoiceSession(stopped, { type: "start", identity: next }).state;
    expect(restarted.replyAttempt).toBe(0);
    expect(
      reduceVoiceSession(restarted, {
        type: "failure",
        identity: id,
        code: "reply_failed",
        attempt: 0,
      }).rejected
    ).toBe("stale_event");
  });

  test.each([
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    undefined,
  ])("rejects malformed reply attempt %s", (value) => {
    const attempt = value as number;
    const pending = awaiting().state;
    for (const event of [
      { type: "reply", identity: id, text: "reply", crisis: false, attempt },
      { type: "failure", identity: id, code: "reply_failed", attempt },
    ] as VoiceSessionEvent[]) {
      const result = reduceVoiceSession(pending, event);
      expect(result.rejected).toBe("invalid_attempt");
      expect(result.effects).toEqual([]);
      expect(result.state).toBe(pending);
    }
  });

  test("reply attempt exhaustion rejects retry without wrapping or changing the request", () => {
    const state: VoiceSessionState = {
      ...awaiting().state,
      replyAttempt: Number.MAX_SAFE_INTEGER,
      phase: "error",
      retryable: true,
      error: "reply_failed",
    };
    const result = reduceVoiceSession(state, {
      type: "retry",
      identity: id,
      text: "Plan one thing",
      attempt: Number.MAX_SAFE_INTEGER,
    });
    expect(result.rejected).toBe("attempt_exhausted");
    expect(result.state).toBe(state);
    expect(result.effects).toEqual([]);
  });

  test("public transitions are deterministic and never mutate frozen inputs", () => {
    const events: VoiceSessionEvent[] = [
      { type: "start", identity: id },
      { type: "interim", identity: id, text: "שלום" },
      { type: "final", identity: id, text: "שלום\r\n😀" },
      { type: "failure", identity: id, code: "reply_failed", attempt: 0 },
      { type: "retry", attempt: 0, identity: id, text: "שלום\r\n😀" },
      { type: "reply", attempt: 1, identity: id, text: "reply", crisis: false },
      { type: "bargeIn", identity: id, next },
      { type: "stop", identity: next },
    ];
    let state = createVoiceSessionState();
    for (const event of events) {
      Object.freeze(state);
      Object.freeze(state.identity);
      Object.freeze(state.lastRequest);
      Object.freeze(event);
      Object.freeze(event.identity);
      const snapshot = JSON.stringify({ state, event });
      const first = reduceVoiceSession(state, event);
      expect(reduceVoiceSession(state, event)).toEqual(first);
      expect(JSON.stringify({ state, event })).toBe(snapshot);
      state = first.state;
    }
  });
});
