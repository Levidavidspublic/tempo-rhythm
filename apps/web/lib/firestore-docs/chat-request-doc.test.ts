import { describe, expect, test } from "bun:test";

import { checkChatRequestDoc, softDeleteChatRequest, type ChatRequestDoc } from "./chat-request-doc";

const validRequest: ChatRequestDoc = {
  conversationId: "conversation-1",
  requestKey: "request_1",
  payloadDigest: "a".repeat(64),
  sequence: 0,
  status: "queued",
  agentPromptMessageId: "prompt-1",
  generationEpoch: 0,
  createdAt: 100,
  updatedAt: 100,
  agentResultMessageId: "result-1",
  generationLeaseExpiresAtMs: 200,
};

describe("chat request documents", () => {
  test("accepts a valid request", () => {
    expect(checkChatRequestDoc(validRequest)).toEqual({ ok: true, doc: validRequest });
  });

  test("rejects the unknown userId key", () => {
    expect(checkChatRequestDoc({ ...validRequest, userId: "foreign-user" })).toEqual({
      ok: false,
      reason: "Unknown field: userId",
    });
  });

  test("rejects a bad status", () => {
    expect(checkChatRequestDoc({ ...validRequest, status: "waiting" }).ok).toBe(false);
  });

  test("rejects a non-hex payloadDigest", () => {
    expect(checkChatRequestDoc({ ...validRequest, payloadDigest: "g".repeat(64) }).ok).toBe(false);
  });

  test("rejects a negative sequence", () => {
    expect(checkChatRequestDoc({ ...validRequest, sequence: -1 }).ok).toBe(false);
  });

  test("rejects a bad requestKey", () => {
    expect(checkChatRequestDoc({ ...validRequest, requestKey: "contains spaces" }).ok).toBe(false);
  });

  test("rejects updatedAt before createdAt", () => {
    expect(checkChatRequestDoc({ ...validRequest, updatedAt: 99 }).ok).toBe(false);
    expect(checkChatRequestDoc({ ...validRequest, createdAt: undefined }).ok).toBe(false);
    expect(checkChatRequestDoc({ ...validRequest, updatedAt: undefined }).ok).toBe(false);
  });

  test("soft delete sets deletedAt and keeps every other field", () => {
    expect(softDeleteChatRequest(validRequest, 300)).toEqual({
      ...validRequest,
      deletedAt: 300,
      updatedAt: 300,
    });
  });
});
