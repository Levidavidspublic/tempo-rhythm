import { describe, expect, test } from "bun:test";

import { checkConversationDoc, checkMessageDoc } from "./conversation-doc";

describe("conversation documents", () => {
  test("accepts a valid conversation", () => {
    expect(checkConversationDoc({ title: "Planning", createdAt: 1, updatedAt: 2 })).toEqual({
      ok: true,
      doc: { title: "Planning", createdAt: 1, updatedAt: 2 },
    });
  });

  test("refuses a conversation with userId", () => {
    expect(
      checkConversationDoc({
        title: "Planning",
        userId: "owner",
        createdAt: 1,
        updatedAt: 2,
      }).ok
    ).toBe(false);
  });

  test("refuses an empty title", () => {
    expect(checkConversationDoc({ title: "  ", createdAt: 1, updatedAt: 2 }).ok).toBe(false);
  });

  test("refuses a negative nextChatSequence", () => {
    expect(
      checkConversationDoc({
        title: "Planning",
        nextChatSequence: -1,
        createdAt: 1,
        updatedAt: 2,
      }).ok
    ).toBe(false);
  });
});

describe("message documents", () => {
  test("accepts a valid message with sources", () => {
    expect(
      checkMessageDoc({
        conversationId: "conversation-1",
        role: "assistant",
        content: "Try this.",
        sources: [{ title: "Tempo", site: "tempo", url: "https://example.com/tempo" }],
        createdAt: 1,
      }).ok
    ).toBe(true);
  });

  test("refuses the tool role", () => {
    expect(
      checkMessageDoc({
        conversationId: "conversation-1",
        role: "tool",
        content: "",
        createdAt: 1,
      }).ok
    ).toBe(false);
  });

  test("refuses a javascript source URL", () => {
    expect(
      checkMessageDoc({
        conversationId: "conversation-1",
        role: "assistant",
        content: "Try this.",
        sources: [{ title: "Unsafe", site: "unsafe", url: "javascript:alert(1)" }],
        createdAt: 1,
      }).ok
    ).toBe(false);
  });

  test("keeps deletedAt on a soft-deleted message", () => {
    const result = checkMessageDoc({
      conversationId: "conversation-1",
      role: "user",
      content: "Old message",
      createdAt: 1,
      deletedAt: 2,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.deletedAt).toBe(2);
  });

  test.each(["councilResponse", "toolCalls"] as const)(
    "refuses nested arrays in %s",
    (field) => {
      expect(
        checkMessageDoc({
          conversationId: "conversation-1",
          role: "assistant",
          content: "Results",
          [field]: { rows: [[1, 2], [3, 4]] },
          createdAt: 1,
        }).ok
      ).toBe(false);
    }
  );

  test.each(["councilResponse", "toolCalls"] as const)(
    "accepts maps in arrays and arrays stored in maps for %s",
    (field) => {
      expect(
        checkMessageDoc({
          conversationId: "conversation-1",
          role: "assistant",
          content: "Results",
          [field]: [{ rows: [1, 2] }],
          createdAt: 1,
        }).ok
      ).toBe(true);
    }
  );
});
