import { describe, expect, test } from "bun:test";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as memory from "./memory";

type Row = Record<string, unknown>;

async function seed(ctx: any, userId: string, content: string, extra: Row = {}) {
	return ctx.db.insert("memories", {
		userId,
		content,
		sector: "general",
		salience: 0.5,
		decayRate: 0.01,
		lastAccessed: 1,
		accessCount: 0,
		createdAt: 1,
		updatedAt: 1,
		deletedAt: undefined,
		...extra,
	});
}

describe("memory.update", () => {
	test("changes the words, trims them, sets updatedAt and returns the old words", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Likes tea");
		const result = await run(memory.update, ctx, { memoryId: id, content: "  Likes green tea  " });
		expect(result).toEqual({ success: true, previous: "Likes tea" });
		const row = await ctx.db.get(id);
		expect(row.content).toBe("Likes green tea");
		expect(row.updatedAt).toBeGreaterThan(1);
		expect(row.createdAt).toBe(1);
	});

	test("Undo is the same call with the old words", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Before");
		const { previous } = await run(memory.update, ctx, { memoryId: id, content: "After" });
		await run(memory.update, ctx, { memoryId: id, content: previous });
		expect((await ctx.db.get(id)).content).toBe("Before");
	});

	test("refuses another person's memory and leaves it alone", async () => {
		const ctx = makeFakeCtx("users:a", ["users:b"]);
		const id = await seed(ctx, "users:b", "Not yours");
		await expect(run(memory.update, ctx, { memoryId: id, content: "Mine now" })).rejects.toThrow(
			"Memory not found",
		);
		expect((await ctx.db.get(id)).content).toBe("Not yours");
	});

	test("refuses a forgotten memory", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Gone", { deletedAt: Date.now() });
		await expect(run(memory.update, ctx, { memoryId: id, content: "Back?" })).rejects.toThrow(
			"Memory not found",
		);
	});

	test("matches remember's limits: blank and too long are refused", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Keep me");
		await expect(run(memory.update, ctx, { memoryId: id, content: "   " })).rejects.toThrow(
			"Write something to remember first.",
		);
		await expect(run(memory.update, ctx, { memoryId: id, content: "x".repeat(2001) })).rejects.toThrow(
			"2000 characters",
		);
		await run(memory.update, ctx, { memoryId: id, content: "y".repeat(2000) });
		expect((await ctx.db.get(id)).content).toHaveLength(2000);
	});
});
