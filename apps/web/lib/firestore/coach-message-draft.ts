import { checkMessageDoc, type MessageDoc } from "../firestore-docs/conversation-doc";

export const COACH_MESSAGE_MAX = 4000;

type DraftResult = { ok: true; doc: MessageDoc } | { ok: false; reason: string };

export function draftUserMessage(
  input: { conversationId: string; text: string },
  now: number
): DraftResult {
  try {
    const content = input.text.trim();

    if (content.length === 0) return { ok: false, reason: "message is empty" };
    if (content.length > COACH_MESSAGE_MAX) {
      return { ok: false, reason: "message is too long" };
    }
    if (input.conversationId.trim().length === 0) {
      return { ok: false, reason: "conversation id is missing" };
    }

    return checkMessageDoc({
      conversationId: input.conversationId,
      role: "user",
      content,
      createdAt: now,
    });
  } catch {
    return { ok: false, reason: "message could not be drafted" };
  }
}

export function orderThreadMessages(
  items: ReadonlyArray<{ id: string; data: MessageDoc }>,
  conversationId: string
): Array<{ id: string; data: MessageDoc }> {
  return items
    .filter(
      (item) => item.data.conversationId === conversationId && item.data.deletedAt === undefined
    )
    .sort(
      (left, right) => left.data.createdAt - right.data.createdAt || left.id.localeCompare(right.id)
    );
}
