import { describe, expect, test } from "bun:test";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as tasks from "./tasks";

const A = "users:a";
const B = "users:b";

async function seedTask(ctx: any, userId: string, projectId: string | undefined, extra: Record<string, unknown> = {}) {
	return ctx.db.insert("tasks", {
		userId,
		title: "t",
		status: "todo",
		priority: "medium",
		projectId,
		projectName: "Old name",
		createdAt: 1,
		updatedAt: 1,
		...extra,
	});
}

describe("tasks.renameProject", () => {
	test("renames every live task of the caller's in that project, trimmed, in one call", async () => {
		const ctx = makeFakeCtx(A, [B]);
		const one = await seedTask(ctx, A, "moving");
		const two = await seedTask(ctx, A, "moving", { status: "done" });
		const deleted = await seedTask(ctx, A, "moving", { deletedAt: 5 });
		const otherProject = await seedTask(ctx, A, "garden");
		const theirs = await seedTask(ctx, B, "moving");

		expect(await run(tasks.renameProject, ctx, { projectId: " moving ", name: "  New flat  " })).toBe(2);

		expect((await ctx.db.get(one)).projectName).toBe("New flat");
		expect((await ctx.db.get(two)).projectName).toBe("New flat");
		expect((await ctx.db.get(one)).updatedAt).toBeGreaterThan(1);
		expect((await ctx.db.get(deleted)).projectName).toBe("Old name");
		expect((await ctx.db.get(otherProject)).projectName).toBe("Old name");
		expect((await ctx.db.get(theirs)).projectName).toBe("Old name");
	});

	test("refuses an empty name and leaves the tasks alone", async () => {
		const ctx = makeFakeCtx(A);
		const id = await seedTask(ctx, A, "moving");
		await expect(run(tasks.renameProject, ctx, { projectId: "moving", name: "   " })).rejects.toThrow();
		await expect(run(tasks.renameProject, ctx, { projectId: "  ", name: "Name" })).rejects.toThrow();
		expect((await ctx.db.get(id)).projectName).toBe("Old name");
	});

	test("renames nothing when the caller has no tasks in that project", async () => {
		const ctx = makeFakeCtx(A, [B]);
		const theirs = await seedTask(ctx, B, "moving");
		expect(await run(tasks.renameProject, ctx, { projectId: "moving", name: "Mine now" })).toBe(0);
		expect((await ctx.db.get(theirs)).projectName).toBe("Old name");
	});
});
