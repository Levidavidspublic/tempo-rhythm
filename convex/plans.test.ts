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

  test("refuses sessions on or after the deadline with a kind message", async () => {
    const ctx = makeFakeCtx(A);
    for (const date of ["2026-11-01", "2026-11-02"]) {
      await expect(
        run(plans.createFromPreview, ctx, preview({ sessions: [session({ date })] })),
      ).rejects.toThrow("Every session needs a date before the deadline.");
    }
    expect(await ctx.db.query("tasks").collect()).toHaveLength(0);
    const ok = await run(
      plans.createFromPreview,
      ctx,
      preview({ sessions: [session({ date: "2026-10-31" })] }),
    );
    expect(ok.planId).toBeDefined();
  });
});

describe("plans.createFromPreview across a daylight-saving change", () => {
  test("a session's own startAt wins when it is within a DST shift of the offset time", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    // Israel leaves summer time on 2026-10-25: 09:00 local on the 27th is 07:00 UTC, not 06:00.
    const after = Date.UTC(2026, 9, 27, 7, 0);
    const result = await run(
      plans.createFromPreview,
      ctx,
      preview({ sessions: [session({ date: "2026-10-27", startAt: after })] }),
    );
    const plan = await ctx.db.get(result.planId);
    const task = await ctx.db.get(plan.taskIds[0]);
    expect(task.dueAt).toBe(after);
  });

  test("a startAt far from the session's date is ignored", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    const result = await run(
      plans.createFromPreview,
      ctx,
      preview({ sessions: [session({ startAt: Date.UTC(2027, 0, 1) })] }),
    );
    const plan = await ctx.db.get(result.planId);
    const task = await ctx.db.get(plan.taskIds[0]);
    expect(task.dueAt).toBe(Date.UTC(2026, 9, 20, 6, 0));
  });

  test("a startAt more than an hour off is ignored, so 23:30 can't slide into the next day", async () => {
    setSystemTime(T0);
    const ctx = makeFakeCtx(A);
    // 23:30 local in UTC+3 is 20:30 UTC; 90 minutes later is 01:00 local on the 21st.
    const late = session({ startMinute: 23 * 60 + 30 });
    const result = await run(
      plans.createFromPreview,
      ctx,
      preview({ sessions: [{ ...late, startAt: Date.UTC(2026, 9, 20, 22, 0) }] }),
    );
    const plan = await ctx.db.get(result.planId);
    const task = await ctx.db.get(plan.taskIds[0]);
    expect(task.dueAt).toBe(Date.UTC(2026, 9, 20, 20, 30));
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

describe("plans.replan", () => {
  /** A saved plan of three 45-minute sessions (17:00 local on the 20th, 21st and 22nd). */
  async function savedPlan(ctx: any) {
    setSystemTime(T0);
    const { planId } = await run(
      plans.createFromPreview,
      ctx,
      preview({
        sessions: [
          session({ date: "2026-10-20", startMinute: 17 * 60 }),
          session({ title: "Learn: Geometry", date: "2026-10-21", startMinute: 17 * 60 }),
          session({ title: "Review: Algebra", date: "2026-10-22", startMinute: 17 * 60, kind: "review" }),
        ],
      }),
    );
    const plan = await ctx.db.get(planId);
    return { planId, taskIds: plan.taskIds as string[] };
  }
  const move = (taskId: string, date: string, startMinute: number, startAt?: number) => ({
    taskId,
    date,
    startMinute,
    ...(startAt !== undefined ? { startAt } : {}),
  });
  const dueAts = async (ctx: any, ids: string[]) =>
    Promise.all(ids.map(async (id) => (await ctx.db.get(id)).dueAt));
  // 17:00 local in UTC+3 is 14:00 UTC.
  const at17 = (day: number) => Date.UTC(2026, 9, day, 14, 0);

  test("moves sessions to their new times and keeps what was there for Undo", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    const T1 = T0 + 3 * 24 * 3600_000;
    setSystemTime(T1);
    const result = await run(plans.replan, ctx, {
      planId,
      moves: [move(taskIds[0]!, "2026-10-23", 17 * 60), move(taskIds[1]!, "2026-10-24", 18 * 60)],
      timezoneOffsetMinutes: -180,
    });
    expect(result).toEqual({ undoUntil: T1 + UNDO_WINDOW_MS, moved: 2, removed: 0 });
    expect(await dueAts(ctx, taskIds)).toEqual([at17(23), Date.UTC(2026, 9, 24, 15, 0), at17(22)]);
    const plan = await ctx.db.get(planId);
    expect(plan.lastReplan).toEqual({
      at: T1,
      moves: [
        { taskId: taskIds[0], from: at17(20), to: at17(23) },
        { taskId: taskIds[1], from: at17(21), to: Date.UTC(2026, 9, 24, 15, 0) },
      ],
      removed: [],
    });
    expect(plan.updatedAt).toBe(T1);
    // The plan still reads back through its validators.
    const got = await run(plans.get, ctx, { planId });
    expect(got.tasks).toHaveLength(3);
  });

  test("each new start uses the browser's startAt within the DST bound, else the offset time", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    // Israel leaves summer time on 2026-10-25: 17:00 local on the 27th is 15:00 UTC.
    const afterDst = Date.UTC(2026, 9, 27, 15, 0);
    await run(plans.replan, ctx, {
      planId,
      moves: [move(taskIds[0]!, "2026-10-27", 17 * 60, afterDst), move(taskIds[1]!, "2026-10-28", 17 * 60, Date.UTC(2027, 0, 1))],
      timezoneOffsetMinutes: -180,
    });
    expect(await dueAts(ctx, taskIds.slice(0, 2))).toEqual([afterDst, at17(28)]);
  });

  test("can leave sessions out and move the deadline later; Undo brings all of it back", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    setSystemTime(T0 + 1000);
    const result = await run(plans.replan, ctx, {
      planId,
      // 3 November is after the old deadline (1 Nov) and before the new one (5 Nov).
      moves: [move(taskIds[0]!, "2026-11-03", 17 * 60)],
      remove: [taskIds[2]!],
      deadline: "2026-11-05",
      timezoneOffsetMinutes: -120,
    });
    expect(result).toMatchObject({ moved: 1, removed: 1 });
    let plan = await ctx.db.get(planId);
    expect(plan.deadline).toBe("2026-11-05");
    expect(plan.lastReplan).toMatchObject({ deadlineBefore: "2026-11-01", removed: [taskIds[2]] });
    expect((await ctx.db.get(taskIds[2])).deletedAt).toBe(T0 + 1000);
    expect((await run(plans.get, ctx, { planId })).tasks).toHaveLength(2);

    setSystemTime(T0 + 1000 + UNDO_WINDOW_MS - 1);
    expect(await run(plans.undoReplan, ctx, { planId })).toEqual({ restored: 2 });
    plan = await ctx.db.get(planId);
    expect(plan.deadline).toBe("2026-11-01");
    expect(plan.lastReplan.undoneAt).toBe(T0 + 1000 + UNDO_WINDOW_MS - 1);
    expect(await dueAts(ctx, taskIds)).toEqual([at17(20), at17(21), at17(22)]);
    expect((await ctx.db.get(taskIds[2])).deletedAt).toBeUndefined();
    // A second undo is a no-op, not an error.
    expect(await run(plans.undoReplan, ctx, { planId })).toEqual({ restored: 0 });
  });

  test("the same re-plan sent twice changes nothing the second time", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    const args = {
      planId,
      moves: [move(taskIds[0]!, "2026-10-23", 17 * 60)],
      remove: [taskIds[2]!],
      deadline: "2026-11-05",
      timezoneOffsetMinutes: -180,
    };
    setSystemTime(T0 + 1000);
    const first = await run(plans.replan, ctx, args);
    setSystemTime(T0 + 1500);
    const second = await run(plans.replan, ctx, args);
    expect(second).toEqual(first);
    const plan = await ctx.db.get(planId);
    expect(plan.lastReplan.at).toBe(T0 + 1000);
    expect(plan.lastReplan.moves[0].from).toBe(at17(20));
    expect(plan.updatedAt).toBe(T0 + 1000);
    // Undo still goes back to the times before the first one.
    await run(plans.undoReplan, ctx, { planId });
    expect(await dueAts(ctx, taskIds)).toEqual([at17(20), at17(21), at17(22)]);
  });

  test("the same moves after a session was moved by hand are applied again", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    const args = { planId, moves: [move(taskIds[0]!, "2026-10-23", 17 * 60)], timezoneOffsetMinutes: -180 };
    setSystemTime(T0 + 1000);
    await run(plans.replan, ctx, args);
    await ctx.db.patch(taskIds[0], { dueAt: at17(25) });
    setSystemTime(T0 + 2000);
    const again = await run(plans.replan, ctx, args);
    expect(again.undoUntil).toBe(T0 + 2000 + UNDO_WINDOW_MS);
    expect((await ctx.db.get(planId)).lastReplan.moves[0]).toEqual({ taskId: taskIds[0], from: at17(25), to: at17(23) });
  });

  test("refuses a bad re-plan and writes nothing", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await savedPlan(ctx);
    const other = await savedPlan(ctx);
    await ctx.db.patch(taskIds[1], { status: "done" });
    const goneId = taskIds[2]!;
    const ok = move(taskIds[0]!, "2026-10-23", 17 * 60);
    const bad: Array<[Record<string, unknown>, RegExp]> = [
      [{ moves: [] }, /nothing to move/],
      [{ moves: [move(other.taskIds[0]!, "2026-10-23", 600)] }, /this plan's own sessions/],
      [{ moves: [ok, ok] }, /each one once/],
      [{ moves: [ok], remove: [taskIds[0]!] }, /each one once/],
      [{ moves: [move(taskIds[1]!, "2026-10-23", 600)] }, /Done sessions stay/],
      [{ moves: [move(taskIds[0]!, "2026-11-01", 600)] }, /before the deadline/],
      [{ moves: [move(taskIds[0]!, "23-10-2026", 600)] }, /YYYY-MM-DD/],
      [{ moves: [move(taskIds[0]!, "2026-10-23", 1440)] }, /within the day/],
      [{ moves: [move(taskIds[0]!, "2026-10-23", 23 * 60 + 30)] }, /end by midnight/],
      [{ moves: [ok], deadline: "2026-10-30" }, /later than/],
      [{ moves: [ok], deadline: "2026-02-30" }, /YYYY-MM-DD/],
      [{ moves: [ok], timezoneOffsetMinutes: 2000 }, /time zone/],
    ];
    const before = await dueAts(ctx, taskIds);
    for (const [over, message] of bad) {
      await expect(
        run(plans.replan, ctx, { planId, moves: [], timezoneOffsetMinutes: -180, ...over }),
      ).rejects.toThrow(message);
    }
    await ctx.db.patch(goneId, { deletedAt: 5 });
    await expect(
      run(plans.replan, ctx, { planId, moves: [move(goneId, "2026-10-23", 600)], timezoneOffsetMinutes: -180 }),
    ).rejects.toThrow(/isn't here any more/);
    expect(await dueAts(ctx, taskIds)).toEqual(before);
    const plan = await ctx.db.get(planId);
    expect(plan.lastReplan).toBeUndefined();
    expect(plan.deadline).toBe("2026-11-01");
  });

  test("only the owner can re-plan or undo, and a deleted plan is refused", async () => {
    const ctx = makeFakeCtx(A, [B]);
    const { planId, taskIds } = await savedPlan(ctx);
    const args = { planId, moves: [move(taskIds[0]!, "2026-10-23", 17 * 60)], timezoneOffsetMinutes: -180 };
    await expect(run(plans.replan, as(ctx, B), args)).rejects.toThrow("Plan not found");
    await run(plans.replan, ctx, args);
    await expect(run(plans.undoReplan, as(ctx, B), { planId })).rejects.toThrow("Plan not found");
    expect((await ctx.db.get(taskIds[0])).dueAt).toBe(at17(23));

    await run(plans.undoCreate, ctx, { planId });
    await expect(run(plans.replan, ctx, args)).rejects.toThrow("isn't here any more");
    await expect(run(plans.undoReplan, ctx, { planId })).rejects.toThrow("isn't here any more");
    const signedOut = { ...ctx, auth: { getUserIdentity: async () => null } };
    await expect(run(plans.replan, signedOut, args)).rejects.toThrow();
  });
});

describe("plans.undoReplan", () => {
  async function replanned(ctx: any) {
    setSystemTime(T0);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    const plan = await ctx.db.get(planId);
    const taskIds = plan.taskIds as string[];
    await run(plans.replan, ctx, {
      planId,
      moves: [
        { taskId: taskIds[0], date: "2026-10-23", startMinute: 600 },
        { taskId: taskIds[1], date: "2026-10-24", startMinute: 600 },
      ],
      timezoneOffsetMinutes: -180,
    });
    return { planId, taskIds };
  }

  test("says no after the 5 minutes and leaves the new times in place", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await replanned(ctx);
    setSystemTime(T0 + UNDO_WINDOW_MS + 1);
    await expect(run(plans.undoReplan, ctx, { planId })).rejects.toThrow(/5 minutes/);
    expect((await ctx.db.get(taskIds[0])).dueAt).toBe(Date.UTC(2026, 9, 23, 7, 0));
    expect((await ctx.db.get(planId)).lastReplan.undoneAt).toBeUndefined();
  });

  test("a session moved again by hand since keeps its new time", async () => {
    const ctx = makeFakeCtx(A);
    const { planId, taskIds } = await replanned(ctx);
    await ctx.db.patch(taskIds[1], { dueAt: Date.UTC(2026, 9, 26, 7, 0) });
    expect(await run(plans.undoReplan, ctx, { planId })).toEqual({ restored: 1 });
    expect((await ctx.db.get(taskIds[0])).dueAt).toBe(Date.UTC(2026, 9, 20, 6, 0));
    expect((await ctx.db.get(taskIds[1])).dueAt).toBe(Date.UTC(2026, 9, 26, 7, 0));
  });

  test("with no re-plan to undo, nothing changes", async () => {
    const ctx = makeFakeCtx(A);
    setSystemTime(T0);
    const { planId } = await run(plans.createFromPreview, ctx, preview());
    expect(await run(plans.undoReplan, ctx, { planId })).toEqual({ restored: 0 });
    expect((await ctx.db.get(planId)).lastReplan).toBeUndefined();
  });
});
