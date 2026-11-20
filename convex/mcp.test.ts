import { describe, expect, test } from "bun:test";
import { CRISIS_CARD, crisisCardText } from "./lib/crisisWords";
import { hashToken } from "./lib/mcp/token";
import { makeFakeCtx, run } from "./lib/testFakeCtx";
import * as mcp from "./mcp";
import * as mcpTools from "./mcpTools";

const A = "users:a";
const B = "users:b";

/** makeFakeCtx has no `.unique()`; add it on top of `withIndex`. */
function ctxFor(userId: string, extraUsers: string[] = []) {
	const ctx = makeFakeCtx(userId, extraUsers);
	const query = ctx.db.query;
	ctx.db.query = (t: string) => {
		const b = query(t);
		return {
			...b,
			withIndex: (name: string, fn: (q: unknown) => unknown) => {
				const r = b.withIndex(name, fn);
				return { ...r, unique: async () => (await r.collect())[0] ?? null };
			},
		};
	};
	return ctx;
}

async function seedToken(
	ctx: ReturnType<typeof ctxFor>,
	userId: string,
	token: string,
	extra = {},
) {
	const tokenHash = await hashToken(token);
	await ctx.db.insert("mcpTokens", {
		userId,
		name: "t",
		tokenHash,
		prefix: token.slice(0, 8),
		createdAt: 1,
		...extra,
	});
	return tokenHash;
}

describe("mcp token lifecycle", () => {
	test("createToken returns the plaintext once, stores only the hash, listTokens hides it", async () => {
		const ctx = ctxFor(A);
		const created = await run(mcp.createToken, ctx, { name: "Executor" });
		expect(created.token.startsWith("tmcp_")).toBe(true);
		const stored = (await ctx.db.query("mcpTokens").collect())[0];
		expect(stored.tokenHash).toBe(await hashToken(created.token));
		expect(JSON.stringify(stored)).not.toContain(created.token);

		const listed = await run(mcp.listTokens, ctx, {});
		expect(listed).toHaveLength(1);
		expect(JSON.stringify(listed)).not.toContain(created.token);
		expect(listed[0]).not.toHaveProperty("tokenHash");
	});

	test("a pending user cannot create a token", async () => {
		const ctx = ctxFor(A);
		await ctx.db.patch(A, { approvalStatus: "pending" });
		await expect(run(mcp.createToken, ctx, { name: "x" })).rejects.toThrow(
			"ACCOUNT_PENDING_APPROVAL",
		);
	});

	test("max 10 active tokens; revoking frees a slot", async () => {
		const ctx = ctxFor(A);
		const ids: string[] = [];
		for (let i = 0; i < 10; i++)
			ids.push((await run(mcp.createToken, ctx, { name: `t${i}` })).tokenId);
		await expect(
			run(mcp.createToken, ctx, { name: "one more" }),
		).rejects.toThrow("10 active tokens");
		expect(await run(mcp.revokeToken, ctx, { tokenId: ids[0] })).toEqual({
			revoked: true,
		});
		await run(mcp.createToken, ctx, { name: "fits now" });
	});

	test("revokeToken refuses another user's token", async () => {
		const ctx = ctxFor(A, [B]);
		const tokenId = await ctx.db.insert("mcpTokens", {
			userId: B,
			name: "b",
			tokenHash: "h",
			prefix: "p",
			createdAt: 1,
		});
		await expect(run(mcp.revokeToken, ctx, { tokenId })).rejects.toThrow(
			"Token not found",
		);
	});
});

describe("mcp.resolveToken / authorizeCall", () => {
	test("live token resolves; unknown, revoked and deleted-user tokens give null", async () => {
		const ctx = ctxFor(A, [B]);
		const live = await seedToken(ctx, A, "tmcp_live");
		const revoked = await seedToken(ctx, A, "tmcp_revoked", { revokedAt: 5 });
		await ctx.db.patch(B, { deletedAt: 5 });
		const gone = await seedToken(ctx, B, "tmcp_gone");

		expect(await run(mcp.resolveToken, ctx, { tokenHash: live })).toEqual({
			userId: A,
		});
		expect(await run(mcp.resolveToken, ctx, { tokenHash: "nope" })).toBeNull();
		expect(await run(mcp.resolveToken, ctx, { tokenHash: revoked })).toBeNull();
		expect(await run(mcp.resolveToken, ctx, { tokenHash: gone })).toBeNull();
	});

	test("authorizeCall: ok, revoked -> unauthorized, pending -> pending", async () => {
		const ctx = ctxFor(A, [B]);
		await ctx.db.patch(B, { approvalStatus: "pending" });
		const okHash = await seedToken(ctx, A, "tmcp_ok");
		const revokedHash = await seedToken(ctx, A, "tmcp_rev", { revokedAt: 5 });
		const pendingHash = await seedToken(ctx, B, "tmcp_pend");

		expect(await run(mcp.authorizeCall, ctx, { tokenHash: okHash })).toEqual({
			status: "ok",
			userId: A,
		});
		expect(
			await run(mcp.authorizeCall, ctx, { tokenHash: revokedHash }),
		).toEqual({ status: "unauthorized" });
		expect(
			await run(mcp.authorizeCall, ctx, { tokenHash: pendingHash }),
		).toEqual({ status: "pending" });
	});

	test("authorizeCall: 120 calls/min, then rate_limited; lastUsedAt set", async () => {
		const ctx = ctxFor(A);
		const h = await seedToken(ctx, A, "tmcp_rate");
		for (let i = 0; i < 120; i++) {
			expect((await run(mcp.authorizeCall, ctx, { tokenHash: h })).status).toBe(
				"ok",
			);
		}
		expect(await run(mcp.authorizeCall, ctx, { tokenHash: h })).toEqual({
			status: "rate_limited",
		});
		const row = (await ctx.db.query("mcpTokens").collect())[0];
		expect(typeof row.lastUsedAt).toBe("number");
		// New window after a minute.
		await ctx.db.patch(row._id, { windowStartMs: Date.now() - 61_000 });
		expect((await run(mcp.authorizeCall, ctx, { tokenHash: h })).status).toBe(
			"ok",
		);
	});
});

describe("mcp tools", () => {
	test("brain_dump returns crisis resources without calling the model or saving tasks", async () => {
		const ctx = ctxFor(A);
		let mutationCalls = 0;
		(ctx as typeof ctx & { runMutation: () => never }).runMutation = () => {
			mutationCalls++;
			throw new Error("must not save crisis text");
		};

		const result = await run(mcpTools.runBrainDump, ctx, {
			userId: A,
			text: "I want to die",
			accept: true,
		});

		expect(result).toEqual({
			crisis: true,
			accepted: false,
			created: 0,
			plan: { priorities: [] },
			resources: crisisCardText(CRISIS_CARD),
		});
		expect(mutationCalls).toBe(0);
		expect(await ctx.db.query("tasks").collect()).toEqual([]);
	});

	test("task_create then tasks_list sees it; task_update completes it", async () => {
		const ctx = ctxFor(A);
		const created = await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "task_create",
			args: { title: " Buy milk ", notes: "2%", priority: "high" },
		});
		expect(created.task).toMatchObject({
			title: "Buy milk",
			notes: "2%",
			priority: "high",
			status: "todo",
		});

		const listed = await run(mcpTools.runReadTool, ctx, {
			userId: A,
			name: "tasks_list",
			args: {},
		});
		expect(listed.tasks).toHaveLength(1);

		await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "task_update",
			args: { taskId: created.task.id, completed: true },
		});
		const open = await run(mcpTools.runReadTool, ctx, {
			userId: A,
			name: "tasks_list",
			args: {},
		});
		expect(open.tasks).toHaveLength(0);
		const done = await run(mcpTools.runReadTool, ctx, {
			userId: A,
			name: "tasks_list",
			args: { status: "done" },
		});
		expect(done.tasks).toHaveLength(1);
		const all = await run(mcpTools.runReadTool, ctx, {
			userId: A,
			name: "tasks_list",
			args: { status: "all" },
		});
		expect(all.tasks).toHaveLength(1);
	});

	test("cross-user isolation: B's token cannot read or change A's data", async () => {
		const ctx = ctxFor(A, [B]);
		const task = await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "task_create",
			args: { title: "secret" },
		});
		const note = await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "note_create",
			args: { title: "diary", body: "x" },
		});
		const event = await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "calendar_create",
			args: { title: "dentist", startsAtMs: 1000 },
		});

		const read = (name: string, args: unknown) =>
			run(mcpTools.runReadTool, ctx, { userId: B, name, args });
		expect((await read("tasks_list", { status: "all" })).tasks).toEqual([]);
		expect((await read("notes_list", {})).notes).toEqual([]);
		expect(
			(await read("calendar_list", { fromMs: 0, toMs: 10_000 })).events,
		).toEqual([]);

		const write = (name: string, args: unknown) =>
			run(mcpTools.runWriteTool, ctx, { userId: B, name, args });
		await expect(
			write("task_update", { taskId: task.task.id, title: "pwned" }),
		).rejects.toThrow("Task not found");
		await expect(
			write("note_update", { noteId: note.note.id, title: "pwned" }),
		).rejects.toThrow("Note not found");
		await expect(
			write("calendar_update", { eventId: event.event.id, title: "pwned" }),
		).rejects.toThrow("Event not found");
		await expect(
			write("task_update", { taskId: "garbage", title: "x" }),
		).rejects.toThrow("Task not found");
	});

	test("notes and calendar round trip", async () => {
		const ctx = ctxFor(A);
		const w = (name: string, args: unknown) =>
			run(mcpTools.runWriteTool, ctx, { userId: A, name, args });
		const r = (name: string, args: unknown) =>
			run(mcpTools.runReadTool, ctx, { userId: A, name, args });

		const note = await w("note_create", { title: "Idea" });
		expect(note.note).toMatchObject({ title: "Idea", body: "", pinned: false });
		await w("note_update", {
			noteId: note.note.id,
			pinned: true,
			body: "text",
		});
		expect(
			(await r("notes_list", { pinnedOnly: true })).notes[0],
		).toMatchObject({ body: "text", pinned: true });

		const ev = await w("calendar_create", {
			title: "Standup",
			startsAtMs: 5000,
		});
		await w("calendar_update", { eventId: ev.event.id, startsAtMs: 6000 });
		expect(
			(await r("calendar_list", { fromMs: 0, toMs: 10_000 })).events[0],
		).toMatchObject({
			title: "Standup",
			startsAtMs: 6000,
		});
		await expect(r("calendar_list", { fromMs: 10, toMs: 5 })).rejects.toThrow(
			"must end after",
		);
	});

	test("today_plan_get returns the plan and tasks due that day", async () => {
		const ctx = ctxFor(A);
		const noon = Date.parse("2026-10-06T09:00:00Z");
		await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "task_create",
			args: { title: "today", dueAtMs: noon },
		});
		await run(mcpTools.runWriteTool, ctx, {
			userId: A,
			name: "task_create",
			args: { title: "tomorrow", dueAtMs: noon + 86_400_000 },
		});
		const res = await run(mcpTools.runReadTool, ctx, {
			userId: A,
			name: "today_plan_get",
			args: { date: "2026-10-06", timezone: "Asia/Jerusalem" },
		});
		expect(res.date).toBe("2026-10-06");
		expect(res.plan).toBeNull();
		expect(res.tasksDue.map((t: { title: string }) => t.title)).toEqual([
			"today",
		]);
		await expect(
			run(mcpTools.runReadTool, ctx, {
				userId: A,
				name: "today_plan_get",
				args: { timezone: "Mars/Base" },
			}),
		).rejects.toThrow("Unknown timezone");
	});
});
