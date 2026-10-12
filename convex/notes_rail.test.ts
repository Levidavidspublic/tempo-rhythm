import { describe, expect, test } from "bun:test";
import * as notes from "./notes";

/**
 * notes.listForRail: the v3 rail's bounded, metadata-only page list. A tiny in-memory ctx that
 * models the index calls the query makes: chained `eq`, `order("desc")` on updatedAt and `take`.
 */
type Row = Record<string, unknown>;

function makeCtx(userId: string | null, rows: Row[]) {
  function chain(selected: Row[]) {
    return {
      withIndex: (_index: string, build: (q: unknown) => unknown) => {
        const filters: [string, unknown][] = [];
        const q = {
          eq(field: string, value: unknown) {
            filters.push([field, value]);
            return q;
          },
        };
        build(q);
        return chain(selected.filter((row) => filters.every(([f, v]) => row[f] === v)));
      },
      order: (direction: "asc" | "desc") =>
        chain(
          [...selected].sort((a, b) =>
            direction === "desc"
              ? (b.updatedAt as number) - (a.updatedAt as number)
              : (a.updatedAt as number) - (b.updatedAt as number),
          ),
        ),
      take: async (n: number) => selected.slice(0, n),
      async *[Symbol.asyncIterator]() {
        yield* selected;
      },
      collect: async () => selected,
      first: async () => selected[0] ?? null,
      unique: async () => selected[0] ?? null,
    };
  }
  const users = userId ? [{ _id: userId, email: "maya@example.com" }] : [];
  return {
    auth: { getUserIdentity: async () => (userId ? { subject: userId } : null) },
    db: {
      get: async (id: string) => [...users, ...rows].find((r) => r._id === id) ?? null,
      query: (table: string) => chain(table === "users" ? users : rows),
      normalizeId: (_t: string, id: string) => id,
    },
  } as never;
}

function note(id: string, over: Partial<Row> = {}): Row {
  return {
    _id: `notes:${id}`,
    userId: "users:a",
    title: `Page ${id}`,
    body: `secret body ${id}`,
    pinned: false,
    periodType: "none",
    createdAt: 1,
    updatedAt: Number(id),
    ...over,
  };
}

const handler = (notes.listForRail as unknown as { _handler: (ctx: never, args: object) => Promise<Row[]> })._handler;

describe("notes.listForRail", () => {
  test("returns pinned pages first, then the most recent, without bodies", async () => {
    const rows = [note("1", { pinned: true }), note("5"), note("4"), note("3"), note("2")];
    const result = await handler(makeCtx("users:a", rows), { limit: 3 });
    expect(result.map((r) => r._id)).toEqual(["notes:1", "notes:5", "notes:4"]);
    for (const row of result) {
      expect(Object.keys(row).sort()).toEqual(["_id", "pinned", "title", "updatedAt"]);
    }
  });

  test("skips soft-deleted pages and other people's pages", async () => {
    const rows = [note("9", { deletedAt: 10 }), note("8", { userId: "users:b" }), note("7")];
    const result = await handler(makeCtx("users:a", rows), {});
    expect(result.map((r) => r._id)).toEqual(["notes:7"]);
  });

  test("recent soft-deleted pages never crowd out older live pages", async () => {
    const tombstones = Array.from({ length: 30 }, (_, i) => note(String(100 + i), { deletedAt: 200 + i }));
    const rows = [...tombstones, note("3"), note("2")];
    const result = await handler(makeCtx("users:a", rows), { limit: 8 });
    expect(result.map((r) => r._id)).toEqual(["notes:3", "notes:2"]);
  });

  test("with many pinned pages, the newest pins show (read in descending index order)", async () => {
    // Created oldest-first, so an ascending window would hold only the oldest pins.
    const rows = Array.from({ length: 30 }, (_, i) => note(String(i + 1), { pinned: true, createdAt: i + 1 }));
    const result = await handler(makeCtx("users:a", rows), { limit: 3 });
    expect(result.map((r) => r._id)).toEqual(["notes:30", "notes:29", "notes:28"]);
  });

  test("reads at most 2 * RAIL_PAGE_LIMIT_MAX documents, whatever the notebook holds", async () => {
    const rows = [
      ...Array.from({ length: 50 }, (_, i) => note(String(i + 1), { pinned: true, deletedAt: 500 + i })),
      ...Array.from({ length: 50 }, (_, i) => note(String(100 + i))),
    ];
    let read = 0;
    const ctx = makeCtx("users:a", rows) as unknown as { db: { query: (t: string) => unknown } };
    const query = ctx.db.query;
    ctx.db.query = (table: string) => {
      const counted = (q: Record<string, unknown>): Record<string, unknown> => ({
        ...q,
        withIndex: (i: string, b: unknown) => counted((q.withIndex as (i: string, b: unknown) => Record<string, unknown>)(i, b)),
        order: (d: string) => counted((q.order as (d: string) => Record<string, unknown>)(d)),
        take: async (n: number) => {
          const got = await (q.take as (n: number) => Promise<Row[]>)(n);
          if (table === "notes") read += got.length;
          return got;
        },
      });
      return counted(query(table) as Record<string, unknown>);
    };
    const result = await handler(ctx as never, { limit: 100 });
    expect(result).toHaveLength(notes.RAIL_PAGE_LIMIT_MAX);
    expect(read).toBeLessThanOrEqual(2 * notes.RAIL_PAGE_LIMIT_MAX);
  });

  test("a live pin behind newer pinned tombstones still shows among the newest live pages", async () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => note(String(50 + i), { pinned: true, deletedAt: 900 + i })),
      note("40", { pinned: true }),
      note("30"),
    ];
    const result = await handler(makeCtx("users:a", rows), { limit: 7 });
    expect(result.map((r) => r._id)).toEqual(["notes:40", "notes:30"]);
  });

  test("clamps the limit to 1..RAIL_PAGE_LIMIT_MAX", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => note(String(i + 1)));
    expect(await handler(makeCtx("users:a", rows), { limit: 500 })).toHaveLength(notes.RAIL_PAGE_LIMIT_MAX);
    expect(await handler(makeCtx("users:a", rows), { limit: 0 })).toHaveLength(1);
  });

  test("signed out is an error, not a list", async () => {
    await expect(handler(makeCtx(null, [note("1")]), {})).rejects.toThrow();
  });
});
