import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import schema from "./schema";
import { exportPage } from "./messages";

const modules = { "./_generated/server.ts": () => import("./_generated/server"),
  "./conversations.ts": () => import("./conversations"), "./messages.ts": () => import("./messages") };
async function world() {
  const t = convexTest(schema, modules);
  const [a, b, pending] = await t.run(async (ctx) => Promise.all([
    ctx.db.insert("users", { email: "bulk-a@example.test", approvalStatus: "approved" }),
    ctx.db.insert("users", { email: "bulk-b@example.test", approvalStatus: "approved" }),
    ctx.db.insert("users", { email: "bulk-pending@example.test", approvalStatus: "pending" }),
  ]));
  const owner = t.withIdentity({ subject: `${a}|bulk-session` }), other = t.withIdentity({ subject: `${b}|bulk-session` });
  const waiting = t.withIdentity({ subject: `${pending}|bulk-session` });
  const chat = (userId = a, extra = {}) => t.run((ctx) => ctx.db.insert("conversations", {
    userId, title: "Fictional # title שלום", createdAt: 1, updatedAt: 1, ...extra }));
  const message = (conversationId: Id<"conversations">, content = "Fictional content שלום", createdAt = 1, extra = {}) =>
    t.run((ctx) => ctx.db.insert("messages", { conversationId, role: "user", content, createdAt, ...extra }));
  return { t, a, b, pending, owner, other, waiting, chat, message };
}
const deletion = { kind: "delete" as const };
const archive = { kind: "archive" as const, archived: true };
const pageArgs = (conversationIds: Id<"conversations">[], numItems = 100) => ({ conversationIds, cursor: null, snapshot: null, numItems });
afterEach(() => setSystemTime());

describe.serial("KB-31 bounded bulk and export", () => {
  test("bulk accepts 50 distinct chats, rejects empty/51/duplicate selections", async () => {
    const w = await world(), ids = await Promise.all(Array.from({ length: 51 }, () => w.chat()));
    for (const selection of [[], ids, [ids[0]!, ids[0]!]]) await expect(w.owner.mutation(api.conversations.libraryBulk,
      { conversationIds: selection, operation: archive, requestKey: "bad" })).rejects.toThrow("invalid_selection");
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: ids.slice(0, 50), operation: archive, requestKey: "fifty" });
    expect(result.affected).toBe(50); expect(result.receipts).toHaveLength(50);
  });
  test("foreign member refuses the whole bulk without changing an earlier owned member", async () => {
    const w = await world(), own = await w.chat(), foreign = await w.chat(w.b);
    await expect(w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [own, foreign], operation: deletion, requestKey: "foreign" })).rejects.toThrow("unavailable");
    expect((await w.t.run((ctx) => ctx.db.get(own)))?.deletedAt).toBeUndefined();
  });
  test("anonymous and pending writes fail; foreign Undo and export stay unavailable", async () => {
    const w = await world(), id = await w.chat(), pendingId = await w.chat(w.pending);
    await expect(w.t.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: archive, requestKey: "anon" })).rejects.toThrow("unavailable");
    await expect(w.waiting.mutation(api.conversations.libraryBulk, { conversationIds: [pendingId], operation: archive, requestKey: "wait" })).rejects.toThrow("unavailable");
    await expect(w.waiting.mutation(api.conversations.undoLibraryBulk, { tokens: ["fake"] })).rejects.toThrow("unavailable");
    await expect(w.t.query(api.conversations.libraryUndoReceipts, { paginationOpts: { cursor: null, numItems: 50 } })).rejects.toThrow("unavailable");
    await expect(w.t.query(api.messages.exportPage, pageArgs([id]))).rejects.toThrow("unavailable");
    await expect(w.other.query(api.messages.exportPage, pageArgs([id]))).rejects.toThrow("unavailable");
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: archive, requestKey: "owned" });
    await expect(w.other.mutation(api.conversations.undoLibraryBulk, { tokens: result.receipts.map((r) => r.token) })).rejects.toThrow("unavailable");
  });
  test("delete tombstones parents only and preserves earlier parent/message deletion timestamps", async () => {
    const w = await world(), first = await w.chat(), old = await w.chat(w.a, { deletedAt: 123 });
    const message = await w.message(first), oldMessage = await w.message(first, "old", 2, { deletedAt: 456 });
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [first, old], operation: deletion, requestKey: "delete" });
    expect((await w.t.run((ctx) => ctx.db.get(first)))?.deletedAt).toBeNumber();
    expect((await w.t.run((ctx) => ctx.db.get(old)))?.deletedAt).toBe(123);
    expect((await w.t.run((ctx) => ctx.db.get(message)))?.deletedAt).toBeUndefined();
    expect((await w.t.run((ctx) => ctx.db.get(oldMessage)))?.deletedAt).toBe(456);
    await w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: result.receipts.map((r) => r.token) });
    expect((await w.t.run((ctx) => ctx.db.get(first)))?.deletedAt).toBeUndefined();
    expect((await w.t.run((ctx) => ctx.db.get(old)))?.deletedAt).toBe(123);
  });
  test("bulk retries return original receipts and a changed selection/payload conflicts", async () => {
    const w = await world(), ids = [await w.chat(), await w.chat()];
    const args = { conversationIds: ids, operation: deletion, requestKey: "retry" };
    const first = await w.owner.mutation(api.conversations.libraryBulk, args);
    expect(await w.owner.mutation(api.conversations.libraryBulk, args)).toEqual(first);
    await expect(w.owner.mutation(api.conversations.libraryBulk, { ...args, conversationIds: ids.slice(0, 1) })).rejects.toThrow("conflict");
    await expect(w.owner.mutation(api.conversations.libraryBulk, { ...args, operation: archive })).rejects.toThrow("conflict");
    expect((await w.t.run((ctx) => ctx.db.get(ids[0]!)))?.libraryReceipts).toHaveLength(1);
    const live = await w.chat();
    const archived = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [live], operation: archive, requestKey: "property-order" });
    expect(await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [live],
      operation: { archived: true, kind: "archive" }, requestKey: "property-order" })).toEqual(archived);
  });
  test("bulk tags normalize, replace and Undo preserves unrelated title changes", async () => {
    const w = await world(), id = await w.chat(w.a, { tags: ["Old"] });
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: { kind: "tags", tags: [" Straße ", "STRASSE"] }, requestKey: "tags" });
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.tags).toEqual(["Straße"]);
    await w.owner.mutation(api.conversations.updateTitle, { conversationId: id, title: "Renamed" });
    await w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: result.receipts.map((r) => r.token) });
    const restored = await w.t.run((ctx) => ctx.db.get(id));
    expect(restored?.tags).toEqual(["Old"]); expect(restored?.title).toBe("Renamed");
  });
  test("bulk Undo checks every receipt before restoring any member", async () => {
    const w = await world(), ids = [await w.chat(), await w.chat()];
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: ids, operation: archive, requestKey: "all" });
    await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: ids[1]!, tags: ["later"], requestKey: "later" });
    await expect(w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: result.receipts.map((r) => r.token) })).rejects.toThrow("conflict");
    expect((await w.t.run((ctx) => ctx.db.get(ids[0]!)))?.archivedAt).toBeNumber();
  });
  test("Undo succeeds through 300000ms and expires at 300001ms", async () => {
    const w = await world(), id = await w.chat(); setSystemTime(1_800_000_000_000);
    const first = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: archive, requestKey: "clock" });
    setSystemTime(first.receipts[0]!.undoUntilMs);
    await w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: first.receipts.map((r) => r.token) });
    const second = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: deletion, requestKey: "late" });
    setSystemTime(second.receipts[0]!.undoUntilMs + 1);
    await expect(w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: second.receipts.map((r) => r.token) })).rejects.toThrow("expired");
  });
  test("receipt capacity failure does not partially edit other chats", async () => {
    const w = await world(), free = await w.chat(), full = await w.chat();
    for (let i = 0; i < 32; i++) await w.owner.mutation(api.conversations.setLibraryMetadata, { conversationId: full, tags: [`tag${i}`], requestKey: `key${i}` });
    await expect(w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [free, full], operation: archive, requestKey: "cap" })).rejects.toThrow("receipt_limit");
    expect((await w.t.run((ctx) => ctx.db.get(free)))?.archivedAt).toBeUndefined();
  });
  test("invalid operation payload/key and malformed Undo tokens never write", async () => {
    const w = await world(), id = await w.chat();
    await expect(w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: { kind: "tags", tags: [""] }, requestKey: "empty" })).rejects.toThrow("invalid_tag");
    await expect(w.owner.mutation(api.conversations.libraryBulk, { conversationIds: [id], operation: archive, requestKey: "has spaces" })).rejects.toThrow("invalid_request_key");
    await expect(w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: [] })).rejects.toThrow("invalid_selection");
    await expect(w.owner.mutation(api.conversations.undoLibraryBulk, { tokens: ["not-a-token"] })).rejects.toThrow("unavailable");
    expect((await w.t.run((ctx) => ctx.db.get(id)))?.libraryRevision).toBeUndefined();
  });
  test("receipt query paginates deleted chats and excludes expired/consumed/foreign receipts", async () => {
    const w = await world(), ids = await Promise.all(Array.from({ length: 30 }, () => w.chat()));
    const result = await w.owner.mutation(api.conversations.libraryBulk, { conversationIds: ids, operation: deletion, requestKey: "receipt-list" });
    await w.owner.mutation(api.conversations.undoLibraryChange, { token: result.receipts[0]!.token });
    let cursor: string | null = null, count = 0;
    do {
      const page = await w.owner.query(api.conversations.libraryUndoReceipts, { paginationOpts: { cursor, numItems: 50 } });
      count += page.page.length; cursor = page.isDone ? null : page.continueCursor;
    } while (cursor);
    expect(count).toBe(29);
    expect((await w.other.query(api.conversations.libraryUndoReceipts, { paginationOpts: { cursor: null, numItems: 50 } })).page).toEqual([]);
    setSystemTime(result.receipts[0]!.undoUntilMs + 1);
    expect((await w.owner.query(api.conversations.libraryUndoReceipts, { paginationOpts: { cursor: null, numItems: 50 } })).page).toEqual([]);
  });
  test("export cap is 25; duplicate/empty selections and invalid sizes fail", async () => {
    const w = await world(), ids = await Promise.all(Array.from({ length: 26 }, () => w.chat()));
    for (const selection of [[], ids, [ids[0]!, ids[0]!]]) await expect(w.owner.query(api.messages.exportPage, pageArgs(selection))).rejects.toThrow("invalid_selection");
    await expect(w.owner.query(api.messages.exportPage, pageArgs([ids[0]!], 101))).rejects.toThrow("invalid_selection");
    expect((await w.owner.query(api.messages.exportPage, pageArgs(ids.slice(0, 25)))).records[0]?.kind).toBe("conversation");
  });
  test("JSON records use explicit allowlists and omit internal and system data", async () => {
    const w = await world(), id = await w.chat(w.a, { technique: "internal", libraryRevision: 7 });
    await w.message(id, "visible", 1, { modelUsed: "internal-model", toolCalls: { private: "private-marker" }, councilResponse: { raw: "raw-marker" },
      sources: [{ title: "Source", site: "example.test", url: "https://example.test/source" }] });
    await w.message(id, "system-marker", 2, { role: "system" });
    await w.message(id, "deleted-marker", 3, { deletedAt: 1 });
    const result = await w.owner.query(api.messages.exportPage, pageArgs([id]));
    expect(result.records).toHaveLength(2);
    expect(Object.keys(result.records[0]!).sort()).toEqual(["kind", "id", "title", "createdAt", "updatedAt", "folder", "tags", "pinnedAt", "archivedAt"].sort());
    expect(Object.keys(result.records[1]!).sort()).toEqual(["kind", "id", "conversationId", "role", "content", "createdAt", "sources"].sort());
    const json = JSON.stringify(result.records);
    for (const marker of ["userId", "modelUsed", "toolCalls", "libraryRevision", "system-marker", "deleted-marker", "private-marker", "raw-marker"]) expect(json).not.toContain(marker);
  });
  test("Markdown consumers receive original Unicode, plain titles and citation allowlists", async () => {
    const w = await world(), id = await w.chat(); await w.message(id, "**שלום** [source]", 1, { role: "assistant" });
    const { records } = await w.owner.query(api.messages.exportPage, pageArgs([id]));
    expect(records[0]?.kind === "conversation" && records[0].title).toBe("Fictional # title שלום");
    expect(records[1]?.kind === "message" && records[1].content).toBe("**שלום** [source]");
    expect(records[1]?.kind === "message" && records[1].sources).toEqual([]);
    // Formatting, escaping heading syntax and irreversible-download warning belong to the client ticket.
  });
  test("export continues through message 81 with one header and native oldest-first ordering", async () => {
    const w = await world(), id = await w.chat();
    await w.t.run(async (ctx) => { for (let i = 0; i < 105; i++) await ctx.db.insert("messages", { conversationId: id, role: "user", content: `row${i}`, createdAt: i }); });
    let cursor: string | null = null, snapshot: string | null = null, done = false, headers = 0;
    const content: string[] = [];
    while (!done) {
      const result = await w.owner.query(api.messages.exportPage, { ...pageArgs([id], 23), cursor, snapshot });
      for (const record of result.records) { if (record.kind === "conversation") headers++; else content.push(record.content); }
      cursor = result.cursor; snapshot = result.snapshot; done = result.isDone;
    }
    expect(headers).toBe(1); expect(content).toEqual(Array.from({ length: 105 }, (_, i) => `row${i}`));
  });
  test("direct selection reaches chat 201 without a global chat-list ceiling", async () => {
    const w = await world();
    const ids = await w.t.run(async (ctx) => { const result: Id<"conversations">[] = []; for (let i = 0; i < 201; i++) result.push(await ctx.db.insert("conversations", { userId: w.a, title: `Chat${i}`, createdAt: i, updatedAt: i })); return result; });
    await w.message(ids[0]!, "oldest chat");
    expect((await w.owner.query(api.messages.exportPage, pageArgs([ids[0]!]))).records).toHaveLength(2);
  });
  test("edits to any selected chat abort later export pages", async () => {
    const w = await world(), ids = [await w.chat(), await w.chat()];
    const first = await w.owner.query(api.messages.exportPage, pageArgs(ids, 1));
    await w.owner.mutation(api.conversations.updateTitle, { conversationId: ids[1]!, title: "Changed elsewhere" });
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs(ids, 1), cursor: first.cursor, snapshot: first.snapshot })).rejects.toThrow("export_changed");
  });
  test("old message deletion and same-clock append invalidate an export", async () => {
    const w = await world(), id = await w.chat(); setSystemTime(1_800_000_000_000);
    const old = await w.message(id, "older", 1); await w.message(id, "newer", 2);
    const first = await w.owner.query(api.messages.exportPage, pageArgs([id], 1));
    await w.owner.mutation(api.messages.remove, { messageId: old });
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs([id]), cursor: first.cursor, snapshot: first.snapshot })).rejects.toThrow("export_changed");
    const second = await w.owner.query(api.messages.exportPage, pageArgs([id], 1));
    await w.owner.mutation(api.messages.create, { conversationId: id, role: "user", content: "New" });
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs([id]), cursor: second.cursor, snapshot: second.snapshot })).rejects.toThrow("export_changed");
  });
  test("deleted selection aborts and mapped Agent chat rejects before any records", async () => {
    const w = await world(), id = await w.chat(), mapped = await w.chat(w.a, { agentThreadId: "fictional-agent-thread" });
    await expect(w.owner.query(api.messages.exportPage, pageArgs([id, mapped], 1))).rejects.toThrow("export_unsupported");
    const first = await w.owner.query(api.messages.exportPage, pageArgs([id], 1));
    await w.owner.mutation(api.conversations.remove, { conversationId: id });
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs([id]), cursor: first.cursor, snapshot: first.snapshot })).rejects.toThrow("export_changed");
  });
  test("cancel discards local state; snapshot/cursor bind owner, ordered selection and each other", async () => {
    const w = await world(), ids = [await w.chat(), await w.chat()];
    const first = await w.owner.query(api.messages.exportPage, pageArgs(ids, 1));
    expect((await w.owner.query(api.messages.exportPage, pageArgs(ids, 1))).records).toEqual(first.records);
    await expect(w.other.query(api.messages.exportPage, { ...pageArgs(ids), snapshot: first.snapshot, cursor: first.cursor })).rejects.toThrow("invalid_cursor");
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs([...ids].reverse()), snapshot: first.snapshot, cursor: first.cursor })).rejects.toThrow("invalid_cursor");
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs(ids), cursor: first.cursor })).rejects.toThrow("invalid_cursor");
    await expect(w.owner.query(api.messages.exportPage, { ...pageArgs(ids), snapshot: first.snapshot, cursor: "{}" })).rejects.toThrow("invalid_cursor");
  });
  test("empty/system-only slices retain continuation and equal-time rows are not duplicated", async () => {
    const w = await world(), id = await w.chat();
    await w.message(id, "hidden1", 1, { role: "system" }); await w.message(id, "hidden2", 1, { role: "system" });
    const first = await w.message(id, "first", 2), second = await w.message(id, "second", 2);
    let cursor: string | null = null, snapshot: string | null = null, done = false, empty = false;
    const seen: string[] = [];
    while (!done) {
      const result = await w.owner.query(api.messages.exportPage, { ...pageArgs([id], 1), cursor, snapshot });
      if (!result.records.length && !result.isDone) empty = true;
      for (const record of result.records) if (record.kind === "message") seen.push(record.id);
      cursor = result.cursor; snapshot = result.snapshot; done = result.isDone;
    }
    expect(empty).toBe(true); expect(seen).toEqual([first, second]);
  });
  test("export counts fence lookups within the 100-message / 25-chat budget", async () => {
    const w = await world(), ids = await Promise.all(Array.from({ length: 25 }, () => w.chat()));
    await w.t.run(async (ctx) => { for (let i = 0; i < 110; i++) await ctx.db.insert("messages", { conversationId: ids[0]!, role: "user", content: "row", createdAt: i }); });
    let messageReads = 0, chatReads = 0;
    function wrap(target: object): object {
      return new Proxy(target, { get(object, key) {
        const value = Reflect.get(object, key);
        if (key === Symbol.asyncIterator) return () => {
          const iterator = Reflect.apply(value, object, []) as AsyncIterator<unknown>;
          return { async next() { const item = await iterator.next(); if (!item.done) messageReads++; return item; },
            async return() { return iterator.return ? iterator.return() : { done: true as const, value: undefined }; }, [Symbol.asyncIterator]() { return this; } };
        };
        if (key === "first") return async () => { const result = await Reflect.apply(value, object, []); messageReads++; return result; };
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => { const result = Reflect.apply(value, object, args); return ["withIndex", "order", "filter"].includes(String(key)) ? wrap(result as object) : result; };
      } });
    }
    await w.owner.run(async (ctx) => {
      const db = new Proxy(ctx.db, { get(target, key) {
        if (key === "query") return (table: Parameters<typeof target.query>[0]) => wrap(target.query(table));
        if (key === "get") return async (...args: Parameters<typeof target.get>) => { const result = await target.get(...args); if (result && "title" in result && "userId" in result) chatReads++; return result; };
        const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
      } });
      const handler = (exportPage as unknown as { _handler: (context: QueryCtx, input: unknown) => Promise<unknown> })._handler;
      await handler({ ...ctx, db }, pageArgs(ids));
    });
    expect(chatReads).toBe(25); expect(messageReads).toBe(100);
  });
});
