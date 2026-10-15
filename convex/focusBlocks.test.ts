import { describe, expect, test } from "bun:test";
import * as analytics from "./analytics";
import * as focusBlocks from "./focusBlocks";
import { GRACE_MS } from "./lib/softDelete";
import { makeFakeCtx, run } from "./lib/testFakeCtx";

const A = "users:a";
const B = "users:b";
const HOUR = 60 * 60 * 1000;

describe("focusBlocks", () => {
	test("create validates duration and trims the label to 120 chars", async () => {
		const ctx = makeFakeCtx(A);
		await expect(run(focusBlocks.create, ctx, { startedAtMs: 1, durationMs: 0 })).rejects.toThrow();
		await expect(
			run(focusBlocks.create, ctx, { startedAtMs: 1, durationMs: 8 * HOUR + 1 }),
		).rejects.toThrow();
		const id = await run(focusBlocks.create, ctx, {
			startedAtMs: 1,
			durationMs: 8 * HOUR,
			label: `  ${"x".repeat(200)}`,
		});
		expect((await ctx.db.get(id)).label).toHaveLength(120);
	});

	test("create refuses another user's task", async () => {
		const ctx = makeFakeCtx(A);
		const taskId = await ctx.db.insert("tasks", { userId: B, title: "t", createdAt: 1, updatedAt: 1 });
		await expect(
			run(focusBlocks.create, ctx, { startedAtMs: 1, durationMs: 1000, taskId }),
		).rejects.toThrow();
	});

	test("create refuses a soft-deleted task", async () => {
		const ctx = makeFakeCtx(A);
		const taskId = await ctx.db.insert("tasks", {
			userId: A,
			title: "t",
			createdAt: 1,
			updatedAt: 1,
			deletedAt: 2,
		});
		await expect(
			run(focusBlocks.create, ctx, { startedAtMs: 1, durationMs: 1000, taskId }),
		).rejects.toThrow();
	});

	test("listInRange is newest first, hides deleted rows and other users, caps at 93 days", async () => {
		const ctx = makeFakeCtx(A);
		const first = await run(focusBlocks.create, ctx, { startedAtMs: 100, durationMs: 1000 });
		const second = await run(focusBlocks.create, ctx, { startedAtMs: 200, durationMs: 1000 });
		await ctx.db.insert("focusBlocks", {
			userId: B,
			startedAtMs: 150,
			durationMs: 1,
			createdAt: 1,
			updatedAt: 1,
		});

		let rows = await run(focusBlocks.listInRange, ctx, { startMs: 0, endMs: 1000 });
		expect(rows.map((r: any) => r._id)).toEqual([second, first]);

		await run(focusBlocks.remove, ctx, { focusBlockId: second });
		rows = await run(focusBlocks.listInRange, ctx, { startMs: 0, endMs: 1000 });
		expect(rows.map((r: any) => r._id)).toEqual([first]);

		await expect(
			run(focusBlocks.listInRange, ctx, { startMs: 0, endMs: 94 * 24 * HOUR }),
		).rejects.toThrow();
	});

	test("remove returns undoUntilMs; restore works in grace and is refused after 30 days", async () => {
		const ctx = makeFakeCtx(A);
		const focusBlockId = await run(focusBlocks.create, ctx, { startedAtMs: 100, durationMs: 1000 });
		const res = await run(focusBlocks.remove, ctx, { focusBlockId });
		expect(res.undoUntilMs).toBeGreaterThan(Date.now());
		expect(await run(focusBlocks.restore, ctx, { focusBlockId })).toEqual({ success: true });
		await ctx.db.patch(focusBlockId, { deletedAt: Date.now() - GRACE_MS - 1000 });
		expect(await run(focusBlocks.restore, ctx, { focusBlockId })).toEqual({ success: false });
	});

	test("remove and restore are owner-only", async () => {
		const ctx = makeFakeCtx(A);
		const focusBlockId = await ctx.db.insert("focusBlocks", {
			userId: B,
			startedAtMs: 1,
			durationMs: 1,
			createdAt: 1,
			updatedAt: 1,
		});
		await expect(run(focusBlocks.remove, ctx, { focusBlockId })).rejects.toThrow();
		await expect(run(focusBlocks.restore, ctx, { focusBlockId })).rejects.toThrow();
	});
});

describe("analytics.insightsSummary (#528)", () => {
	test("a brand-new user returns zeros for a non-UTC local-day window", async () => {
		const ctx = makeFakeCtx(A);
		// Local midnight in UTC+5:30 is 18:30 UTC the day before.
		const todayStartMs = Date.UTC(2026, 9, 4, 18, 30);
		const res = await run(analytics.insightsSummary, ctx, {
			todayStartMs,
			todayEndMs: todayStartMs + 24 * HOUR,
			weekStartMs: todayStartMs - 6 * 24 * HOUR,
		});
		expect(res.tasksOpen).toBe(0);
		expect(res.tasksDueToday).toBe(0);
		expect(res.tasksOverdue).toBe(0);
		expect(res.tasksCompletedThisWeek).toBe(0);
		expect(res.habitsTotal).toBe(0);
		expect(res.bestStreak).toBe(0);
		expect(res.goalsActive).toBe(0);
		expect(res.goalsAverageProgressPercent).toBe(0);
		expect(res.openByEnergy).toEqual({ low: 0, medium: 0, high: 0 });
	});
});
