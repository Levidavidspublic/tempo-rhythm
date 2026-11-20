import { describe, expect, test } from "bun:test";
import type { ChatRequestDoc } from "../firestore-docs/chat-request-doc";
import { planChatRequestCancel } from "./chat-request-cancel";

const baseRequest: ChatRequestDoc = {
  conversationId: "conversation-1",
  requestKey: "request-1",
  payloadDigest: "a".repeat(64),
  sequence: 3,
  status: "queued",
  agentPromptMessageId: "message-1",
  generationEpoch: 2,
  createdAt: 1_000,
  updatedAt: 1_000,
  generationLeaseExpiresAtMs: 5_000,
};

describe("planChatRequestCancel", () => {
  test.each(["queued", "running"] as const)("plans a cancellation for a %s request", (status) => {
    const stored = { ...baseRequest, status };

    expect(planChatRequestCancel(stored, 2_000)).toEqual({
      kind: "patch",
      patch: { status: "cancelled", updatedAt: 2_000 },
      fields: ["status", "updatedAt"],
    });
  });

  test.each([
    ["completed", "Chat request is completed"],
    ["failed", "Chat request has failed"],
    ["cancelled", "Chat request is already cancelled"],
  ] as const)("refuses a %s request", (status, reason) => {
    expect(planChatRequestCancel({ ...baseRequest, status }, 2_000)).toEqual({
      kind: "refused",
      reason,
    });
  });

  test("refuses a deleted request", () => {
    expect(planChatRequestCancel({ ...baseRequest, deletedAt: 1_500 }, 2_000)).toEqual({
      kind: "refused",
      reason: "Chat request is deleted",
    });
  });

  test("refuses a fractional current time", () => {
    expect(planChatRequestCancel(baseRequest, 2_000.5)).toEqual({
      kind: "refused",
      reason: "now must be a safe nonnegative integer",
    });
  });

  test("refuses a current time earlier than creation", () => {
    expect(planChatRequestCancel(baseRequest, 999)).toEqual({
      kind: "refused",
      reason: "now must not be earlier than createdAt",
    });
  });

  test("returns only the two patch fields and does not change stored", () => {
    const stored = { ...baseRequest };
    const before = structuredClone(stored);
    const plan = planChatRequestCancel(stored, 2_000);

    expect(plan.kind).toBe("patch");
    if (plan.kind === "patch") {
      expect(Object.keys(plan.patch).sort()).toEqual(["status", "updatedAt"]);
    }
    expect(stored).toEqual(before);
  });
});
