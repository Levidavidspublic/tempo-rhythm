import { describe, expect, test } from "bun:test";
import { get, update } from "./goals";
import { makeFakeCtx, run } from "./lib/testFakeCtx";

describe("goals.get", () => {
  test("returns the owner's goal and hides other users' and deleted goals", async () => {
    const ctx = makeFakeCtx("users:mine", ["users:other"]);
    const mine = await ctx.db.insert("goals", {
      userId: "users:mine",
      title: "Mine",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const theirs = await ctx.db.insert("goals", {
      userId: "users:other",
      title: "Theirs",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const deleted = await ctx.db.insert("goals", {
      userId: "users:mine",
      title: "Gone",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: 2,
    });

    expect((await run(get, ctx, { goalId: mine })).title).toBe("Mine");
    expect(await run(get, ctx, { goalId: theirs })).toBeNull();
    expect(await run(get, ctx, { goalId: deleted })).toBeNull();
  });

  test("a milestone raises progress through update and persists", async () => {
    const ctx = makeFakeCtx("users:mine");
    const id = await ctx.db.insert("goals", {
      userId: "users:mine",
      title: "Run",
      progressPercent: 0,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await run(update, ctx, { goalId: id, progressPercent: 25 });
    expect((await run(get, ctx, { goalId: id })).progressPercent).toBe(25);
  });
});
