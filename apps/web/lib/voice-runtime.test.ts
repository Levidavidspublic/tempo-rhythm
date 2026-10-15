import { describe, expect, test } from "bun:test";
import { newClientKey, recorderMime, speechEvent } from "./voice-runtime";

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
