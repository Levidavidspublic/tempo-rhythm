import { describe, expect, test } from "bun:test";
import * as brainDump from "./brain_dump";
import * as coach from "./coach";
import * as crisis from "./crisis";
import * as memory from "./memory";
import * as nags from "./nags";

type Row = Record<string, unknown>;

/**
 * Minimal in-memory Convex ctx (same idea as `convex/notes.test.ts`), with
 * chained `q.eq(...)` support so two-field indexes work.
 */
function makeFakeCtx() {
	const tables = new Map<string, Map<string, Row>>();
	let nextId = 1;
	const table = (name: string) => {
		let t = tables.get(name);
		if (!t) {
			t = new Map();
			tables.set(name, t);
		}
		return t;
	};
	const user = { _id: "users:a", email: "a@example.com" };
	table("users").set(user._id, user);

	function query(rows: Row[]) {
		return {
			withIndex: (_name: string, build: (q: unknown) => unknown) => {
				const filters: [string, unknown][] = [];
				const q = {
					eq: (field: string, value: unknown) => {
						filters.push([field, value]);
						return q;
					},
				};
				build(q);
				return query(rows.filter((r) => filters.every(([f, v]) => r[f] === v)));
			},
			collect: async () => rows,
			first: async () => rows[0] ?? null,
		};
	}

	const db = {
		normalizeId: (name: string, id: string) => (table(name).has(id) ? id : null),
		// Tests only read rows they inserted, so the row is always present.
		get: async (id: string) => table(id.split(":")[0] as string).get(id) as Row,
		insert: async (name: string, doc: Row) => {
			const id = `${name}:${nextId++}`;
			table(name).set(id, { _id: id, ...doc });
			return id;
		},
		patch: async (id: string, patch: Row) => {
			const t = table(id.split(":")[0] as string);
			t.set(id, { ...t.get(id), ...patch });
		},
		query: (name: string) => query(Array.from(table(name).values())),
	};
	const ctx = { auth: { getUserIdentity: async () => ({ subject: user._id }) }, db } as any;
	return { ctx, db, user };
}

const run = (fn: unknown, ctx: unknown, args: unknown = {}) => (fn as any)._handler(ctx, args);

async function addTask(db: any, userId: string, extra: Row = {}) {
	return db.insert("tasks", {
		userId,
		title: "Task",
		status: "todo",
		priority: "medium",
		createdAt: 1,
		updatedAt: 1,
		...extra,
	});
}

describe("brain_dump.acceptPlan", () => {
	test("inserts todo tasks with priority from urgency", async () => {
		const { ctx, db } = makeFakeCtx();
		const res = await run(brainDump.acceptPlan, ctx, {
			items: [
				{ title: " Call Sam ", urgency: "now" },
				{ title: "Plan trip", urgency: "soon" },
				{ title: "Read", urgency: "later" },
			],
		});
		expect(res.created).toBe(3);
		const rows = await Promise.all(res.taskIds.map((id: string) => db.get(id)));
		expect(rows.map((r: Row) => r.priority)).toEqual(["high", "medium", "low"]);
		expect(rows[0].title).toBe("Call Sam");
		expect(rows.every((r: Row) => r.status === "todo")).toBe(true);
	});

	test("rejects 0 items, 7 items and blank titles", async () => {
		const { ctx } = makeFakeCtx();
		const item = { title: "x", urgency: "now" };
		await expect(run(brainDump.acceptPlan, ctx, { items: [] })).rejects.toThrow();
		await expect(run(brainDump.acceptPlan, ctx, { items: Array(7).fill(item) })).rejects.toThrow();
		await expect(
			run(brainDump.acceptPlan, ctx, { items: [{ title: "  ", urgency: "now" }] }),
		).rejects.toThrow();
	});
});

describe("crisis", () => {
	test("check flags crisis text only", async () => {
		const { ctx } = makeFakeCtx();
		expect(await run(crisis.check, ctx, { text: "I want to die" })).toEqual({ isCrisis: true });
		expect(await run(crisis.check, ctx, { text: "buy milk" })).toEqual({ isCrisis: false });
	});

	test("resourcesCard returns the fixed card", async () => {
		const { ctx } = makeFakeCtx();
		const card = await run(crisis.resourcesCard, ctx);
		expect(card.resources.length).toBeGreaterThan(0);
	});
});

describe("coach.sendMessage crisis branch", () => {
	test("stores the card as the assistant message and flags crisis", async () => {
		const { ctx, db, user } = makeFakeCtx();
		const conversationId = await db.insert("conversations", {
			userId: user._id,
			title: "t",
			createdAt: 1,
			updatedAt: 1,
		});
		const res = await run(coach.sendMessage, ctx, { conversationId, content: "I want to die" });
		expect(res).toEqual({ success: true, crisis: true });
		const msgs = await db.query("messages").collect();
		const reply = msgs.find((m: Row) => m.role === "assistant") as Row;
		expect(reply.modelUsed).toBe("crisis-card");
	});

	test("non-crisis keeps the old return shape", async () => {
		const { ctx, db, user } = makeFakeCtx();
		const conversationId = await db.insert("conversations", {
			userId: user._id,
			title: "t",
			createdAt: 1,
			updatedAt: 1,
		});
		const res = await run(coach.sendMessage, ctx, { conversationId, content: "help me start" });
		expect(res).toEqual({ success: true });
	});
});

describe("coach settings, panic and bad day", () => {
	test("defaults, setDial validation and persistence", async () => {
		const { ctx } = makeFakeCtx();
		expect(await run(coach.getSettings, ctx)).toEqual({
			dial: 5,
			taskLoad: 2,
			panicUntil: null,
			acceptedStreak: 0,
		});
		await run(coach.setDial, ctx, { dial: 8 });
		expect((await run(coach.getSettings, ctx)).dial).toBe(8);
		await expect(run(coach.setDial, ctx, { dial: 11 })).rejects.toThrow();
		await expect(run(coach.setDial, ctx, { dial: 2.5 })).rejects.toThrow();
	});

	test("panic sets 30 minutes, drives badDay, and clears", async () => {
		const { ctx } = makeFakeCtx();
		const before = Date.now();
		const res = await run(coach.pressPanic, ctx);
		expect(res.panicUntil).toBeGreaterThanOrEqual(before + 30 * 60_000);
		expect(res.action.text.length).toBeGreaterThan(0);
		expect(await run(coach.badDay, ctx)).toEqual({
			isBadDay: true,
			reason: "panic",
			suggestedLoad: 2,
		});
		await run(coach.clearPanic, ctx);
		expect((await run(coach.getSettings, ctx)).panicUntil).toBeNull();
		expect((await run(coach.badDay, ctx)).reason).toBe("low_activity");
	});

	test("a recent completion means not a bad day", async () => {
		const { ctx, db, user } = makeFakeCtx();
		await addTask(db, user._id, { status: "done", completedAt: Date.now() });
		expect(await run(coach.badDay, ctx)).toEqual({
			isBadDay: false,
			reason: null,
			suggestedLoad: 2,
		});
	});
});

describe("coach proposals", () => {
	test("createProposal needs open tasks", async () => {
		const { ctx } = makeFakeCtx();
		await expect(run(coach.createProposal, ctx)).rejects.toThrow();
		expect(await run(coach.currentProposal, ctx)).toBeNull();
	});

	test("a bad day proposes 2 tasks; accept sets dueAt and counts a streak", async () => {
		const { ctx, db, user } = makeFakeCtx();
		for (let i = 0; i < 4; i++) {
			await addTask(db, user._id, { title: `T${i}`, createdAt: i });
		}
		const id = await run(coach.createProposal, ctx);
		const current = await run(coach.currentProposal, ctx);
		expect(current._id).toBe(id);
		expect(current.tasks).toHaveLength(2);
		expect(current.tasks[0].minutes).toBe(25);
		expect(current.realism.ok).toBe(true);

		const res = await run(coach.decideProposal, ctx, { proposalId: id, decision: "accept" });
		expect(res).toEqual({ status: "accepted", taskLoad: 2 });
		const task = await db.get(current.tasks[0].taskId);
		expect(typeof task.dueAt).toBe("number");
		expect((await run(coach.getSettings, ctx)).acceptedStreak).toBe(1);
		expect(await run(coach.currentProposal, ctx)).toBeNull();
		await expect(
			run(coach.decideProposal, ctx, { proposalId: id, decision: "accept" }),
		).rejects.toThrow();
	});

	test("reject changes no task and returns the load to 2", async () => {
		const { ctx, db, user } = makeFakeCtx();
		await addTask(db, user._id);
		const id = await run(coach.createProposal, ctx);
		const current = await run(coach.currentProposal, ctx);
		const res = await run(coach.decideProposal, ctx, { proposalId: id, decision: "reject" });
		expect(res).toEqual({ status: "rejected", taskLoad: 2 });
		expect((await db.get(current.tasks[0].taskId)).dueAt).toBeUndefined();
	});

	test("three accepts raise the load to 3", async () => {
		const { ctx, db, user } = makeFakeCtx();
		await addTask(db, user._id, { createdAt: 1 });
		await addTask(db, user._id, { createdAt: 2 });
		await addTask(db, user._id, { createdAt: 3 });
		let last = { taskLoad: 0 };
		for (let i = 0; i < 3; i++) {
			const id = await run(coach.createProposal, ctx);
			last = await run(coach.decideProposal, ctx, { proposalId: id, decision: "accept" });
		}
		expect(last.taskLoad).toBe(3);
	});
});

describe("nags", () => {
	test("create starts disabled and empty; list returns it", async () => {
		const { ctx } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		const list = await run(nags.list, ctx);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ _id: nagId, enabled: false, phrases: [] });
		await expect(run(nags.create, ctx, { label: "  " })).rejects.toThrow();
	});

	test("cannot enable without an accepted phrase", async () => {
		const { ctx } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		await expect(run(nags.setEnabled, ctx, { nagId, enabled: true })).rejects.toThrow(
			"Add a phrase you accept first.",
		);
		await run(nags.addPhrase, ctx, { nagId, text: "Meds time", source: "user" });
		await run(nags.setEnabled, ctx, { nagId, enabled: true });
		expect((await run(nags.list, ctx))[0].enabled).toBe(true);
	});

	test("user phrases are accepted, derived are proposed until decided", async () => {
		const { ctx } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		await run(nags.addPhrase, ctx, { nagId, text: "Mine", source: "user" });
		const { phraseId } = await run(nags.addPhrase, ctx, { nagId, text: "Derived", source: "derived" });
		let phrases = (await run(nags.list, ctx))[0].phrases;
		expect(phrases.map((p: Row) => p.status)).toEqual(["accepted", "proposed"]);
		await run(nags.decidePhrase, ctx, { nagId, phraseId, decision: "reject" });
		phrases = (await run(nags.list, ctx))[0].phrases;
		expect(phrases[1].status).toBe("rejected");
	});

	test("rejects empty, long and emoji phrases", async () => {
		const { ctx } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		for (const text of ["", "a".repeat(141), "go \u{1F680}"]) {
			await expect(run(nags.addPhrase, ctx, { nagId, text, source: "user" })).rejects.toThrow();
		}
	});

	test("rejecting the last accepted phrase switches the nag off", async () => {
		const { ctx } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		const { phraseId } = await run(nags.addPhrase, ctx, { nagId, text: "Mine", source: "user" });
		await run(nags.setEnabled, ctx, { nagId, enabled: true });
		await run(nags.decidePhrase, ctx, { nagId, phraseId, decision: "reject" });
		expect((await run(nags.list, ctx))[0].enabled).toBe(false);
	});

	test("remove soft-deletes and hides the nag", async () => {
		const { ctx, db } = makeFakeCtx();
		const nagId = await run(nags.create, ctx, { label: "Meds" });
		await run(nags.remove, ctx, { nagId });
		expect(typeof (await db.get(nagId)).deletedAt).toBe("number");
		expect(await run(nags.list, ctx)).toHaveLength(0);
	});
});

describe("memory", () => {
	test("remember, list, recall and context use live rows by salience", async () => {
		const { ctx, db } = makeFakeCtx();
		const a = await run(memory.remember, ctx, { content: "Likes tea", sector: "semantic" });
		await run(memory.remember, ctx, { content: "Slept badly" });
		await db.patch(a, { salience: 0.9 });

		const all = await run(memory.list, ctx, {});
		expect(all).toHaveLength(2);
		expect(all[0]._id).toBe(a);
		expect(Object.keys(all[0]).sort()).toEqual(
			["_id", "content", "createdAt", "lastAccessed", "salience", "sector", "updatedAt"].sort(),
		);
		expect(await run(memory.list, ctx, { sector: "general" })).toHaveLength(1);
		expect(await run(memory.recall, ctx, { query: "TEA" })).toHaveLength(1);
		expect(await run(memory.recall, ctx, { query: "" })).toEqual([]);
		const c = await run(memory.context, ctx, { limit: 1 });
		expect(c).toEqual({ text: "- Likes tea", count: 1 });
	});

	test("forget soft-deletes and hides from every read", async () => {
		const { ctx, db } = makeFakeCtx();
		const id = await run(memory.remember, ctx, { content: "Secret" });
		await run(memory.forget, ctx, { memoryId: id });
		expect(typeof (await db.get(id)).deletedAt).toBe("number");
		expect(await run(memory.list, ctx, {})).toHaveLength(0);
		expect(await run(memory.recall, ctx, { query: "secret" })).toHaveLength(0);
		expect((await run(memory.exportAll, ctx)).count).toBe(0);
		await expect(run(memory.forget, ctx, { memoryId: id })).rejects.toThrow();
	});

	test("exportAll gives markdown per sector and a dated filename", async () => {
		const { ctx } = makeFakeCtx();
		await run(memory.remember, ctx, { content: "Likes tea", sector: "semantic" });
		await run(memory.remember, ctx, { content: "Calm in mornings", sector: "emotional" });
		const out = await run(memory.exportAll, ctx);
		expect(out.filename).toMatch(/^tempo-memories-\d{4}-\d{2}-\d{2}\.md$/);
		expect(out.count).toBe(2);
		expect(out.markdown).toContain("## Semantic");
		expect(out.markdown).toContain("## Emotional");
		expect(out.markdown).toContain("- Likes tea");
	});

	test("exportAll says where each imported memory came from", async () => {
		const { ctx, db } = makeFakeCtx();
		await run(memory.remember, ctx, { content: "Likes tea" });
		const fromChatGpt = await run(memory.remember, ctx, { content: "Runs on Sundays" });
		await db.patch(fromChatGpt, { metadata: { source: "chatgpt", importedAt: 1 } });
		const fromOther = await run(memory.remember, ctx, { content: "Plays cello" });
		await db.patch(fromOther, { metadata: { source: "other", importedAt: 1 } });
		const unknownSource = await run(memory.remember, ctx, { content: "Reads at night" });
		await db.patch(unknownSource, { metadata: { source: "somewhere" } });

		const lines = (await run(memory.exportAll, ctx)).markdown.split("\n");
		expect(lines).toContain("- Likes tea");
		expect(lines).toContain("- Runs on Sundays (imported from ChatGPT)");
		expect(lines).toContain("- Plays cello (imported)");
		expect(lines).toContain("- Reads at night");
	});
});
