import { describe, expect, test } from "bun:test";
import {
  buildChatMessages,
  historyBeforeTurn,
  pickTopMemories,
  takeLiveMemories,
  truncateForStorage,
} from "./chatPrompt";

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

describe("truncateForStorage", () => {
  test("returns text that fits, including text exactly at the limit, untouched", () => {
    expect(truncateForStorage("short", 10)).toBe("short");
    expect(truncateForStorage("a".repeat(10), 10)).toBe("a".repeat(10));
  });

  test("cuts longer text to the limit and ends with a visible marker", () => {
    const out = truncateForStorage("a".repeat(50), 10);
    expect(out).toBe(`${"a".repeat(9)}…`);
    expect(out).toHaveLength(10);
  });

  test("never splits a surrogate pair at the cut", () => {
    // 4 emoji = 8 units; max 6 leaves 5 units before the marker, which would end on a lone high surrogate.
    const out = truncateForStorage("😀😀😀😀", 6);
    expect(out).toBe("😀😀…");
    expect(out).toHaveLength(5);
    expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
  });

  test("is deterministic, so a retry of the same text matches the stored copy", () => {
    const text = "word ".repeat(2000).trim();
    expect(truncateForStorage(text, 4000)).toBe(truncateForStorage(text, 4000));
  });
});

describe("takeLiveMemories", () => {
  type Row = { content: string; deletedAt?: number };

  /** An async iterable that records how many rows the consumer pulled. */
  function source(rows: Row[]) {
    const state = { pulled: 0 };
    const iterable: AsyncIterable<Row> = {
      async *[Symbol.asyncIterator]() {
        for (const row of rows) {
          state.pulled += 1;
          yield row;
        }
      },
    };
    return { iterable, state };
  }

  const live = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ content: `live ${i}` }));
  const deleted = (n: number): Row[] =>
    Array.from({ length: n }, (_, i) => ({ content: `deleted ${i}`, deletedAt: 1 }));

  test("skips soft-deleted rows and stops after the live limit", async () => {
    const { iterable, state } = source([...deleted(3), ...live(10)]);
    const out = await takeLiveMemories(iterable, 4, 100);
    expect(out.map((row) => row.content)).toEqual(["live 0", "live 1", "live 2", "live 3"]);
    expect(state.pulled).toBe(7);
  });

  test("finds live rows behind more deleted rows than the live limit", async () => {
    const { iterable, state } = source([...deleted(300), ...live(2)]);
    const out = await takeLiveMemories(iterable, 20, 500);
    expect(out.map((row) => row.content)).toEqual(["live 0", "live 1"]);
    expect(state.pulled).toBe(302);
  });

  test("stops at the scan limit even when no live row was found", async () => {
    const { iterable, state } = source([...deleted(50), ...live(5)]);
    expect(await takeLiveMemories(iterable, 20, 10)).toEqual([]);
    expect(state.pulled).toBe(10);
  });

  test("a live row at the last scanned position is still kept", async () => {
    const { iterable, state } = source([...deleted(9), ...live(3)]);
    const out = await takeLiveMemories(iterable, 20, 10);
    expect(out.map((row) => row.content)).toEqual(["live 0"]);
    expect(state.pulled).toBe(10);
  });

  test("reads nothing for a zero limit", async () => {
    const { iterable, state } = source(live(3));
    expect(await takeLiveMemories(iterable, 0, 10)).toEqual([]);
    expect(await takeLiveMemories(iterable, 5, 0)).toEqual([]);
    expect(state.pulled).toBe(0);
  });
});
