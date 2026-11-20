import { describe, expect, test } from "bun:test";
import { checkMessageDoc, type MessageDoc } from "../firestore-docs/conversation-doc";
import {
  COACH_MESSAGE_MAX,
  draftUserMessage,
  orderThreadMessages,
} from "./coach-message-draft";

describe("coach message drafts", () => {
  test("a typed message becomes a checked user document", () => {
    const result = draftUserMessage({ conversationId: "conversation-1", text: "Hello" }, 123);

    expect(result).toEqual({
      ok: true,
      doc: {
        conversationId: "conversation-1",
        role: "user",
        content: "Hello",
        createdAt: 123,
      },
    });
    expect(result.ok && checkMessageDoc(result.doc).ok).toBe(true);
  });

  test("surrounding whitespace is trimmed and inner line breaks are kept", () => {
    const result = draftUserMessage(
      { conversationId: "conversation-1", text: "  First line\n\nSecond line  \n" },
      123
    );

    expect(result.ok && result.doc.content).toBe("First line\n\nSecond line");
  });

  test("empty text is refused", () => {
    expect(draftUserMessage({ conversationId: "conversation-1", text: " \n\t " }, 123)).toEqual({
      ok: false,
      reason: "message is empty",
    });
  });

  test("the message length limit is enforced without cutting the text", () => {
    const accepted = draftUserMessage(
      { conversationId: "conversation-1", text: "a".repeat(COACH_MESSAGE_MAX) },
      123
    );
    const refused = draftUserMessage(
      { conversationId: "conversation-1", text: "a".repeat(COACH_MESSAGE_MAX + 1) },
      123
    );

    expect(accepted.ok && accepted.doc.content.length).toBe(COACH_MESSAGE_MAX);
    expect(refused).toEqual({ ok: false, reason: "message is too long" });
  });

  test("other conversations and soft-deleted messages are left out", () => {
    const items = [
      message("kept", "conversation-1", 2),
      message("other", "conversation-2", 1),
      message("deleted", "conversation-1", 0, 3),
    ];

    expect(orderThreadMessages(items, "conversation-1").map(({ id }) => id)).toEqual(["kept"]);
  });

  test("equal times are ordered by id without mutating a frozen input array", () => {
    const later = message("later", "conversation-1", 2);
    const b = message("b", "conversation-1", 1);
    const a = message("a", "conversation-1", 1);
    const items = Object.freeze([later, b, a]);

    expect(orderThreadMessages(items, "conversation-1").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "later",
    ]);
    expect(items).toEqual([later, b, a]);
  });
});

function message(
  id: string,
  conversationId: string,
  createdAt: number,
  deletedAt?: number
): { id: string; data: MessageDoc } {
  return {
    id,
    data: {
      conversationId,
      role: "user",
      content: id,
      createdAt,
      ...(deletedAt === undefined ? {} : { deletedAt }),
    },
  };
}
