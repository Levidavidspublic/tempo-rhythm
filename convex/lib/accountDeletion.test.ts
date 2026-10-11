import { describe, expect, test } from "bun:test";
import {
  ACCOUNT_RESTORE_GRACE_MS,
  isInactiveAccount,
  pickSignInUser,
  signInRestorePatch,
  softDeleteUserAccount,
  USER_OWNED_TABLES,
} from "./accountDeletion";
import { makeFakeCtx, run } from "./testFakeCtx";
import * as coach from "../coach";
import * as mcp from "../mcp";
import * as nags from "../nags";

function handlerCtx(userId: string, extraUsers: string[] = []) {
  const ctx = makeFakeCtx(userId, extraUsers);
  const query = ctx.db.query;
  ctx.db.query = (table: string) => {
    const builder = query(table);
    const addTerminals = (value: ReturnType<typeof query>) => ({
      ...value,
      first: async () => (await value.collect())[0] ?? null,
      unique: async () => (await value.collect())[0] ?? null,
      withIndex: (name: string, fn: (q: unknown) => unknown) =>
        addTerminals(value.withIndex(name, fn)),
    });
    return addTerminals(builder);
  };
  return ctx;
}

describe("isInactiveAccount", () => {
  test("live accounts are active", () => {
    expect(isInactiveAccount({})).toBe(false);
    expect(isInactiveAccount({ isActive: true })).toBe(false);
  });

  test("soft-deleted or deactivated accounts are inactive", () => {
    expect(isInactiveAccount({ deletedAt: 1 })).toBe(true);
    expect(isInactiveAccount({ isActive: false })).toBe(true);
  });
});

describe("signInRestorePatch", () => {
  const deletedAt = 1_700_000_000_000;

  test("restores a soft-deleted account inside 30 days", () => {
    expect(signInRestorePatch({ deletedAt, isActive: false }, deletedAt + 1_000)).toEqual({
      deletedAt: undefined,
      isActive: true,
    });
  });

  test("does not restore admin deactivation or an expired grace window", () => {
    expect(signInRestorePatch({ isActive: false }, deletedAt)).toBeNull();
    expect(signInRestorePatch({ deletedAt, isActive: false }, deletedAt + ACCOUNT_RESTORE_GRACE_MS + 1)).toBeNull();
    expect(signInRestorePatch({ deletedAt }, deletedAt - 1)).toBeNull();
  });

  test("pickSignInUser prefers a live row over a soft-deleted one", () => {
    const live = { id: "live", isActive: true };
    const deleted = { id: "deleted", deletedAt, isActive: false };
    expect(pickSignInUser([deleted, live], deletedAt + 1_000)).toBe(live);
    expect(pickSignInUser([deleted], deletedAt + 1_000)?.id).toBe("deleted");
    expect(pickSignInUser([deleted], deletedAt + ACCOUNT_RESTORE_GRACE_MS + 1)?.id).toBe("deleted");
  });
});

describe("USER_OWNED_TABLES", () => {
  test("covers current user-owned schema tables with by_userId", () => {
    const expected = [
      "calendarEvents",
      "dayPlans",
      "focusBlocks",
      "goals",
      "habitCheckIns",
      "habits",
      "memories",
      "notes",
      "notifications",
      "taskRepeatCfgs",
      "tasks",
      "templates",
      "timeBlocks",
      "userPreferences",
    ] as const;
    expect([...USER_OWNED_TABLES].sort()).toEqual([...expected].sort());
  });
});

describe("softDeleteUserAccount", () => {
  test("deletes all owned data, revokes tokens, and remains isolated and idempotent", async () => {
    const ctx = handlerCtx("users:a", ["users:b"]);
    const now = 1_800_000_000_000;
    const taskA = await ctx.db.insert("tasks", { userId: "users:a", deletedAt: undefined });
    const taskB = await ctx.db.insert("tasks", { userId: "users:b", deletedAt: undefined });
    const nagA = await ctx.db.insert("nags", { userId: "users:a", deletedAt: undefined });
    const oldDeletedAt = now - 10;
    const alreadyDeletedNag = await ctx.db.insert("nags", {
      userId: "users:a",
      deletedAt: oldDeletedAt,
    });
    const settingsA = await ctx.db.insert("coachSettings", {
      userId: "users:a",
      dial: 9,
      taskLoad: 4,
      acceptedStreak: 3,
      updatedAt: 1,
    });
    const proposalA = await ctx.db.insert("coachProposals", {
      userId: "users:a",
      status: "pending",
      taskIds: [],
      tenSecondAction: "start",
      realism: { ok: true, totalMinutes: 0, availableMinutes: 120, note: "" },
      createdAt: 1,
    });
    const tokenA = await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "old-token",
      name: "old",
      prefix: "old",
      createdAt: 1,
    });
    const alreadyRevoked = await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "revoked-token",
      name: "revoked",
      prefix: "revoked",
      createdAt: 1,
      revokedAt: oldDeletedAt,
    });
    const tokenB = await ctx.db.insert("mcpTokens", {
      userId: "users:b",
      tokenHash: "other-token",
      name: "other",
      prefix: "other",
      createdAt: 1,
    });

    expect(await softDeleteUserAccount(ctx, "users:a", now)).toEqual({ deletedCount: 6 });
    expect(await softDeleteUserAccount(ctx, "users:a", now + 1)).toEqual({ deletedCount: 0 });

    for (const id of [taskA, nagA, settingsA, proposalA]) {
      expect((await ctx.db.get(id)).deletedAt).toBe(now);
    }
    expect((await ctx.db.get(tokenA)).revokedAt).toBe(now);
    expect((await ctx.db.get(alreadyDeletedNag)).deletedAt).toBe(oldDeletedAt);
    expect((await ctx.db.get(alreadyRevoked)).revokedAt).toBe(oldDeletedAt);
    expect((await ctx.db.get(taskB)).deletedAt).toBeUndefined();
    expect((await ctx.db.get(tokenB)).revokedAt).toBeUndefined();
  });

  test("restoring the account does not restore deleted coach/nag data or old MCP credentials", async () => {
    const ctx = handlerCtx("users:a");
    const now = 1_800_000_000_000;
    const nagId = await ctx.db.insert("nags", {
      userId: "users:a",
      label: "old nag",
      enabled: true,
      phrases: [],
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("coachSettings", {
      userId: "users:a",
      dial: 9,
      taskLoad: 4,
      acceptedStreak: 3,
      updatedAt: 1,
    });
    const proposalId = await ctx.db.insert("coachProposals", {
      userId: "users:a",
      status: "pending",
      taskIds: [],
      tenSecondAction: "start",
      realism: { ok: true, totalMinutes: 0, availableMinutes: 120, note: "" },
      createdAt: 1,
    });
    await ctx.db.insert("mcpTokens", {
      userId: "users:a",
      tokenHash: "old-token",
      name: "old",
      prefix: "old",
      createdAt: 1,
    });

    await softDeleteUserAccount(ctx, "users:a", now);
    expect(await run(mcp.resolveToken, ctx, { tokenHash: "old-token" })).toBeNull();

    const user = await ctx.db.get("users:a");
    const restore = signInRestorePatch(user, now + 1);
    expect(restore).not.toBeNull();
    await ctx.db.patch("users:a", restore);

    expect(await run(mcp.resolveToken, ctx, { tokenHash: "old-token" })).toBeNull();
    expect(await run(nags.list, ctx, {})).toEqual([]);
    expect(await run(coach.getSettings, ctx, {})).toEqual({
      dial: 5,
      taskLoad: 2,
      panicUntil: null,
      acceptedStreak: 0,
    });
    expect(await run(coach.currentProposal, ctx, {})).toBeNull();
    await expect(
      run(coach.decideProposal, ctx, { proposalId, decision: "reject" }),
    ).rejects.toThrow("Proposal not found");
    expect((await ctx.db.get(nagId)).deletedAt).toBe(now);
  });
});
