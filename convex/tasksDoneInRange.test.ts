import { describe, expect, test } from "bun:test";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as tasks from "./tasks";

const A = "users:a";
const B = "users:b";
const DAY = 24 * 60 * 60 * 1000;
const WEEK_START = Date.UTC(2026, 9, 12);
const WEEK_END = WEEK_START + 7 * DAY;

async function seedTask(ctx: any, userId: string, title: string, extra: Record<string, unknown> = {}) {
	return ctx.db.insert("tasks", {
		userId,
		title,
		status: "done",
		priority: "medium",
		createdAt: 1,
		updatedAt: 1,
		...extra,
	});
}

describe("tasks.listDoneInRange (TEMPO-B07-01)", () => {
	test("the caller's live tasks done in [start, end), oldest completion first", async () => {
		const ctx = makeFakeCtx(A, [B]);
		await seedTask(ctx, A, "Wednesday", { completedAt: WEEK_START + 2 * DAY });
		await seedTask(ctx, A, "Monday, first thing", { completedAt: WEEK_START });
		await seedTask(ctx, A, "Sunday night", { completedAt: WEEK_END - 1 });
		await seedTask(ctx, A, "Next Monday", { completedAt: WEEK_END });
		await seedTask(ctx, A, "Last Sunday", { completedAt: WEEK_START - 1 });
		await seedTask(ctx, A, "Deleted", { completedAt: WEEK_START + DAY, deletedAt: WEEK_START + 2 * DAY });
		await seedTask(ctx, A, "Done, no time", {});
		await seedTask(ctx, A, "Reopened", { status: "todo", completedAt: WEEK_START + DAY });
		await seedTask(ctx, B, "Someone else's", { completedAt: WEEK_START + DAY });

		const done = await run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_END });
		expect(done.map((t: { title: string }) => t.title)).toEqual(["Monday, first thing", "Wednesday", "Sunday night"]);
		expect(done.every((t: { userId: string }) => t.userId === A)).toBe(true);
	});

	test("another person sees only their own", async () => {
		const ctx = makeFakeCtx(B, [A]);
		await seedTask(ctx, A, "A's", { completedAt: WEEK_START + DAY });
		await seedTask(ctx, B, "B's", { completedAt: WEEK_START + DAY });
		const done = await run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_END });
		expect(done.map((t: { title: string }) => t.title)).toEqual(["B's"]);
	});

	test("a range that ends at or before its start, or is not a number, is refused", async () => {
		const ctx = makeFakeCtx(A);
		await expect(run(tasks.listDoneInRange, ctx, { startMs: WEEK_END, endMs: WEEK_START })).rejects.toThrow(
			"The range must end after it starts.",
		);
		await expect(run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_START })).rejects.toThrow(
			"The range must end after it starts.",
		);
		await expect(run(tasks.listDoneInRange, ctx, { startMs: Number.NaN, endMs: WEEK_END })).rejects.toThrow(
			"The range must end after it starts.",
		);
	});

	test("31 days is the longest range; longer is refused", async () => {
		const ctx = makeFakeCtx(A);
		await seedTask(ctx, A, "In the month", { completedAt: WEEK_START + 30 * DAY });
		const month = await run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_START + tasks.MAX_DONE_RANGE_MS });
		expect(month).toHaveLength(1);
		await expect(
			run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_START + tasks.MAX_DONE_RANGE_MS + 1 }),
		).rejects.toThrow("The range can be at most 31 days.");
	});

	test("more done than the cap: the newest are kept, still oldest first", async () => {
		const ctx = makeFakeCtx(A);
		const extra = 5;
		for (let i = 0; i < tasks.MAX_DONE_IN_RANGE + extra; i += 1) {
			await seedTask(ctx, A, `t${i}`, { completedAt: WEEK_START + i * 1000 });
		}
		const done = await run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_END });
		expect(done).toHaveLength(tasks.MAX_DONE_IN_RANGE);
		expect(done[0].title).toBe(`t${extra}`);
		expect(done.at(-1).title).toBe(`t${tasks.MAX_DONE_IN_RANGE + extra - 1}`);
	});

	test("a task created as done is stamped done now, so it counts in its range", async () => {
		const ctx = makeFakeCtx(A);
		const before = Date.now();
		const doneId = await run(tasks.create, ctx, { title: "Already did it", status: "done" });
		const todoId = await run(tasks.create, ctx, { title: "Still to do" });
		const after = Date.now();
		const done = await ctx.db.get(doneId);
		expect(done.completedAt).toBeGreaterThanOrEqual(before);
		expect(done.completedAt).toBeLessThanOrEqual(after);
		expect(done.completedAt).toBe(done.createdAt);
		expect((await ctx.db.get(todoId)).completedAt).toBeUndefined();
		const inRange = await run(tasks.listDoneInRange, ctx, { startMs: before, endMs: after + 1 });
		expect(inRange.map((t: { title: string }) => t.title)).toEqual(["Already did it"]);
	});

	test("no one signed in is refused", async () => {
		const ctx = makeFakeCtx(A);
		ctx.auth.getUserIdentity = async () => null;
		await expect(run(tasks.listDoneInRange, ctx, { startMs: WEEK_START, endMs: WEEK_END })).rejects.toThrow(
			"Not authenticated",
		);
	});
});
