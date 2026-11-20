import type { ChatRequestDoc } from "../firestore-docs/chat-request-doc";

export const COACH_REPLY_COPY_KEYS = {
  none: null,
  waiting: "coach.reply.waiting",
  thinking: "coach.reply.thinking",
  stalled: "coach.reply.stalled",
  done: null,
  failed: "coach.reply.failed",
  stopped: "coach.reply.stopped",
} as const;

export type CoachReplyState = keyof typeof COACH_REPLY_COPY_KEYS;

export type CoachReplyStatus = {
  state: CoachReplyState;
  canStop: boolean;
  canRetry: boolean;
  copyKey: (typeof COACH_REPLY_COPY_KEYS)[CoachReplyState];
};

function replyStatus(state: CoachReplyState): CoachReplyStatus {
  return {
    state,
    canStop: state === "waiting" || state === "thinking" || state === "stalled",
    canRetry: state === "failed" || state === "stalled",
    copyKey: COACH_REPLY_COPY_KEYS[state],
  };
}

export function readCoachReplyState(
  request: ChatRequestDoc | null | undefined,
  now: number
): CoachReplyStatus {
  if (!request || request.deletedAt !== undefined) return replyStatus("none");

  switch (request.status) {
    case "queued":
      return replyStatus("waiting");
    case "running":
      return replyStatus(
        request.generationLeaseExpiresAtMs !== undefined &&
          Number.isFinite(now) &&
          now > request.generationLeaseExpiresAtMs
          ? "stalled"
          : "thinking"
      );
    case "completed":
      return replyStatus("done");
    case "failed":
      return replyStatus("failed");
    case "cancelled":
      return replyStatus("stopped");
  }
}
