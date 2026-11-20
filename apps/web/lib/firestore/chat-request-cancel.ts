import { checkChatRequestDoc, type ChatRequestDoc } from "../firestore-docs/chat-request-doc";

type ChatRequestCancelPlan =
  | {
      kind: "patch";
      patch: {
        status: "cancelled";
        updatedAt: number;
      };
      fields: ["status", "updatedAt"];
    }
  | { kind: "refused"; reason: string };

export function planChatRequestCancel(stored: ChatRequestDoc, now: number): ChatRequestCancelPlan {
  if (stored.deletedAt !== undefined) {
    return { kind: "refused", reason: "Chat request is deleted" };
  }

  if (stored.status === "completed") {
    return { kind: "refused", reason: "Chat request is completed" };
  }
  if (stored.status === "failed") {
    return { kind: "refused", reason: "Chat request has failed" };
  }
  if (stored.status === "cancelled") {
    return { kind: "refused", reason: "Chat request is already cancelled" };
  }

  if (!Number.isSafeInteger(now) || now < 0) {
    return {
      kind: "refused",
      reason: "now must be a safe nonnegative integer",
    };
  }
  if (now < stored.createdAt) {
    return {
      kind: "refused",
      reason: "now must not be earlier than createdAt",
    };
  }

  const patch = { status: "cancelled" as const, updatedAt: now };
  const checked = checkChatRequestDoc({ ...stored, ...patch });
  if (!checked.ok) {
    return { kind: "refused", reason: checked.reason };
  }

  return { kind: "patch", patch, fields: ["status", "updatedAt"] };
}
