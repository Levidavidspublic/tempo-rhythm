import { describe, expect, test } from "bun:test";
import { STARTER_TEMPLATES } from "./lib/templateCatalog";
import * as templates from "./templates";

type FakeIdentity = {
  subject: string;
  email?: string;
  name?: string;
};

type FakeUser = {
  _id: string;
  email: string;
  [key: string]: unknown;
};

function makeFakeCtx({
  identity,
  users = [],
}: {
  identity: FakeIdentity | null;
  users?: FakeUser[];
}) {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  let nextId = 1;

  function table(name: string) {
    let rows = tables.get(name);
    if (!rows) {
      rows = new Map();
      tables.set(name, rows);
    }
    return rows;
  }

  for (const user of users) {
    table("users").set(user._id, user as unknown as Record<string, unknown>);
  }

  function matchQuery(rows: Record<string, unknown>[]) {
    return {
      withIndex: (
        _indexName: string,
        matcher: (q: {
          eq: (field: string, value: unknown) => { field: string; value: unknown };
        }) => { field: string; value: unknown },
      ) => {
        const { field, value } = matcher({ eq: (field, value) => ({ field, value }) });
        return matchQuery(rows.filter((row) => row[field] === value));
      },
      order: (_direction: "asc" | "desc") => matchQuery(rows),
      collect: async () => rows,
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
    };
  }

  const db = {
    normalizeId: (tableName: string, id: string) => (table(tableName).has(id) ? id : null),
    get: async (id: string) => {
      const [tableName] = id.split(":");
      return table(tableName).get(id) ?? null;
    },
    insert: async (tableName: string, doc: Record<string, unknown>) => {
      const id = `${tableName}:${nextId++}`;
      table(tableName).set(id, { _id: id, ...doc });
      return id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const [tableName] = id.split(":");
      const existing = table(tableName).get(id) ?? {};
      const next: Record<string, unknown> = { ...existing };
      // Match Convex: an undefined patch value removes the field.
      for (const key of Object.keys(patch)) {
        const value = patch[key];
        if (value === undefined) {
          delete next[key];
        } else {
          next[key] = value;
        }
      }
      table(tableName).set(id, next);
    },
    query: (tableName: string) => matchQuery(Array.from(table(tableName).values())),
  };

  return {
    auth: { getUserIdentity: async () => identity },
    db,
  } as any;
}

const userA = { _id: "users:a", email: "a@example.com" };
const userB = { _id: "users:b", email: "b@example.com" };

function handler(fn: unknown) {
  return (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
}

describe("templates", () => {
  test("list requires auth", async () => {
    const ctx = makeFakeCtx({ identity: null });
    await expect(handler(templates.list)(ctx, {})).rejects.toThrow("Not authenticated");
  });

  test("list merges starters and the caller's templates only", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA, userB] });
    await ctx.db.insert("templates", {
      userId: userA._id,
      name: "Mine",
      periodType: "none",
      body: "# Mine",
      createdAt: 1,
      updatedAt: 2,
    });
    await ctx.db.insert("templates", {
      userId: userB._id,
      name: "Theirs",
      periodType: "none",
      body: "# Theirs",
      createdAt: 1,
      updatedAt: 3,
    });
    const deletedId = await ctx.db.insert("templates", {
      userId: userA._id,
      name: "Gone",
      periodType: "none",
      body: "# Gone",
      createdAt: 1,
      updatedAt: 4,
      deletedAt: 5,
    });

    const all = (await handler(templates.list)(ctx, {})) as Array<{ templateId: string; name: string }>;
    expect(all.filter((row) => row.templateId.startsWith("starter:")).length).toBe(
      STARTER_TEMPLATES.length,
    );
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(STARTER_TEMPLATES.length).toBeLessThanOrEqual(10);
    expect(all.some((row) => row.name === "Mine")).toBe(true);
    expect(all.some((row) => row.name === "Theirs")).toBe(false);
    expect(all.some((row) => row.templateId === deletedId)).toBe(false);

    const starters = (await handler(templates.list)(ctx, { scope: "starter" })) as Array<{
      source: string;
    }>;
    expect(starters.every((row) => row.source === "starter")).toBe(true);

    const mine = (await handler(templates.list)(ctx, { scope: "mine" })) as Array<{ name: string }>;
    expect(mine.map((row) => row.name)).toEqual(["Mine"]);
  });

  test("get returns a starter, a owned template, or null", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA, userB] });
    const daily = (await handler(templates.get)(ctx, { templateId: "starter:daily-page" })) as {
      source: string;
      sections: string[];
      periodType: string;
    };
    expect(daily.source).toBe("starter");
    expect(daily.periodType).toBe("daily");
    expect(daily.sections).toContain("Today");

    const theirs = await ctx.db.insert("templates", {
      userId: userB._id,
      name: "Theirs",
      periodType: "none",
      body: "# Theirs",
      createdAt: 1,
      updatedAt: 1,
    });
    expect(await handler(templates.get)(ctx, { templateId: theirs })).toBeNull();
    expect(await handler(templates.get)(ctx, { templateId: "missing" })).toBeNull();
  });

  test("proposeForPage is a period rule and does not propose for none", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });
    const daily = (await handler(templates.proposeForPage)(ctx, {
      periodType: "daily",
      title: "Standup",
    })) as { templateId: string; name: string; reason: string };
    expect(daily.templateId).toBe("starter:daily-page");
    expect(daily.name).toBe("Daily page");
    expect(daily.reason.length).toBeGreaterThan(0);
    expect(await handler(templates.proposeForPage)(ctx, { periodType: "none" })).toBeNull();
  });

  test("applyToNote inserts a note from the template", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });
    const noteId = (await handler(templates.applyToNote)(ctx, {
      templateId: "starter:weekly-page",
      title: "Week of the 5th",
    })) as string;
    const note = await ctx.db.get(noteId);
    expect(note.userId).toBe(userA._id);
    expect(note.title).toBe("Week of the 5th");
    expect(note.periodType).toBe("weekly");
    expect(note.body).toContain("## Focus");
  });

  test("starter templates cannot be updated or removed", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA] });
    await expect(
      handler(templates.update)(ctx, { templateId: "starter:daily-page", name: "Nope" }),
    ).rejects.toThrow("Starter templates cannot be changed");
    await expect(
      handler(templates.remove)(ctx, { templateId: "starter:daily-page" }),
    ).rejects.toThrow("Starter templates cannot be removed");
  });

  test("create, update, and soft-delete stay on the owner", async () => {
    const ctx = makeFakeCtx({ identity: { subject: userA._id }, users: [userA, userB] });
    const templateId = (await handler(templates.create)(ctx, {
      name: "  Brief  ",
      description: "A brief",
      periodType: "none",
      body: "# Brief\n\n## Outcome\n",
    })) as string;
    const created = await ctx.db.get(templateId);
    expect(created.name).toBe("Brief");
    expect(created.userId).toBe(userA._id);

    await handler(templates.update)(ctx, { templateId, name: "Updated" });
    expect((await ctx.db.get(templateId)).name).toBe("Updated");

    await handler(templates.update)(ctx, { templateId, description: "   " });
    expect((await ctx.db.get(templateId)).description).toBeUndefined();
    await handler(templates.update)(ctx, { templateId, description: "  Kept  " });
    expect((await ctx.db.get(templateId)).description).toBe("Kept");

    const otherCtx = makeFakeCtx({ identity: { subject: userB._id }, users: [userA, userB] });
    otherCtx.db = ctx.db;
    await expect(handler(templates.update)(otherCtx, { templateId, name: "Stolen" })).rejects.toThrow(
      "Access denied",
    );

    expect(await handler(templates.remove)(ctx, { templateId })).toBeNull();
    const stored = await ctx.db.get(templateId);
    expect(typeof stored.deletedAt).toBe("number");
    const mine = (await handler(templates.list)(ctx, { scope: "mine" })) as unknown[];
    expect(mine).toEqual([]);
  });
});
