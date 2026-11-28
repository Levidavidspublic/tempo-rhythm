import { describe, expect, test } from "bun:test";
import { createVoiceSessionState, reduceVoiceSession, type VoiceIdentity } from "../components/coach/voice/voiceSession";
import { callView, minutesLow } from "./voice-call";

const id: VoiceIdentity = { conversationId: "c", turnId: "t", requestKey: "r1", generation: 0 };
const idle = createVoiceSessionState();
const listening = reduceVoiceSession(idle, { type: "start", identity: id }).state;
const awaiting = reduceVoiceSession(listening, { type: "final", identity: id, text: "One thing" }).state;
const speaking = reduceVoiceSession(awaiting, {
  type: "reply",
  identity: id,
  attempt: 0,
  text: "Okay",
  crisis: false,
}).state;
const failed = reduceVoiceSession(awaiting, { type: "failure", identity: id, code: "reply_failed", attempt: 0 }).state;

const base = { connecting: false, ended: false, online: true, micOn: true };

describe("callView", () => {
  test("the word follows the session phase", () => {
    expect(callView({ ...base, session: listening }).word).toBe("vc.listening");
    expect(callView({ ...base, session: awaiting }).state).toBe("listening");
    expect(callView({ ...base, session: speaking }).word).toBe("vc.speaking");
    expect(callView({ ...base, session: idle }).word).toBe("vc.paused");
  });

  test("Interrupt works only while the coach speaks", () => {
    expect(callView({ ...base, session: speaking }).canInterrupt).toBe(true);
    expect(callView({ ...base, session: listening }).canInterrupt).toBe(false);
  });

  test("connecting, muted, error, offline and ended each say so in words", () => {
    expect(callView({ ...base, session: idle, connecting: true }).word).toBe("vc.connecting");
    expect(callView({ ...base, session: listening, micOn: false }).word).toBe("vc.paused");
    const error = callView({ ...base, session: failed });
    expect([error.word, error.error]).toEqual(["vc.notConnected", true]);
    const offline = callView({ ...base, session: listening, online: false });
    expect([offline.word, offline.error]).toEqual(["vc.notConnected", false]);
    const ended = callView({ ...base, session: speaking, ended: true });
    expect([ended.word, ended.ended, ended.showControls, ended.canInterrupt]).toEqual(["vc.ended", true, false, false]);
  });

  test("minutes run low at five or fewer", () => {
    expect(minutesLow(5)).toBe(true);
    expect(minutesLow(12)).toBe(false);
  });
});
