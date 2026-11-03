import { describe, expect, test } from "bun:test";
import * as feedback from "./feedback";

function makeCtx(identity: { subject: string; email?: string } | null = { subject: "users:a" }) {
  const rows: Record<string, unknown>[] = [];
  const users = [{ _id: "users:a", email: "a@example.com" }, { _id: "users:b", email: "b@example.com" }];
  const match = (list: Record<string, unknown>[]) => ({
    withIndex: (_n: string, m: (q: { eq: (f: string, v: unknown) => [string, unknown] }) => [string, unknown]) => {
      const [f, val] = m({ eq: (f, v) => [f, v] });
      return match(list.filter((r) => r[f] === val));
    },
    collect: async () => list,
    unique: async () => list[0] ?? null,
    first: async () => list[0] ?? null,
  });
  return {
    rows,
    ctx: {
      auth: { getUserIdentity: async () => identity },
      db: {
        get: async (id: string) => users.find((u) => u._id === id) ?? null,
        normalizeId: (_t: string, id: string) => (users.some((u) => u._id === id) ? id : null),
        insert: async (_t: string, doc: Record<string, unknown>) => {
          rows.push({ _id: `feedback:${rows.length + 1}`, ...doc });
          return `feedback:${rows.length}`;
        },
        query: (t: string) => match(t === "users" ? (users as Record<string, unknown>[]) : rows),
      },
    } as any,
  };
}

describe("feedback", () => {
  test("send stores a trimmed message for the signed-in user", async () => {
    const { ctx, rows } = makeCtx();
    await (feedback.send as any)._handler(ctx, { message: "  hello Amit  ", page: "/ask-founder" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: "users:a", message: "hello Amit", page: "/ask-founder" });
  });

  test("rejects empty and over-long messages", async () => {
    const { ctx, rows } = makeCtx();
    await expect((feedback.send as any)._handler(ctx, { message: "   " })).rejects.toThrow();
    await expect((feedback.send as any)._handler(ctx, { message: "x".repeat(2001) })).rejects.toThrow();
    expect(rows).toHaveLength(0);
  });

  test("rate limits to 10 a day", async () => {
    const { ctx, rows } = makeCtx();
    for (let i = 0; i < 10; i++) await (feedback.send as any)._handler(ctx, { message: `m${i}` });
    await expect((feedback.send as any)._handler(ctx, { message: "one more" })).rejects.toThrow();
    expect(rows).toHaveLength(10);
  });

  test("listMine returns only my messages, newest first", async () => {
    const { ctx, rows } = makeCtx();
    rows.push(
      { _id: "f1", userId: "users:a", message: "old", createdAt: 1, page: "/" },
      { _id: "f2", userId: "users:b", message: "theirs", createdAt: 2, page: "/" },
      { _id: "f3", userId: "users:a", message: "new", createdAt: 3, page: "/" },
    );
    const out = await (feedback.listMine as any)._handler(ctx, {});
    expect(out.map((r: { message: string }) => r.message)).toEqual(["new", "old"]);
  });

  test("requires sign-in", async () => {
    const { ctx } = makeCtx(null);
    await expect((feedback.send as any)._handler(ctx, { message: "hi" })).rejects.toThrow();
    await expect((feedback.listMine as any)._handler(ctx, {})).rejects.toThrow();
  });
});
