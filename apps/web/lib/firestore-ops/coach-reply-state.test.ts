import { describe, expect, test } from "bun:test";
import {
  checkChatRequestDoc,
  type ChatRequestDoc,
} from "../firestore-docs/chat-request-doc";
import { readCoachReplyState } from "./coach-reply-state";

const baseRequest: ChatRequestDoc = {
  conversationId: "conversation-1",
  requestKey: "request-1",
  payloadDigest: "a".repeat(64),
  sequence: 0,
  status: "queued",
  agentPromptMessageId: "prompt-1",
  generationEpoch: 0,
  createdAt: 100,
  updatedAt: 100,
};

function request(overrides: Partial<ChatRequestDoc> = {}): ChatRequestDoc {
  const checked = checkChatRequestDoc({ ...baseRequest, ...overrides });
  expect(checked.ok).toBe(true);
  if (!checked.ok) throw new Error(checked.reason);
  return checked.doc;
}

describe("readCoachReplyState", () => {
  test("missing request gives none", () => {
    expect(readCoachReplyState(undefined, 100)).toEqual({
      state: "none",
      canStop: false,
      canRetry: false,
      copyKey: null,
    });
  });

  test("deleted request gives none", () => {
    expect(readCoachReplyState(request({ deletedAt: 101, updatedAt: 101 }), 102)).toEqual({
      state: "none",
      canStop: false,
      canRetry: false,
      copyKey: null,
    });
  });

  test("queued request gives waiting and can stop", () => {
    expect(readCoachReplyState(request(), 100)).toEqual({
      state: "waiting",
      canStop: true,
      canRetry: false,
      copyKey: "coach.reply.waiting",
    });
  });

  test("running request inside its lease gives thinking", () => {
    expect(
      readCoachReplyState(request({ status: "running", generationLeaseExpiresAtMs: 200 }), 200)
    ).toEqual({
      state: "thinking",
      canStop: true,
      canRetry: false,
      copyKey: "coach.reply.thinking",
    });
  });

  test("running request past its lease gives stalled and can stop and retry", () => {
    expect(
      readCoachReplyState(request({ status: "running", generationLeaseExpiresAtMs: 200 }), 201)
    ).toEqual({
      state: "stalled",
      canStop: true,
      canRetry: true,
      copyKey: "coach.reply.stalled",
    });
  });

  test("completed request gives done with no copy key", () => {
    expect(readCoachReplyState(request({ status: "completed" }), 100)).toEqual({
      state: "done",
      canStop: false,
      canRetry: false,
      copyKey: null,
    });
  });

  test("failed request can retry but cannot stop", () => {
    expect(readCoachReplyState(request({ status: "failed" }), 100)).toEqual({
      state: "failed",
      canStop: false,
      canRetry: true,
      copyKey: "coach.reply.failed",
    });
  });

  test("cancelled request gives stopped", () => {
    expect(readCoachReplyState(request({ status: "cancelled" }), 100)).toEqual({
      state: "stopped",
      canStop: false,
      canRetry: false,
      copyKey: "coach.reply.stopped",
    });
  });
});
