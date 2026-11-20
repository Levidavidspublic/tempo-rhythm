import { describe, expect, test } from "bun:test";
import { checkConversationDoc, type ConversationDoc } from "../firestore-docs/conversation-doc";
import { planThreadRename } from "./thread-rename";

const conversation: ConversationDoc = {
  title: "Old title",
  agentThreadId: "server-thread",
  nextChatSequence: 4,
  chatGenerationEpoch: 2,
  activeChatRequestId: "request-1",
  createdAt: 10,
  updatedAt: 20,
};

describe("planThreadRename", () => {
  test("plans a rename with only client-owned changed fields", () => {
    expect(planThreadRename(conversation, "New title", 30)).toEqual({
      ok: true,
      unchanged: false,
      patch: { title: "New title", updatedAt: 30 },
      changedFields: ["title", "updatedAt"],
    });
  });

  test("collapses and trims whitespace into a valid conversation patch", () => {
    const result = planThreadRename(conversation, "  Weekly\n\t review  ", 30);
    expect(result.ok).toBe(true);
    if (!result.ok || result.unchanged) throw new Error("expected a changed rename plan");

    expect(result.patch.title).toBe("Weekly review");
    expect(checkConversationDoc({ ...conversation, ...result.patch }).ok).toBe(true);
  });

  test("shortens long titles without splitting a surrogate pair", () => {
    const result = planThreadRename(conversation, `${"a".repeat(199)}😀more`, 30);
    expect(result).toMatchObject({ ok: true, unchanged: false });
    if (!result.ok || result.unchanged) throw new Error("expected a changed rename plan");
    expect(result.patch.title).toBe("a".repeat(199));
    expect(result.patch.title.length).toBeLessThanOrEqual(200);
  });

  test("returns unchanged after cleaning the title", () => {
    expect(planThreadRename(conversation, "  Old   title ", 30)).toEqual({
      ok: true,
      unchanged: true,
    });
  });

  test("refuses an empty cleaned title", () => {
    expect(planThreadRename(conversation, " \n\t ", 30)).toEqual({
      ok: false,
      reason: "empty-title",
    });
  });

  test("refuses deleted threads and non-finite times", () => {
    expect(planThreadRename({ ...conversation, deletedAt: 25 }, "New title", 30)).toEqual({
      ok: false,
      reason: "deleted",
    });
    expect(planThreadRename(conversation, "New title", Number.NaN)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  });
});
