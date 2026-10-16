import { describe, expect, test } from "bun:test";
import * as journal from "./journal";

const { clampBody, isDateKey } = journal;

function makeFakeCtx() {
  const rows = new Map<string, Record<string, unknown>>();
  const user = { _id: "users:a", email: "a@example.com" };
  let nextId = 1;

  function query(matches: Record<string, unknown>[]) {
    return {
      withIndex: (
        _name: string,
        select: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) => {
        const conditions: Array<[string, unknown]> = [];
        const builder = {
          eq(field: string, value: unknown) {
            conditions.push([field, value]);
            return builder;
          },
        };
        select(builder);
        return query(
          matches.filter((row) => conditions.every(([field, value]) => row[field] === value)),
        );
      },
      order: () => query(matches),
      collect: async () => matches,
    };
  }

  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: user._id }) },
    db: {
      normalizeId: (_table: string, id: string) => (id === user._id ? id : null),
      get: async (id: string) => (id === user._id ? user : (rows.get(id) ?? null)),
      insert: async (_table: string, value: Record<string, unknown>) => {
        const id = `journalEntries:${nextId++}`;
        rows.set(id, { _id: id, ...value });
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const next = { ...rows.get(id) };
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete next[key];
          else next[key] = value;
        }
        rows.set(id, next);
      },
      query: () => query([...rows.values()]),
    },
  } as any;

  return { ctx, rows };
}

function handler(fn: unknown) {
  return (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
}

describe("isDateKey", () => {
  test("accepts a valid YYYY-MM-DD date", () => {
    expect(isDateKey("2026-10-02")).toBe(true);
  });

  test.each(["2026-13-01", "x"])("rejects %s", (value) => {
    expect(isDateKey(value)).toBe(false);
  });
});

describe("clampBody", () => {
  test("cuts bodies at 20,000 characters", () => {
    expect(clampBody("a".repeat(20_001))).toHaveLength(20_000);
  });
});

describe("journal entry lifecycle", () => {
  test("create rejects a second live entry for the same day", async () => {
    const { ctx } = makeFakeCtx();
    await handler(journal.create)(ctx, { dateKey: "2026-10-06", body: "First" });

    await expect(
      handler(journal.create)(ctx, { dateKey: "2026-10-06", body: "Second" }),
    ).rejects.toThrow("Journal entry already exists for this date");
  });

  test("remove soft-deletes an entry and hides it from daily lookup", async () => {
    const { ctx, rows } = makeFakeCtx();
    const id = (await handler(journal.create)(ctx, {
      dateKey: "2026-10-06",
      body: "Private text",
    })) as string;

    await handler(journal.remove)(ctx, { id });

    expect(typeof rows.get(id)?.deletedAt).toBe("number");
    expect(await handler(journal.getDaily)(ctx, { dateKey: "2026-10-06" })).toBeNull();
  });

  test("restore makes a recently removed entry visible again", async () => {
    const { ctx } = makeFakeCtx();
    const id = (await handler(journal.create)(ctx, {
      dateKey: "2026-10-06",
      body: "Private text",
    })) as string;
    await handler(journal.remove)(ctx, { id });

    expect(await handler(journal.restore)(ctx, { id })).toEqual({ success: true });
    expect(await handler(journal.getDaily)(ctx, { dateKey: "2026-10-06" })).not.toBeNull();
  });

  test("restore rejects a duplicate live entry for the same day", async () => {
    const { ctx, rows } = makeFakeCtx();
    const removedId = (await handler(journal.create)(ctx, {
      dateKey: "2026-10-06",
      body: "Removed text",
    })) as string;
    await handler(journal.remove)(ctx, { id: removedId });
    const liveId = (await handler(journal.updateDaily)(ctx, {
      dateKey: "2026-10-06",
      body: "Replacement text",
    })) as string;

    await expect(handler(journal.restore)(ctx, { id: removedId })).rejects.toThrow(
      "Journal entry already exists for this date",
    );
    expect(typeof rows.get(removedId)?.deletedAt).toBe("number");
    expect((await handler(journal.getDaily)(ctx, { dateKey: "2026-10-06" }))?._id).toBe(
      liveId,
    );
  });
});
