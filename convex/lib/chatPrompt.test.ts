import { describe, expect, test } from "bun:test";
import { buildChatMessages, historyBeforeTurn, pickTopMemories } from "./chatPrompt";

describe("buildChatMessages", () => {
  test("includes memories between the instructions and history", () => {
    const messages = buildChatMessages({
      history: [{ role: "assistant", content: "Earlier reply" }],
      memories: [{ content: "Prefers short checklists" }],
      userText: "Help me start",
      now: 0,
    });

    expect(messages[1]?.content).toContain("What you know about this person:");
    expect(messages[1]?.content).toContain("Prefers short checklists");
    expect(messages.map((message) => message.content)).toEqual([
      expect.stringContaining("warm and calm"),
      expect.stringContaining("Prefers short checklists"),
      "Earlier reply",
      "Help me start",
    ]);
  });

  test("omits the memories block when there are no usable memories", () => {
    const messages = buildChatMessages({
      history: [],
      memories: [{ content: "   " }],
      userText: "Hello",
      now: 0,
    });
    expect(messages).toHaveLength(2);
    expect(messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  test("preserves history order before the new user text", () => {
    const messages = buildChatMessages({
      history: [
        { role: "user", content: "first" },
        { role: "assistant", content: "second" },
        { role: "user", content: "third" },
      ],
      memories: [],
      userText: "fourth",
      now: 0,
    });
    expect(messages.slice(1).map((message) => message.content)).toEqual([
      "first",
      "second",
      "third",
      "fourth",
    ]);
  });

  test("caps memory text at 3000 characters", () => {
    const messages = buildChatMessages({
      history: [],
      memories: [{ content: "a".repeat(4000) }, { content: "must not appear" }],
      userText: "Hello",
      now: 0,
    });
    const block = messages[1]?.content ?? "";
    const memoryText = block.slice(block.indexOf("\n") + 1);
    expect(memoryText.length).toBeLessThanOrEqual(3000);
    expect(block).not.toContain("must not appear");
  });
});

describe("pickTopMemories", () => {
  const memory = (content: string, salience: number, updatedAt = 0, deletedAt?: number) => ({
    content,
    salience,
    updatedAt,
    deletedAt,
  });

  test("keeps the highest-salience live memories, newest update first on ties", () => {
    const rows = [
      memory("low", 1),
      memory("tie old", 5, 1),
      memory("top", 9),
      memory("tie new", 5, 2),
      memory("gone", 100, 0, 7),
    ];
    expect(pickTopMemories(rows, 3)).toEqual([
      { content: "top" },
      { content: "tie new" },
      { content: "tie old" },
    ]);
  });

  test("returns only the limit from a larger set and leaves its input unmodified in size", () => {
    const rows = Array.from({ length: 200 }, (_, i) => memory(`m${i}`, i));
    const picked = pickTopMemories(rows, 20);
    expect(picked).toHaveLength(20);
    expect(picked[0]).toEqual({ content: "m199" });
    expect(picked[19]).toEqual({ content: "m180" });
    expect(rows).toHaveLength(200);
  });
});

describe("historyBeforeTurn", () => {
  test("drops the trailing copy of the current user turn", () => {
    const history = [
      { role: "assistant" as const, content: "Earlier reply" },
      { role: "user" as const, content: "Help me start" },
    ];
    expect(historyBeforeTurn(history, " Help me start ")).toEqual([history[0]]);
  });

  test("keeps history whose last item is not this turn", () => {
    const history = [
      { role: "user" as const, content: "ok" },
      { role: "assistant" as const, content: "ok" },
    ];
    expect(historyBeforeTurn(history, "ok")).toEqual(history);
    expect(historyBeforeTurn([], "ok")).toEqual([]);
  });

  test("only strips one copy, so a repeated earlier message survives", () => {
    const history = [
      { role: "user" as const, content: "ok" },
      { role: "user" as const, content: "ok" },
    ];
    expect(historyBeforeTurn(history, "ok")).toEqual([history[0]]);
  });
});
