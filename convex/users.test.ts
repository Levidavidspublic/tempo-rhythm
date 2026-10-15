import { describe, expect, test } from "bun:test";
import * as notifications from "./notifications";
import * as preferences from "./preferences";
import * as search from "./search";
import * as users from "./users";

type FakeIdentity = {
  subject: string;
  email?: string;
  name?: string;
  nickname?: string;
};

type FakeUser = {
  _id: string;
  email: string;
  [key: string]: unknown;
};

function makeFakeCtx({
  identity,
  users: seeded = [],
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

  for (const user of seeded) {
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
      const existing = table(tableName).get(id);
      table(tableName).set(id, { ...existing, ...patch });
    },
    query: (tableName: string) => matchQuery(Array.from(table(tableName).values())),
  };

  return {
    auth: { getUserIdentity: async () => identity },
    db,
  } as any;
}

function handler(fn: unknown) {
  return (fn as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
}

const userA = {
  _id: "users:a",
  email: "ada@example.com",
  fullName: "Ada Lovelace",
  betaAccess: "tester",
  entitlementTier: "max",
  userType: "paid",
  onboardedAt: 42,
};

describe("users profile and onboarding", () => {
  test("getProfile uses the name, then the email prefix, never the placeholder", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id, email: userA.email },
      users: [userA],
    });
    const profile = (await handler(users.getProfile)(ctx, {})) as {
      greetingName: string;
      onboardedAt?: number;
    };
    expect(profile.greetingName).toBe("Ada Lovelace");
    expect(profile.onboardedAt).toBe(42);

    const placeholder = makeFakeCtx({
      identity: { subject: "users:p", email: "ada@example.com" },
      users: [{ _id: "users:p", email: "ada@example.com", fullName: "User" }],
    });
    const fromEmail = (await handler(users.getProfile)(placeholder, {})) as { greetingName: string };
    expect(fromEmail.greetingName).toBe("ada");

    const nameless = makeFakeCtx({
      identity: { subject: "users:n" },
      users: [{ _id: "users:n", email: "" }],
    });
    const fallback = (await handler(users.getProfile)(nameless, {})) as { greetingName: string };
    expect(fallback.greetingName).toBe("there");
    expect(await handler(users.getProfile)(makeFakeCtx({ identity: null }), {})).toBeNull();
  });

  test("createOrUpdateUser does not store the placeholder User", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: "new", email: "new@example.com" },
    });
    const userId = (await handler(users.createOrUpdateUser)(ctx, {})) as string;
    const stored = await ctx.db.get(userId);
    expect(stored.fullName).toBeUndefined();
    expect(stored.email).toBe("new@example.com");

    const returning = makeFakeCtx({
      identity: { subject: "users:a", email: "ada@example.com" },
      users: [{ _id: "users:a", email: "ada@example.com", fullName: "User", entitlementTier: "max", userType: "paid", betaAccess: "tester" }],
    });
    await handler(users.createOrUpdateUser)(returning, {});
    expect((await returning.db.get("users:a")).fullName).toBeUndefined();

    const named = makeFakeCtx({
      identity: { subject: "users:b", email: "bea@example.com" },
      users: [{ _id: "users:b", email: "bea@example.com", fullName: "Bea", entitlementTier: "max", userType: "paid", betaAccess: "tester" }],
    });
    await handler(users.createOrUpdateUser)(named, {});
    expect((await named.db.get("users:b")).fullName).toBe("Bea");

    const withName = makeFakeCtx({
      identity: { subject: "fresh", email: "cy@example.com", name: "Cy" },
    });
    const cyId = (await handler(users.createOrUpdateUser)(withName, {})) as string;
    expect((await withName.db.get(cyId)).fullName).toBe("Cy");
  });

  test("updateMyProfile trims and rejects an empty name", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id, email: userA.email },
      users: [{ ...userA }],
    });
    await expect(handler(users.updateMyProfile)(makeFakeCtx({ identity: null }), { fullName: "Ada" })).rejects.toThrow(
      "Not authenticated",
    );
    await expect(handler(users.updateMyProfile)(ctx, { fullName: "   " })).rejects.toThrow("Name is required");
    const id = await handler(users.updateMyProfile)(ctx, { fullName: "  Ada  " });
    expect(id).toBe(userA._id);
    expect((await ctx.db.get(userA._id)).fullName).toBe("Ada");
  });

  test("completeOnboarding sets onboardedAt once", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: "users:o", email: "o@example.com" },
      users: [{ _id: "users:o", email: "o@example.com" }],
    });
    const first = (await handler(users.completeOnboarding)(ctx, { fullName: "  Ora  " })) as {
      onboardedAt: number;
    };
    expect(typeof first.onboardedAt).toBe("number");
    expect((await ctx.db.get("users:o")).fullName).toBe("Ora");
    const second = (await handler(users.completeOnboarding)(ctx, { fullName: "Ora Again" })) as {
      onboardedAt: number;
    };
    expect(second.onboardedAt).toBe(first.onboardedAt);
    expect((await ctx.db.get("users:o")).fullName).toBe("Ora Again");
  });

  test("getMyPlan reads the real beta and subscription fields", async () => {
    expect(await handler(users.getMyPlan)(makeFakeCtx({ identity: null }), {})).toBeNull();

    const ctx = makeFakeCtx({
      identity: { subject: userA._id, email: userA.email },
      users: [{ ...userA }],
    });
    await ctx.db.insert("subscriptionStates", {
      userId: userA._id,
      plan: "none",
      status: "inactive",
      billingCycle: "none",
      trialUsed: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const plan = (await handler(users.getMyPlan)(ctx, {})) as {
      plan: string;
      status: string;
      label: string;
      isBeta: boolean;
      betaAccess: string;
      entitlementTier: string;
      userType: string;
    };
    expect(plan).toEqual({
      plan: "none",
      status: "inactive",
      label: "Beta tester",
      isBeta: true,
      betaAccess: "tester",
      entitlementTier: "max",
      userType: "paid",
    });
    expect(JSON.stringify(plan)).not.toMatch(/\$|price|checkout/i);

    const founder = makeFakeCtx({
      identity: { subject: "users:f" },
      users: [{ _id: "users:f", email: "f@example.com", betaAccess: "founder" }],
    });
    const founderPlan = (await handler(users.getMyPlan)(founder, {})) as { label: string; isBeta: boolean; plan: string };
    expect(founderPlan.label).toBe("Founder");
    expect(founderPlan.isBeta).toBe(true);
    expect(founderPlan.plan).toBe("none");

    const free = makeFakeCtx({
      identity: { subject: "users:free" },
      users: [{ _id: "users:free", email: "free@example.com", betaAccess: "none", userType: "free" }],
    });
    const freePlan = (await handler(users.getMyPlan)(free, {})) as { label: string; isBeta: boolean };
    expect(freePlan.label).toBe("Free");
    expect(freePlan.isBeta).toBe(false);
  });
});

describe("preferences", () => {
  test("get returns defaults and update upserts without dropping other fields", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id },
      users: [{ ...userA }],
    });
    await expect(handler(preferences.get)(makeFakeCtx({ identity: null }), {})).rejects.toThrow(
      "Not authenticated",
    );
    expect(await handler(preferences.get)(ctx, {})).toEqual({
      theme: "system",
      locale: "en",
      weekStartsOn: 1,
      timeZone: "UTC",
      emailReminders: true,
      inAppNotifications: true,
    });
    expect(await handler(preferences.update)(ctx, { theme: "dark", weekStartsOn: 0, emailReminders: false })).toBeNull();
    expect(await handler(preferences.get)(ctx, {})).toEqual({
      theme: "dark",
      locale: "en",
      weekStartsOn: 0,
      timeZone: "UTC",
      emailReminders: false,
      inAppNotifications: true,
    });
  });
});

describe("notifications", () => {
  test("list is newest-first and owner-scoped; mark read counts only the owner", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id },
      users: [userA, { _id: "users:b", email: "b@example.com" }],
    });
    const older = await ctx.db.insert("notifications", {
      userId: userA._id,
      title: "Older",
      body: "first",
      kind: "system",
      createdAt: 10,
      updatedAt: 10,
    });
    const newer = await ctx.db.insert("notifications", {
      userId: userA._id,
      title: "Newer",
      body: "second",
      kind: "reminder",
      createdAt: 20,
      updatedAt: 20,
    });
    await ctx.db.insert("notifications", {
      userId: "users:b",
      title: "Theirs",
      body: "no",
      kind: "billing",
      createdAt: 30,
      updatedAt: 30,
    });
    await ctx.db.insert("notifications", {
      userId: userA._id,
      title: "Gone",
      body: "deleted",
      kind: "system",
      createdAt: 40,
      updatedAt: 40,
      deletedAt: 41,
    });

    const rows = (await handler(notifications.list)(ctx, {})) as Array<{ _id: string; title: string }>;
    expect(rows.map((row) => row.title)).toEqual(["Newer", "Older"]);

    const unread = (await handler(notifications.list)(ctx, { unreadOnly: true })) as unknown[];
    expect(unread).toHaveLength(2);

    expect(await handler(notifications.markRead)(ctx, { notificationId: newer })).toBeNull();
    expect(typeof (await ctx.db.get(newer)).readAt).toBe("number");
    const stillUnread = (await handler(notifications.list)(ctx, { unreadOnly: true })) as Array<{ _id: string }>;
    expect(stillUnread.map((row) => row._id)).toEqual([older]);

    const other = makeFakeCtx({
      identity: { subject: "users:b" },
      users: [userA, { _id: "users:b", email: "b@example.com" }],
    });
    other.db = ctx.db;
    await expect(handler(notifications.markRead)(other, { notificationId: older })).rejects.toThrow(
      "Access denied",
    );

    const marked = (await handler(notifications.markAllRead)(ctx, {})) as { updated: number };
    expect(marked.updated).toBe(1);
    expect((await handler(notifications.markAllRead)(ctx, {})) as { updated: number }).toEqual({ updated: 0 });
  });
});

describe("search", () => {
  test("matches the caller's live notes, tasks, habits, and goals", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id },
      users: [userA, { _id: "users:b", email: "b@example.com" }],
    });
    await expect(handler(search.all)(makeFakeCtx({ identity: null }), { query: "alpha" })).rejects.toThrow(
      "Not authenticated",
    );
    expect(await handler(search.all)(ctx, { query: "   " })).toEqual({
      notes: [],
      tasks: [],
      habits: [],
      goals: [],
    });

    const longBody = `${"word ".repeat(40)}alpha trail`;
    await ctx.db.insert("notes", {
      userId: userA._id,
      title: "Alpha note",
      body: longBody,
      updatedAt: 2,
      deletedAt: undefined,
    });
    await ctx.db.insert("notes", {
      userId: userA._id,
      title: "Deleted alpha",
      body: "alpha",
      updatedAt: 3,
      deletedAt: 4,
    });
    await ctx.db.insert("notes", {
      userId: "users:b",
      title: "Alpha theirs",
      body: "alpha",
      updatedAt: 5,
    });
    await ctx.db.insert("tasks", {
      userId: userA._id,
      title: "Alpha task",
      status: "todo",
      updatedAt: 1,
    });
    await ctx.db.insert("habits", {
      userId: userA._id,
      name: "Alpha habit",
      updatedAt: 1,
    });
    await ctx.db.insert("goals", {
      userId: userA._id,
      title: "Alpha goal",
      updatedAt: 1,
    });

    const result = (await handler(search.all)(ctx, { query: "ALPHA" })) as {
      notes: Array<{ title: string; snippet: string }>;
      tasks: Array<{ title: string; status: string }>;
      habits: Array<{ name: string }>;
      goals: Array<{ title: string }>;
    };
    expect(result.notes.map((row) => row.title)).toEqual(["Alpha note"]);
    expect(result.notes[0]?.snippet.length).toBeLessThanOrEqual(120);
    expect(result.notes[0]?.snippet.toLowerCase()).toContain("alpha");
    expect(result.tasks.map((row) => ({ title: row.title, status: row.status }))).toEqual([
      { title: "Alpha task", status: "todo" },
    ]);
    expect(result.habits.map((row) => row.name)).toEqual(["Alpha habit"]);
    expect(result.goals.map((row) => row.title)).toEqual(["Alpha goal"]);
  });

  test("returns at most 8 hits in each group", async () => {
    const ctx = makeFakeCtx({
      identity: { subject: userA._id },
      users: [{ ...userA }],
    });
    for (let i = 0; i < 9; i += 1) {
      await ctx.db.insert("tasks", {
        userId: userA._id,
        title: `Find me ${i}`,
        status: "todo",
        updatedAt: i,
      });
    }
    const result = (await handler(search.all)(ctx, { query: "find" })) as { tasks: unknown[] };
    expect(result.tasks).toHaveLength(8);
  });
});
