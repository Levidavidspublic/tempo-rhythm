import { describe, expect, test } from "bun:test";
import * as calendarEvents from "./calendar_events";
import { GRACE_MS, UNDO_WINDOW_MS, isRestorable, undoUntil } from "./lib/softDelete";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as notes from "./notes";
import * as tasks from "./tasks";

const A = "users:a";
const B = "users:b";
const DAY = 24 * 60 * 60 * 1000;

describe("softDelete helpers", () => {
	test("constants and undoUntil", () => {
		expect(UNDO_WINDOW_MS).toBe(300000);
		expect(GRACE_MS).toBe(30 * DAY);
		expect(undoUntil(1000)).toBe(1000 + 300000);
	});

	test("isRestorable only inside the grace window", () => {
		expect(isRestorable(undefined, 5)).toBe(false);
		expect(isRestorable(1000, 1000 + GRACE_MS)).toBe(true);
		expect(isRestorable(1000, 1001 + GRACE_MS)).toBe(false);
	});
});

describe("calendar events", () => {
	test("update trims, rejects empty, and refuses another user's event", async () => {
		const ctx = makeFakeCtx(A);
		const eventId = await run(calendarEvents.create, ctx, { title: "x", startsAtMs: 5 });
		await run(calendarEvents.update, ctx, { eventId, title: "  Lunch ", startsAtMs: 9 });
		const row = await ctx.db.get(eventId);
		expect(row.title).toBe("Lunch");
		expect(row.startsAtMs).toBe(9);
		await expect(run(calendarEvents.update, ctx, { eventId, title: "  " })).rejects.toThrow();

		const theirs = await ctx.db.insert("calendarEvents", {
			userId: B,
			title: "t",
			startsAtMs: 1,
			createdAt: 1,
			updatedAt: 1,
		});
		await expect(run(calendarEvents.update, ctx, { eventId: theirs, title: "y" })).rejects.toThrow();
		await expect(run(calendarEvents.remove, ctx, { eventId: theirs })).rejects.toThrow();
		await expect(run(calendarEvents.restore, ctx, { eventId: theirs })).rejects.toThrow();
	});

	test("remove hides from list; restore brings it back; refused after 30 days", async () => {
		const ctx = makeFakeCtx(A);
		const eventId = await run(calendarEvents.create, ctx, { title: "x", startsAtMs: 50 });
		const res = await run(calendarEvents.remove, ctx, { eventId });
		expect(res.success).toBe(true);
		expect(res.undoUntilMs).toBeGreaterThan(Date.now());
		expect(await run(calendarEvents.listInRange, ctx, { startMs: 0, endMs: 100 })).toHaveLength(0);

		expect(await run(calendarEvents.restore, ctx, { eventId })).toEqual({ success: true });
		expect(await run(calendarEvents.listInRange, ctx, { startMs: 0, endMs: 100 })).toHaveLength(1);

		await ctx.db.patch(eventId, { deletedAt: Date.now() - GRACE_MS - 1000 });
		expect(await run(calendarEvents.restore, ctx, { eventId })).toEqual({ success: false });
	});
});

describe("tasks", () => {
	test("remove is a soft delete, restore works, and list hides it", async () => {
		const ctx = makeFakeCtx(A);
		const taskId = await run(tasks.create, ctx, {
			title: "t",
			flexibility: "fixed",
			timeEstimate: 60000,
		});
		expect((await ctx.db.get(taskId)).flexibility).toBe("fixed");
		expect((await ctx.db.get(taskId)).timeEstimate).toBe(60000);

		const res = await run(tasks.remove, ctx, { taskId });
		expect(res.success).toBe(true);
		expect(typeof res.undoUntilMs).toBe("number");
		expect(await ctx.db.get(taskId)).not.toBeNull();
		expect(await run(tasks.list, ctx, {})).toHaveLength(0);

		expect(await run(tasks.restore, ctx, { taskId })).toEqual({ success: true });
		expect(await run(tasks.list, ctx, {})).toHaveLength(1);

		await ctx.db.patch(taskId, { deletedAt: Date.now() - GRACE_MS - 1000 });
		expect(await run(tasks.restore, ctx, { taskId })).toEqual({ success: false });
	});

	test("update sets flexibility and clears timeEstimate with null", async () => {
		const ctx = makeFakeCtx(A);
		const taskId = await run(tasks.create, ctx, { title: "t", timeEstimate: 5 });
		await run(tasks.update, ctx, { taskId, flexibility: "elastic", timeEstimate: null });
		const row = await ctx.db.get(taskId);
		expect(row.flexibility).toBe("elastic");
		expect(row.timeEstimate).toBeUndefined();
	});

	test("remove and restore refuse another user's task", async () => {
		const ctx = makeFakeCtx(A);
		const taskId = await ctx.db.insert("tasks", {
			userId: B,
			title: "theirs",
			status: "todo",
			priority: "low",
			createdAt: 1,
			updatedAt: 1,
		});
		await expect(run(tasks.remove, ctx, { taskId })).rejects.toThrow();
		await expect(run(tasks.restore, ctx, { taskId })).rejects.toThrow();
	});
});

describe("notes", () => {
	test("getSafe returns null for a bad id, another user's note, and a deleted note", async () => {
		const ctx = makeFakeCtx(A);
		expect(await run(notes.getSafe, ctx, { noteId: "not-an-id" })).toBeNull();

		const theirs = await ctx.db.insert("notes", {
			userId: B,
			title: "t",
			body: "",
			createdAt: 1,
			updatedAt: 1,
		});
		expect(await run(notes.getSafe, ctx, { noteId: theirs })).toBeNull();

		const noteId = await run(notes.create, ctx, { title: "mine", body: "b" });
		expect((await run(notes.getSafe, ctx, { noteId }))?.title).toBe("mine");
		const res = await run(notes.remove, ctx, { noteId });
		expect(res.success).toBe(true);
		expect(typeof res.undoUntilMs).toBe("number");
		expect(await run(notes.getSafe, ctx, { noteId })).toBeNull();
	});

	test("restore works inside grace and is refused after it", async () => {
		const ctx = makeFakeCtx(A);
		const noteId = await run(notes.create, ctx, { title: "mine", body: "b" });
		await run(notes.remove, ctx, { noteId });
		expect(await run(notes.restore, ctx, { noteId })).toEqual({ success: true });
		expect(await run(notes.getSafe, ctx, { noteId })).not.toBeNull();

		await ctx.db.patch(noteId, { deletedAt: Date.now() - GRACE_MS - 1000 });
		expect(await run(notes.restore, ctx, { noteId })).toEqual({ success: false });
	});
});
