import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { UNDO_WINDOW_MS } from "./lib/softDelete";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as plans from "./plans";

const A = "users:a";
const B = "users:b";
const T0 = Date.UTC(2026, 9, 16, 9, 0);

const session = (over: Record<string, unknown> = {}) => ({
  title: "Learn: Algebra",
  date: "2026-10-20",
  startMinute: 9 * 60,
  minutes: 45,
  kind: "learn" as const,
  ...over,
});

const preview = (over: Record<string, unknown> = {}) => ({
  title: "  Maths exam  ",
  deadline: "2026-11-01",
  sessions: [
    session(),
    session({ title: "Review: Algebra", date: "2026-10-21", startMinute: 17 * 60 + 30, minutes: 15, kind: "review" }),
  ],
  timezoneOffsetMinutes: -180,
  ...over,
});

/** A second caller on the same database. */
function as(ctx: any, userId: string) {
  return { ...ctx, auth: { getUserIdentity: async () => ({ subject: userId }) } };
}

afterEach(() => setSystemTime());

describe("plans.createFromPreview", () => {
  test("creates one elastic task per session and the plan row", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    const result = await run(plans.createFromPreview, ctx, preview());
    expect(result.undoUntil).toBe(T0 + UNDO_WINDOW_MS);

    const plan = await ctx.db.get(result.planId);
    expect(plan.userId).toBe(A);
    expect(plan.title).toBe("Maths exam");
    expect(plan.deadline).toBe("2026-11-01");
    expect(plan.taskIds).toHaveLength(2);
    expect(plan.deletedAt).toBeUndefined();

    const first = await ctx.db.get(plan.taskIds[0]);
    expect(first).toMatchObject({
      userId: A,
      title: "Learn: Algebra",
      status: "todo",
      priority: "medium",
      flexibility: "elastic",
      projectName: "Maths exam",
      timeEstimate: 45 * 60_000,
    });
    // 09:00 in UTC+3 is 06:00 UTC.
    expect(first.dueAt).toBe(Date.UTC(2026, 9, 20, 6, 0));
    const second = await ctx.db.get(plan.taskIds[1]);
    expect(second.dueAt).toBe(Date.UTC(2026, 9, 21, 14, 30));
    expect(second.timeEstimate).toBe(15 * 60_000);
  });

  test("keeps the source set id when one is given", async () => {
    const ctx = makeFakeCtx(A);
    const { planId } = await run(plans.createFromPreview, ctx, preview({ sourceSetId: "set_1" }));
    expect((await ctx.db.get(planId)).sourceSetId).toBe("set_1");
  });

  test("refuses a bad preview and writes nothing", async () => {
    const ctx = makeFakeCtx(A);
    const bad = [
      preview({ title: "   " }),
      preview({ deadline: "2026-02-30" }),
      preview({ sessions: [] }),
      preview({ sessions: [session({ date: "20-10-2026" })] }),
      preview({ sessions: [session({ startMinute: 1440 })] }),
      preview({ sessions: [session({ minutes: 0 })] }),
      preview({ sessions: [session({ title: " " })] }),
      preview({ timezoneOffsetMinutes: 2000 }),
    ];
    for (const args of bad) {
      await expect(run(plans.createFromPreview, ctx, args)).rejects.toThrow();
    }
    expect(await ctx.db.query("tasks").collect()).toHaveLength(0);
    expect(await ctx.db.query("studyPlans").collect()).toHaveLength(0);
  });
});

describe("plans.undoCreate", () => {
  test("soft-deletes the plan and its tasks inside the 5 minutes", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    setSystemTime(T0 + UNDO_WINDOW_MS - 1000);
    expect(await run(plans.undoCreate, ctx, { planId })).toEqual({ removedTasks: 2 });
    const plan = await ctx.db.get(planId);
    expect(plan.deletedAt).toBe(T0 + UNDO_WINDOW_MS - 1000);
    for (const id of plan.taskIds) expect((await ctx.db.get(id)).deletedAt).toBeDefined();
    // A second undo is a no-op, not an error.
    expect(await run(plans.undoCreate, ctx, { planId })).toEqual({ removedTasks: 0 });
    expect(await run(plans.get, ctx, { planId })).toBeNull();
    expect(await run(plans.list, ctx, {})).toHaveLength(0);
  });

  test("says no after the 5 minutes and leaves everything in place", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    setSystemTime(T0 + UNDO_WINDOW_MS + 1);
    await expect(run(plans.undoCreate, ctx, { planId })).rejects.toThrow(/5 minutes/);
    const plan = await ctx.db.get(planId);
    expect(plan.deletedAt).toBeUndefined();
    for (const id of plan.taskIds) expect((await ctx.db.get(id)).deletedAt).toBeUndefined();
  });

  test("another person can't undo someone else's plan", async () => {
    const ctx = makeFakeCtx(A, [B]);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    await expect(run(plans.undoCreate, as(ctx, B), { planId })).rejects.toThrow("Plan not found");
    expect((await ctx.db.get(planId)).deletedAt).toBeUndefined();
  });
});

describe("plans.list and plans.get", () => {
  test("list shows only the caller's live plans", async () => {
    const ctx = makeFakeCtx(A, [B]);
    const mine = await run(plans.createFromPreview, ctx, preview());
    const gone = await run(plans.createFromPreview, ctx, preview({ title: "Old plan" }));
    await run(plans.undoCreate, ctx, { planId: gone.planId });
    await run(plans.createFromPreview, as(ctx, B), preview({ title: "Their plan" }));

    const listed = await run(plans.list, ctx, {});
    expect(listed.map((p: { _id: string }) => p._id)).toEqual([mine.planId]);
    const theirs = await run(plans.list, as(ctx, B), {});
    expect(theirs.map((p: { title: string }) => p.title)).toEqual(["Their plan"]);
  });

  test("get returns the plan with its live tasks, and null for someone else", async () => {
    const ctx = makeFakeCtx(A, [B]);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    const plan = await ctx.db.get(planId);
    await ctx.db.patch(plan.taskIds[1], { deletedAt: 5 });

    const got = await run(plans.get, ctx, { planId });
    expect(got.plan._id).toBe(planId);
    expect(got.tasks).toHaveLength(1);
    expect(got.tasks[0]).toMatchObject({ title: "Learn: Algebra", status: "todo", flexibility: "elastic" });
    expect(await run(plans.get, as(ctx, B), { planId })).toBeNull();
  });

  test("signed-out callers are refused", async () => {
    const ctx = makeFakeCtx(A);
    const signedOut = { ...ctx, auth: { getUserIdentity: async () => null } };
    await expect(run(plans.list, signedOut, {})).rejects.toThrow();
    await expect(run(plans.createFromPreview, signedOut, preview())).rejects.toThrow();
  });
});

describe("localStartToUtcMs", () => {
  test("follows Date#getTimezoneOffset (UTC minus local)", () => {
    expect(plans.localStartToUtcMs("2026-10-20", 0, 0)).toBe(Date.UTC(2026, 9, 20));
    expect(plans.localStartToUtcMs("2026-10-20", 60, 420)).toBe(Date.UTC(2026, 9, 20, 8));
    expect(plans.localStartToUtcMs("2026-01-01", 30, -120)).toBe(Date.UTC(2025, 11, 31, 22, 30));
  });
});
