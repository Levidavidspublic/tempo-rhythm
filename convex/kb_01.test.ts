import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import schema from "./schema";
import { libraryFold, libraryMatch, libraryTags } from "./messages";
import * as conversationFunctions from "./conversations";
import * as messageFunctions from "./messages";

const modules = {
  "./_generated/server.ts": () => import("./_generated/server"),
  "./conversations.ts": () => import("./conversations"),
  "./messages.ts": () => import("./messages"),
};
async function world() {
  const t = convexTest(schema, modules);
  const [a, b, pending] = await t.run(async (ctx) => Promise.all([
    ctx.db.insert("users", { email: "library-a@example.test", approvalStatus: "approved" }),
    ctx.db.insert("users", { email: "library-b@example.test", approvalStatus: "approved" }),
    ctx.db.insert("users", { email: "library-pending@example.test", approvalStatus: "pending" }),
  ]));
  const owner = t.withIdentity({ subject: `${a}|library-session` });
  const other = t.withIdentity({ subject: `${b}|library-session` });
  const waiting = t.withIdentity({ subject: `${pending}|library-session` });
  const addChat = async (title = "Fictional chat", userId = a, extra = {}) => t.run((ctx) =>
    ctx.db.insert("conversations", { userId, title, createdAt: 1, updatedAt: 1, ...extra }));
  const addMessage = async (conversationId: Id<"conversations">, content: string, createdAt = 1, extra = {}) =>
    t.run((ctx) => ctx.db.insert("messages", { conversationId, role: "user", content, createdAt, ...extra }));
  return { t, owner, other, waiting, a, b, pending, addChat, addMessage };
}
const opts = (cursor: string | null = null, numItems = 50) => ({ cursor, numItems });
afterEach(() => setSystemTime());

describe.serial("KB-01 bounded chat library", () => {
  test("every new read rejects anonymous identity without leaking ids", async () => {
    const w = await world(), id = await w.addChat();
    await expect(w.t.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts() })).rejects.toThrow("unavailable");
    await expect(w.t.query(api.messages.historyPage, { conversationId: id, paginationOpts: opts() })).rejects.toThrow("unavailable");
    await expect(w.t.query(api.messages.searchPage, { query: "chat", filters: {}, paginationOpts: opts() })).rejects.toThrow("unavailable");
  });

  test("foreign history, metadata and receipt access share unavailable; library/search never leak", async () => {
    const w = await world(), id = await w.addChat("Private fictional title");
    await w.addMessage(id, "Private fictional message");
    const receipt = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["Mine"], requestKey: "owned" });
    await expect(w.other.query(api.messages.historyPage, { conversationId: id, paginationOpts: opts() })).rejects.toThrow("unavailable");
    await expect(w.other.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: [], requestKey: "foreign" })).rejects.toThrow("unavailable");
    await expect(w.other.mutation(api.conversations.undoLibraryChange, { token: receipt.token })).rejects.toThrow("unavailable");
    expect((await w.other.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts() })).page).toEqual([]);
    expect((await w.other.query(api.messages.searchPage, { query: "Private", filters: {}, paginationOpts: opts() })).page).toEqual([]);
  });

  test("pending accounts cannot edit or undo even their own library metadata", async () => {
    const w = await world(), id = await w.addChat("Waiting", w.pending);
    await expect(w.waiting.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["x"], requestKey: "pending" })).rejects.toThrow("unavailable");
    await expect(w.waiting.mutation(api.conversations.undoLibraryChange, { token: "not-a-receipt" })).rejects.toThrow("unavailable");
  });

  test("library continues past chat 200, includes empty chats, and never leaks internal fields", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 201; i++) await ctx.db.insert("conversations", { userId: w.a, title: `Fictional ${i}`, createdAt: i, updatedAt: i });
    });
    let cursor: string | null = null, count = 0, done = false;
    while (!done) {
      const result = await w.owner.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(cursor) });
      count += result.page.length;
      expect(result.page.length).toBeLessThanOrEqual(24);
      for (const chat of result.page) { expect(chat).not.toHaveProperty("userId"); expect(chat.folder).toBeNull(); expect(chat.pinnedAt).toBeNull(); }
      cursor = result.continueCursor; done = result.isDone;
    }
    expect(count).toBe(201);
  });

  test("history and search reach message 81 and do not expose system/deleted rows", async () => {
    const w = await world(), id = await w.addChat("Archive fixture");
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 101; i++) await ctx.db.insert("messages", { conversationId: id, role: "user", content: i === 0 ? "old needle" : "ordinary", createdAt: i });
      await ctx.db.insert("messages", { conversationId: id, role: "system", content: "secret needle", createdAt: 999 });
      await ctx.db.insert("messages", { conversationId: id, role: "assistant", content: "deleted needle", createdAt: 998, deletedAt: 2 });
    });
    let cursor: string | null = null, found = false, rounds = 0;
    do {
      const result = await w.owner.query(api.messages.searchPage, { query: "needle", filters: {}, paginationOpts: opts(cursor) });
      for (const hit of result.page) {
        expect(hit.message?.content).toBe("old needle"); found = true;
        const history = await w.owner.query(api.messages.historyPage, { conversationId: id, paginationOpts: opts(hit.historyCursor, 1) });
        expect(history.page[0]?.id).toBe(hit.message?.id);
      }
      cursor = result.isDone ? null : result.continueCursor;
      expect(++rounds).toBeLessThan(10);
    } while (cursor);
    expect(found).toBe(true);
  });

  test("search reaches a matching message in chat 201", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 201; i++) {
        const id = await ctx.db.insert("conversations", { userId: w.a, title: "Ordinary", createdAt: i, updatedAt: i });
        if (i === 0) await ctx.db.insert("messages", { conversationId: id, role: "assistant", content: "beyond-two-hundred", createdAt: 1 });
      }
    });
    let cursor: string | null = null, found = false, rounds = 0;
    do {
      const result = await w.owner.query(api.messages.searchPage, { query: "beyond-two-hundred", filters: {}, paginationOpts: opts(cursor) });
      found ||= result.page.some((hit) => hit.message?.content === "beyond-two-hundred");
      cursor = result.isDone ? null : result.continueCursor;
      expect(++rounds).toBeLessThan(210);
    } while (cursor);
    expect(found).toBe(true);
  }, 15_000);

  test("empty filtered slices keep a continuation", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) await ctx.db.insert("conversations", { userId: w.a, title: "Fictional", createdAt: i, updatedAt: i, ...(i === 0 ? { tags: ["target"] } : {}) });
    });
    const first = await w.owner.query(api.conversations.libraryPage, { filters: { tags: ["target"] }, paginationOpts: opts() });
    expect(first.page).toEqual([]); expect(first.isDone).toBe(false); expect(first.continueCursor).not.toBe("");
    const next = await w.owner.query(api.conversations.libraryPage, { filters: { tags: ["target"] }, paginationOpts: opts(first.continueCursor) });
    expect(next.page).toHaveLength(1);
  });

  test("cursor refuses changed owner, kind, filters, query and malformed keys", async () => {
    const w = await world();
    await w.addChat("A"); await w.addChat("B");
    const first = await w.owner.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(null, 1) });
    await expect(w.other.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(first.continueCursor) })).rejects.toThrow("invalid_cursor");
    await expect(w.owner.query(api.conversations.libraryPage, { filters: { pinned: true }, paginationOpts: opts(first.continueCursor) })).rejects.toThrow("invalid_cursor");
    await expect(w.owner.query(api.messages.searchPage, { query: "A", filters: {}, paginationOpts: opts(first.continueCursor) })).rejects.toThrow("invalid_cursor");
    const tampered = JSON.parse(first.continueCursor); tampered.chatKey[0] = w.b;
    await expect(w.owner.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(JSON.stringify(tampered)) })).rejects.toThrow("invalid_cursor");
    const search = await w.owner.query(api.messages.searchPage, { query: "A", filters: {}, paginationOpts: opts() });
    await expect(w.owner.query(api.messages.searchPage, { query: "B", filters: {}, paginationOpts: opts(search.continueCursor) })).rejects.toThrow("invalid_cursor");
  });

  test("NFC Hebrew and expanding folds return complete original UTF-16 spans", () => {
    expect(libraryMatch("x Straße y", libraryFold("STRASSE"))).toEqual({ matchStart: 2, matchEnd: 8 });
    expect(libraryMatch("x cafe\u0301 y", libraryFold("CAFÉ"))).toEqual({ matchStart: 2, matchEnd: 7 });
    expect(libraryMatch("x ש\u05C1\u05B8לוֹם y", libraryFold("ש\u05B8\u05C1לוֹם"))).toEqual({ matchStart: 2, matchEnd: 9 });
    expect(libraryFold("ςΣσ ßẞ ﬃ İ ı")).toBe("σσσ ssss ffi i\u0307 ı");
    expect(libraryFold("Ꭰꭰ")).toBe("ᎠᎠ");
  });

  test("title hits use original title offsets and a null message/history cursor", async () => {
    const w = await world(); await w.addChat("A Straße journal");
    const result = await w.owner.query(api.messages.searchPage, { query: "STRASSE", filters: {}, paginationOpts: opts(null, 1) });
    expect(result.page[0]).toMatchObject({ message: null, historyCursor: null, matchStart: 2, matchEnd: 8 });
  });

  test("tags normalize, dedupe, enforce Unicode-codepoint length and reject controls", () => {
    expect(libraryTags(["  Work  ", "work", "Cafe\u0301", "CAFÉ", "two   words"])).toEqual(["Work", "Café", "two words"]);
    expect(libraryTags(["😀".repeat(32)])).toEqual(["😀".repeat(32)]);
    for (const tags of [[""], ["\n"], ["a\u200Db"], ["😀".repeat(33)], Array.from({ length: 11 }, (_, i) => `tag${i}`)]) expect(() => libraryTags(tags)).toThrow("invalid_tag");
  });

  test("archive leaves active coach list but remains readable and filterable; undo restores", async () => {
    const w = await world(), id = await w.addChat();
    const receipt = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, archived: true, requestKey: "archive" });
    expect((await w.owner.query(api.conversations.list, {}))).toEqual([]);
    expect((await w.owner.query(api.conversations.get, { conversationId: id }))._id).toBe(id);
    expect((await w.owner.query(api.conversations.libraryPage, { filters: { archive: "archived" }, paginationOpts: opts() })).page).toHaveLength(1);
    await w.owner.mutation(api.conversations.undoLibraryChange, { token: receipt.token });
    expect((await w.owner.query(api.conversations.list, {}))).toHaveLength(1);
  });

  test("idempotent key returns original receipt; different payload even same effect conflicts", async () => {
    const w = await world(), id = await w.addChat();
    const args = { conversationId: id, tags: ["One"], requestKey: "once" };
    const first = await w.owner.mutation(api.conversations.setLibraryMetadata, args);
    const again = await w.owner.mutation(api.conversations.setLibraryMetadata, args);
    expect(again).toEqual(first);
    await expect(w.owner.mutation(api.conversations.setLibraryMetadata, { ...args, archived: false })).rejects.toThrow("conflict");
    await expect(w.owner.mutation(api.conversations.setLibraryMetadata, { ...args, tags: [" One "] })).rejects.toThrow("conflict");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.libraryReceipts).toHaveLength(1);
  });

  test("undo at 299999ms succeeds; at 300001ms expires", async () => {
    const w = await world(), id = await w.addChat();
    const now = 1_800_000_000_000; setSystemTime(now);
    const first = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["A"], requestKey: "before" });
    setSystemTime(now + 299_999);
    await w.owner.mutation(api.conversations.undoLibraryChange, { token: first.token });
    const second = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["B"], requestKey: "after" });
    setSystemTime(second.undoUntilMs + 1);
    await expect(w.owner.mutation(api.conversations.undoLibraryChange, { token: second.token })).rejects.toThrow("expired");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.tags).toEqual(["B"]);
  });

  test("intervening metadata edit or deletion refuses undo atomically", async () => {
    const w = await world(), id = await w.addChat();
    const first = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["A"], requestKey: "one" });
    await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["B"], requestKey: "two" });
    await expect(w.owner.mutation(api.conversations.undoLibraryChange, { token: first.token })).rejects.toThrow("conflict");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.tags).toEqual(["B"]);
    const third = await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, archived: true, requestKey: "three" });
    await w.owner.mutation(api.conversations.remove, { conversationId: id });
    await expect(w.owner.mutation(api.conversations.undoLibraryChange, { token: third.token })).rejects.toThrow("conflict");
  });

  test("receipt cap refuses edit without losing Undo; expired receipts prune on explicit write", async () => {
    const w = await world(), id = await w.addChat(); setSystemTime(1_800_000_000_000);
    for (let i = 0; i < 32; i++) await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: [`tag${i}`], requestKey: `key${i}` });
    await expect(w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["overflow"], requestKey: "extra" })).rejects.toThrow("receipt_limit");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.tags).toEqual(["tag31"]);
    setSystemTime(1_800_000_300_001);
    await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: ["fresh"], requestKey: "fresh" });
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.libraryReceipts).toHaveLength(1);
  });

  test("invalid keys and filters do not write", async () => {
    const w = await world(), id = await w.addChat();
    for (const requestKey of ["", "has space", "x".repeat(129)]) await expect(w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: id, tags: [], requestKey })).rejects.toThrow("invalid_request_key");
    await expect(w.owner.query(api.conversations.libraryPage, { filters: { fromMs: 2, beforeMs: 1 }, paginationOpts: opts() })).rejects.toThrow("invalid_filter");
    await expect(w.owner.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(null, 51) })).rejects.toThrow("invalid_filter");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.libraryRevision).toBeUndefined();
  });

  test("deleted parent excludes all messages; mapped legacy history states coverage", async () => {
    const w = await world(), id = await w.addChat("Mapped", w.a, { agentThreadId: "fixture-agent-thread" });
    await w.addMessage(id, "Legacy content");
    const history = await w.owner.query(api.messages.historyPage, { conversationId: id, paginationOpts: opts() });
    expect(history.coverage).toBe("legacy_only"); expect(history.page).toHaveLength(1);
    const searched = await w.owner.query(api.messages.searchPage, { query: "Legacy", filters: {}, paginationOpts: opts() });
    expect(searched.coverage).toBe("legacy_only"); expect(searched.page).toHaveLength(1);
    await w.owner.mutation(api.conversations.remove, { conversationId: id });
    await expect(w.owner.query(api.messages.historyPage, { conversationId: id, paginationOpts: opts() })).rejects.toThrow("unavailable");
    expect((await w.owner.query(api.messages.searchPage, { query: "Legacy", filters: {}, paginationOpts: opts() })).page).toEqual([]);
  });

  test("equal timestamps cross page boundaries in native order without duplicates or gaps", async () => {
    const w = await world(), ids: string[] = [];
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 32; i++) ids.push(await ctx.db.insert("conversations", { userId: w.a, title: `Tie ${i}`, createdAt: 1, updatedAt: 1 }));
    });
    let cursor: string | null = null; const seen: string[] = [];
    do {
      const result = await w.owner.query(api.conversations.libraryPage, { filters: {}, paginationOpts: opts(cursor, 3) });
      seen.push(...result.page.map((row) => row.id)); cursor = result.isDone ? null : result.continueCursor;
    } while (cursor);
    expect(seen).toHaveLength(32); expect(new Set(seen).size).toBe(32); expect(new Set(seen)).toEqual(new Set(ids));
  });

  test("date, all-tag, archive and pinned filters intersect instead of widening", async () => {
    const w = await world();
    await w.addChat("Match", w.a, { tags: ["Work", "Café"], updatedAt: 10 });
    await w.addChat("Missing tag", w.a, { tags: ["Work"], updatedAt: 10 });
    await w.addChat("Before", w.a, { tags: ["Work", "Café"], updatedAt: 9 });
    await w.addChat("Exclusive end", w.a, { tags: ["Work", "Café"], updatedAt: 20 });
    await w.addChat("Archived", w.a, { tags: ["Work", "Café"], updatedAt: 10, archivedAt: 1 });
    const result = await w.owner.query(api.conversations.libraryPage, { filters: { tags: ["WORK", "Cafe\u0301"], fromMs: 10, beforeMs: 20, pinned: false }, paginationOpts: opts() });
    expect(result.page.map((row) => row.title)).toEqual(["Match"]);
  });

  test("instrumented real index iterators stay within 25 conversation and 100 message reads", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) await ctx.db.insert("conversations", { userId: w.a, title: "Fictional", createdAt: i, updatedAt: i });
    });
    const current = await w.addChat("Current", w.a, { updatedAt: 100 });
    await w.t.run(async (ctx) => {
      for (let i = 0; i < 110; i++) await ctx.db.insert("messages", { conversationId: current, role: "user", content: "needle", createdAt: i });
    });
    const reads = new Map<string, number>();
    function wrap(target: object, table: string): object {
      return new Proxy(target, { get(object, key) {
        const value = Reflect.get(object, key);
        if (key === Symbol.asyncIterator) return () => {
          const iterator = Reflect.apply(value, object, []) as AsyncIterator<unknown>;
          return { async next() { const item = await iterator.next(); if (!item.done) reads.set(table, (reads.get(table) ?? 0) + 1); return item; },
            async return() { return iterator.return ? iterator.return() : { done: true as const, value: undefined }; },
            [Symbol.asyncIterator]() { return this; } };
        };
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const result = Reflect.apply(value, object, args);
          return ["withIndex", "order", "filter"].includes(String(key)) ? wrap(result as object, table) : result;
        };
      } });
    }
    const invoke = async (registered: unknown, args: unknown) => w.owner.run(async (ctx) => {
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key === "query") return (table: Parameters<typeof target.query>[0]) => wrap(target.query(table), table);
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
      } });
      const handler = (registered as { _handler: (context: QueryCtx, input: unknown) => Promise<unknown> })._handler;
      return handler({ ...ctx, db }, args);
    });
    await invoke(conversationFunctions.libraryPage, { filters: {}, paginationOpts: opts() });
    expect(reads.get("conversations")).toBeLessThanOrEqual(25);
    expect(reads.get("conversations")).toBeGreaterThan(0);
    reads.clear();
    await invoke(messageFunctions.searchPage, { query: "needle", filters: {}, paginationOpts: opts() });
    expect(reads.get("conversations")).toBeLessThanOrEqual(25);
    expect(reads.get("messages")).toBeLessThanOrEqual(100);
    expect(reads.get("messages")).toBeGreaterThan(0);
  });
});
