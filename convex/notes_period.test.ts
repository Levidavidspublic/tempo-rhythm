import { describe, expect, test } from "bun:test";
import * as notes from "./notes";

/**
 * notes.getPeriodPage / notes.ensurePeriodPage: dated daily and weekly pages (decision 6).
 * A tiny in-memory ctx that models the calls these functions make: chained `eq` on an index,
 * `first`, and `insert`.
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
      first: async () => selected[0] ?? null,
      unique: async () => selected[0] ?? null,
      collect: async () => selected,
      take: async (n: number) => selected.slice(0, n),
    };
  }
  const users = userId ? [{ _id: userId, email: "maya@example.com" }] : [];
  let next = 1;
  return {
    auth: { getUserIdentity: async () => (userId ? { subject: userId } : null) },
    db: {
      get: async (id: string) => [...users, ...rows].find((r) => r._id === id) ?? null,
      query: (table: string) => chain(table === "users" ? users : rows),
      normalizeId: (_t: string, id: string) => id,
      insert: async (_table: string, doc: Row) => {
        const _id = `notes:new${next++}`;
        rows.push({ _id, ...doc });
        return _id;
      },
    },
  } as never;
}

type Handler = (ctx: never, args: object) => Promise<unknown>;
const getPage = (notes.getPeriodPage as unknown as { _handler: Handler })._handler;
const ensurePage = (notes.ensurePeriodPage as unknown as { _handler: Handler })._handler;

const daily = (over: Partial<Row> = {}): Row => ({
  _id: "notes:d1",
  userId: "users:a",
  title: "Monday, 12 October",
  body: "secret body",
  pinned: false,
  periodType: "daily",
  pageType: "daily",
  date: "2026-10-12",
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe("notes.getPeriodPage", () => {
  test("returns only id and title of the owner's live page for that date", async () => {
    const rows = [daily({ _id: "notes:old", deletedAt: 5 }), daily(), daily({ _id: "notes:b", userId: "users:b" })];
    const result = await getPage(makeCtx("users:a", rows), { pageType: "daily", date: "2026-10-12" });
    expect(result).toEqual({ _id: "notes:d1", title: "Monday, 12 October" });
  });

  test("null for a missing page, a bad date, or a weekly key that isn't a Monday", async () => {
    const ctx = makeCtx("users:a", [daily()]);
    expect(await getPage(ctx, { pageType: "daily", date: "2026-10-13" })).toBeNull();
    expect(await getPage(ctx, { pageType: "daily", date: "2026-02-30" })).toBeNull();
    expect(await getPage(ctx, { pageType: "weekly", date: "2026-10-14" })).toBeNull();
  });

  test("signed out is an error", async () => {
    await expect(getPage(makeCtx(null, []), { pageType: "daily", date: "2026-10-12" })).rejects.toThrow();
  });
});

describe("notes.ensurePeriodPage", () => {
  test("makes the page once, with its type and date, and returns the same id after that", async () => {
    const rows: Row[] = [];
    const ctx = makeCtx("users:a", rows);
    const args = { pageType: "daily", date: "2026-10-12", title: "  Monday, 12 October ", body: "## Intention\n" };
    const first = await ensurePage(ctx, args);
    const second = await ensurePage(ctx, { ...args, body: "something else" });
    expect(second).toBe(first);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "users:a",
      title: "Monday, 12 October",
      body: "## Intention\n",
      pinned: false,
      periodType: "daily",
      pageType: "daily",
      date: "2026-10-12",
    });
  });

  test("a soft-deleted page for the date doesn't count; a new one is made", async () => {
    const rows = [daily({ deletedAt: 9 })];
    const id = await ensurePage(makeCtx("users:a", rows), {
      pageType: "daily",
      date: "2026-10-12",
      title: "",
      body: "",
    });
    expect(id).not.toBe("notes:d1");
    expect(rows[1]).toMatchObject({ title: "2026-10-12", pageType: "daily" });
  });

  test("weekly pages are keyed by Monday only", async () => {
    const ctx = makeCtx("users:a", []);
    await expect(
      ensurePage(ctx, { pageType: "weekly", date: "2026-10-14", title: "Week 42", body: "" }),
    ).rejects.toThrow();
    await expect(
      ensurePage(ctx, { pageType: "weekly", date: "2026-10-12", title: "Week 42", body: "" }),
    ).resolves.toBeDefined();
  });

  test("rejects bad dates and oversized bodies", async () => {
    const ctx = makeCtx("users:a", []);
    await expect(ensurePage(ctx, { pageType: "daily", date: "12/10/2026", title: "x", body: "" })).rejects.toThrow();
    await expect(
      ensurePage(ctx, { pageType: "daily", date: "2026-10-12", title: "x", body: "a".repeat(notes.PERIOD_BODY_MAX + 1) }),
    ).rejects.toThrow();
  });
});

describe("notes.restore with a dated page", () => {
  const restore = (notes.restore as unknown as { _handler: Handler })._handler;
  function withPatch(rows: Row[]) {
    const ctx = makeCtx("users:a", rows) as unknown as { db: Record<string, unknown> };
    ctx.db.patch = async (id: string, patch: Row) => {
      const row = rows.find((r) => r._id === id);
      if (row) Object.assign(row, patch);
    };
    return ctx as never;
  }

  test("a restored daily page whose date already has a new page comes back as a plain page", async () => {
    const now = Date.now();
    const rows = [daily({ _id: "notes:old", deletedAt: now - 1_000 }), daily({ _id: "notes:new" })];
    await expect(restore(withPatch(rows), { noteId: "notes:old" })).resolves.toEqual({ success: true });
    expect(rows[0]).toMatchObject({ deletedAt: undefined, pageType: "plain", date: undefined, periodType: "none" });
    expect(rows[1]).toMatchObject({ pageType: "daily", date: "2026-10-12" });
  });

  test("without a clash the page comes back as it was", async () => {
    const rows = [daily({ _id: "notes:old", deletedAt: Date.now() - 1_000 })];
    await restore(withPatch(rows), { noteId: "notes:old" });
    expect(rows[0]).toMatchObject({ deletedAt: undefined, pageType: "daily", date: "2026-10-12" });
  });
});
