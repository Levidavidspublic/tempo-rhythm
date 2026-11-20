import { describe, expect, test } from "bun:test";
import { acceptsSpokenTurn, isTurnReply, newClientKey, recorderMime, sendSpokenTurn, speechEvent } from "./voice-runtime";

describe("speechEvent", () => {
  test("Flux turn events become speech started, interim words and the final words", () => {
    expect(speechEvent({ type: "TurnInfo", event: "StartOfTurn", transcript: "" })).toEqual({ kind: "speechStarted" });
    expect(speechEvent({ type: "TurnInfo", event: "Update", transcript: " what  order " })).toEqual({ kind: "interim", text: "what order" });
    expect(speechEvent({ type: "TurnInfo", event: "EagerEndOfTurn", transcript: "what order" })).toEqual({ kind: "interim", text: "what order" });
    expect(speechEvent({ type: "TurnInfo", event: "EndOfTurn", transcript: "What order should I do these in?" })).toEqual({
      kind: "final",
      text: "What order should I do these in?",
    });
  });

  test("an empty final is no turn; unknown messages are ignored", () => {
    expect(speechEvent({ type: "TurnInfo", event: "EndOfTurn", transcript: "  " })).toBeNull();
    expect(speechEvent({ type: "Connected" })).toBeNull();
    expect(speechEvent("nonsense")).toBeNull();
    expect(speechEvent(null)).toBeNull();
  });

  test("Nova: SpeechStarted, partial results, and speech_final ends the turn", () => {
    expect(speechEvent({ type: "SpeechStarted" })).toEqual({ kind: "speechStarted" });
    const result = (transcript: string, speech_final: boolean) => ({
      type: "Results",
      is_final: true,
      speech_final,
      channel: { alternatives: [{ transcript }] },
    });
    expect(speechEvent(result("קודם", false))).toEqual({ kind: "interim", text: "קודם" });
    expect(speechEvent(result("קודם דנה", true))).toEqual({ kind: "final", text: "קודם דנה" });
  });
});

describe("recorderMime", () => {
  test("takes the first supported Opus format, never a guess", () => {
    expect(recorderMime((m) => m === "audio/ogg;codecs=opus")).toBe("audio/ogg;codecs=opus");
    expect(recorderMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(recorderMime(() => false)).toBeNull();
  });
});

describe("newClientKey", () => {
  test("matches the server's client-key rule", () => {
    const key = newClientKey((b) => b.fill(7));
    expect(key).toBe(`vk_${"07".repeat(16)}`);
    expect(/^[A-Za-z0-9_-]{8,64}$/.test(newClientKey())).toBe(true);
  });
});

describe("a spoken turn", () => {
  const turn = { awaiting: true, ready: true, before: "m1", spoken: new Set(["m0"]) };

  test("its answer is a new reply, and only once send says the reply was written", () => {
    expect(isTurnReply("m2", turn)).toBe(true);
    // Another client's reply that lands while this turn's model call runs is not its answer.
    expect(isTurnReply("m2", { ...turn, ready: false })).toBe(false);
    expect(isTurnReply("m1", turn)).toBe(false);
    expect(isTurnReply("m0", turn)).toBe(false);
    expect(isTurnReply("m2", { ...turn, awaiting: false })).toBe(false);
  });

  test("is held while this call's turn is pending or any reply for the conversation is running", () => {
    expect(acceptsSpokenTurn({ awaiting: false, replyInFlight: false })).toBe(true);
    expect(acceptsSpokenTurn({ awaiting: true, replyInFlight: false })).toBe(false);
    expect(acceptsSpokenTurn({ awaiting: false, replyInFlight: true })).toBe(false);
  });
});

describe("sendSpokenTurn", () => {
  test("a call whose lease another tab replaced, or that can't be renewed, sends nothing", async () => {
    const sent: string[] = [];
    const send = async (text: string) => {
      sent.push(text);
      return "reply";
    };
    expect(await sendSpokenTurn("hello", { renew: async () => ({ status: "expired", minutesLeft: 0 }), send })).toEqual({ kind: "leaseEnded" });
    expect(await sendSpokenTurn("hello", { renew: async () => ({ status: "revoked", minutesLeft: 0 }), send })).toEqual({ kind: "leaseEnded" });
    const offline = async (): Promise<{ status: string; minutesLeft: number }> => {
      throw new Error("offline");
    };
    expect(await sendSpokenTurn("hello", { renew: offline, send })).toEqual({ kind: "leaseEnded" });
    expect(sent).toEqual([]);
  });

  test("with the lease held, the words go through send, and a failed send says not sent", async () => {
    const renew = async () => ({ status: "ok", minutesLeft: 12 });
    expect(await sendSpokenTurn("hello", { renew, send: async (text) => `sent ${text}` })).toEqual({
      kind: "sent",
      result: "sent hello",
      minutesLeft: 12,
    });
    const broken = async (): Promise<string> => {
      throw new Error("network");
    };
    expect(await sendSpokenTurn("hello", { renew, send: broken })).toEqual({ kind: "notSent" });
  });
});
