import { describe, expect, test } from "bun:test";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as memory from "./memory";
import * as memoryImport from "./memoryImport";

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

async function rows(ctx: any) {
	return (await ctx.db.query("memories").collect()) as Row[];
}

describe("memory.restore", () => {
	test("brings a forgotten memory back for its owner", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Likes tea");
		await run(memory.forget, ctx, { memoryId: id });
		expect((await ctx.db.get(id)).deletedAt).toBeNumber();

		expect(await run(memory.restore, ctx, { memoryId: id })).toEqual({ success: true });
		expect((await ctx.db.get(id)).deletedAt).toBeUndefined();
	});

	test("refuses another person's memory", async () => {
		const ctx = makeFakeCtx("users:a", ["users:b"]);
		const id = await seed(ctx, "users:b", "Not yours", { deletedAt: Date.now() });
		await expect(run(memory.restore, ctx, { memoryId: id })).rejects.toThrow("Memory not found");
		expect((await ctx.db.get(id)).deletedAt).toBeNumber();
	});

	test("says no once the grace window has passed", async () => {
		const ctx = makeFakeCtx("users:a");
		const id = await seed(ctx, "users:a", "Old", { deletedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });
		expect(await run(memory.restore, ctx, { memoryId: id })).toEqual({ success: false });
	});
});

describe("memory.forgetAll and restoreAll", () => {
	test("forgets every live memory as one batch, and Undo brings back only that batch", async () => {
		const ctx = makeFakeCtx("users:a", ["users:b"]);
		await seed(ctx, "users:a", "One");
		await seed(ctx, "users:a", "Two");
		const earlier = await seed(ctx, "users:a", "Forgotten before", { deletedAt: 5 });
		const foreign = await seed(ctx, "users:b", "Someone else");

		const result = await run(memory.forgetAll, ctx, {});
		expect(result.count).toBe(2);
		const mine = (await rows(ctx)).filter((r) => r.userId === "users:a");
		expect(mine.filter((r) => r.deletedAt === result.forgottenAt)).toHaveLength(2);
		expect((await ctx.db.get(foreign)).deletedAt).toBeUndefined();

		expect(await run(memory.restoreAll, ctx, { forgottenAt: result.forgottenAt })).toEqual({
			restored: 2,
		});
		const live = (await rows(ctx)).filter((r) => r.userId === "users:a" && r.deletedAt === undefined);
		expect(live.map((r) => r.content).sort()).toEqual(["One", "Two"]);
		expect((await ctx.db.get(earlier)).deletedAt).toBe(5);
	});

	test("with ids, forgets only those of the signed-in person", async () => {
		const ctx = makeFakeCtx("users:a", ["users:b"]);
		const keep = await seed(ctx, "users:a", "Keep");
		const drop = await seed(ctx, "users:a", "Drop");
		const foreign = await seed(ctx, "users:b", "Foreign");

		const result = await run(memory.forgetAll, ctx, { memoryIds: [drop, foreign, drop] });
		expect(result.count).toBe(1);
		expect((await ctx.db.get(drop)).deletedAt).toBe(result.forgottenAt);
		expect((await ctx.db.get(keep)).deletedAt).toBeUndefined();
		expect((await ctx.db.get(foreign)).deletedAt).toBeUndefined();
	});

	test("restoreAll does nothing outside the grace window", async () => {
		const ctx = makeFakeCtx("users:a");
		const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
		const id = await seed(ctx, "users:a", "Old", { deletedAt: old });
		expect(await run(memory.restoreAll, ctx, { forgottenAt: old })).toEqual({ restored: 0 });
		expect((await ctx.db.get(id)).deletedAt).toBe(old);
	});
});

describe("memory.list importedFrom", () => {
	test("says where an imported memory came from and leaves the rest unmarked", async () => {
		const ctx = makeFakeCtx("users:a");
		await seed(ctx, "users:a", "Imported", { metadata: { source: "claude", importedAt: 1 } });
		await seed(ctx, "users:a", "Typed");
		await seed(ctx, "users:a", "Odd metadata", { metadata: { source: "email" } });
		const listed = (await run(memory.list, ctx, {})) as Row[];
		const byContent = new Map(listed.map((m) => [m.content, m]));
		expect(byContent.get("Imported")?.importedFrom).toBe("claude");
		expect("importedFrom" in (byContent.get("Typed") ?? {})).toBe(false);
		expect("importedFrom" in (byContent.get("Odd metadata") ?? {})).toBe(false);
	});
});

describe("memoryImport.saveReviewed", () => {
	test("saves only the reviewed items, skips duplicates, and returns their ids", async () => {
		const ctx = makeFakeCtx("users:a");
		await seed(ctx, "users:a", "Likes tea");
		const result = await run(memoryImport.saveReviewed, ctx, {
			source: "chatgpt",
			items: ["  Works   from home ", "likes tea", "x", "Works from home", "Lives in Haifa"],
		});
		expect(result.added).toBe(2);
		expect(result.skipped).toBe(3);
		expect(result.memoryIds).toHaveLength(2);
		const saved = await Promise.all(result.memoryIds.map((id: string) => ctx.db.get(id)));
		expect(saved.map((m: Row) => m.content)).toEqual(["Works from home", "Lives in Haifa"]);
		expect(saved[0]).toMatchObject({ userId: "users:a", metadata: { source: "chatgpt" } });

		const undone = await run(memory.forgetAll, ctx, { memoryIds: result.memoryIds });
		expect(undone.count).toBe(2);
		const live = (await rows(ctx)).filter((r) => r.deletedAt === undefined);
		expect(live.map((r) => r.content)).toEqual(["Likes tea"]);
	});

	test("refuses a signed-out person and an oversized batch", async () => {
		const ctx = makeFakeCtx("users:a");
		const signedOut = { ...ctx, auth: { getUserIdentity: async () => null } };
		await expect(
			run(memoryImport.saveReviewed, signedOut, { source: "claude", items: ["Likes tea"] }),
		).rejects.toThrow("Not authenticated");
		const many = Array.from({ length: 301 }, (_, i) => `memory ${i}`);
		await expect(run(memoryImport.saveReviewed, ctx, { source: "claude", items: many })).rejects.toThrow(
			"300",
		);
		expect(await rows(ctx)).toHaveLength(0);
	});
});
