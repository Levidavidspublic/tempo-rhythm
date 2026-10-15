import { describe, expect, test } from "bun:test";
import { TURN_CLAIM_MS } from "../../../convex/coach";
import { COACH_REPLY_WAIT_MS, COACH_TURN_CLAIM_MS, pickCoachConversation, replyInFlightUntil } from "./coach-conversation";

describe("pickCoachConversation", () => {
  test("the newest legacy conversation, skipping ones moved to Agent chat", () => {
    const list = [
      { _id: "c3", chatMode: "agent" as const },
      { _id: "c2", chatMode: "legacy" as const },
      { _id: "c1", chatMode: "legacy" as const },
    ];
    expect(pickCoachConversation(list)?._id).toBe("c2");
  });

  test("none when every conversation moved, or there are none", () => {
    expect(pickCoachConversation([{ _id: "c1", chatMode: "agent" as const }])).toBeNull();
    expect(pickCoachConversation([])).toBeNull();
  });
});

describe("replyInFlightUntil", () => {
  const now = 1_000_000_000;
  const claimed = (startedAgo: number) => ({
    role: "user",
    toolCalls: { coachClaimUntil: now - startedAgo + COACH_TURN_CLAIM_MS, coachClaim: "c" },
  });

  test("matches the server's claim length", () => {
    expect(COACH_TURN_CLAIM_MS).toBe(TURN_CLAIM_MS);
  });

  test("a reply claimed moments ago is on its way, for every surface, until the wait runs out", () => {
    expect(replyInFlightUntil(claimed(5_000), now)).toBe(now - 5_000 + COACH_REPLY_WAIT_MS);
    expect(replyInFlightUntil(claimed(COACH_REPLY_WAIT_MS - 1), now)).toBe(now + 1);
  });

  test("none for an old claim, a released or missing claim, or an answered turn", () => {
    expect(replyInFlightUntil(claimed(COACH_REPLY_WAIT_MS), now)).toBeNull();
    expect(replyInFlightUntil({ role: "user", toolCalls: { coachClaimUntil: 0 } }, now)).toBeNull();
    expect(replyInFlightUntil({ role: "user" }, now)).toBeNull();
    expect(replyInFlightUntil({ role: "assistant", toolCalls: claimed(5_000).toolCalls }, now)).toBeNull();
    expect(replyInFlightUntil(undefined, now)).toBeNull();
  });
});
