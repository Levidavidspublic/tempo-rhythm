import { describe, expect, test } from "bun:test";
import * as dayPlans from "./dayPlans";

type Row = Record<string, unknown>;
type Cond = { op: "eq" | "gte" | "lt" | "lte"; field: string; value: unknown };

/**
 * Minimal in-memory Convex ctx (same idea as the fake ctx in `convex/notes.test.ts`),
 * extended so `withIndex` callbacks can chain eq / gte / lt / lte.
 * Undefined sorts before numbers, as in Convex indexes.
 */
function makeFakeCtx(userId: string) {
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
	table("users").set(userId, { _id: userId, email: "a@example.com" });

	const rank = (x: unknown) => (x === undefined ? -Infinity : (x as number | string));
	const matches = (row: Row, c: Cond) => {
		const a = rank(row[c.field]);
		const b = rank(c.value);
		if (c.op === "eq") return row[c.field] === c.value;
		if (c.op === "gte") return a >= b;
		if (c.op === "lt") return a < b;
		return a <= b;
	};

	function builder(rows: Row[], sortField?: string, desc = false) {
		return {
			withIndex: (_name: string, fn: (q: any) => unknown) => {
				const conds: Cond[] = [];
				const q: any = {};
				for (const op of ["eq", "gte", "lt", "lte"] as const) {
					q[op] = (field: string, value: unknown) => {
						conds.push({ op, field, value });
						return q;
					};
				}
				fn(q);
				const range = conds.find((c) => c.op !== "eq");
				return builder(
					rows.filter((r) => conds.every((c) => matches(r, c))),
					range?.field,
				);
			},
			order: (dir: "asc" | "desc") => builder(rows, sortField, dir === "desc"),
			collect: async () => {
				const out = [...rows];
				if (sortField) {
					out.sort((a, b) => (rank(a[sortField]) as number) - (rank(b[sortField]) as number));
					if (desc) out.reverse();
				}
				return out;
			},
		};
	}

	const db = {
		normalizeId: (t: string, id: string) => (table(t).has(id) ? id : null),
		get: async (id: string) => table(id.split(":")[0]).get(id) ?? null,
		insert: async (t: string, doc: Row) => {
			const id = `${t}:${nextId++}`;
			table(t).set(id, { _id: id, _creationTime: 0, ...doc });
			return id;
		},
		patch: async (id: string, patch: Row) => {
			const t = table(id.split(":")[0]);
			t.set(id, { ...t.get(id), ...patch });
		},
		query: (t: string) => builder(Array.from(table(t).values())),
	};
	return { auth: { getUserIdentity: async () => ({ subject: userId }) }, db } as any;
}

const USER = "users:a";
const run = (fn: unknown, ctx: unknown, args: unknown) => (fn as any)._handler(ctx, args);

async function addTask(ctx: any, over: Row = {}) {
	return ctx.db.insert("tasks", {
		userId: USER,
		title: "t",
		status: "todo",
		priority: "medium",
		createdAt: 1,
		updatedAt: 1,
		...over,
	});
}

describe("dayPlans.upsert", () => {
	test("keeps one live plan per localDate and returns the same id", async () => {
		const ctx = makeFakeCtx(USER);
		const a = await run(dayPlans.upsert, ctx, { localDate: "2026-10-05", intention: " Ship it " });
		const b = await run(dayPlans.upsert, ctx, { localDate: "2026-10-05", energy: "high" });
		expect(b).toBe(a);
		const other = await run(dayPlans.upsert, ctx, { localDate: "2026-10-06" });
		expect(other).not.toBe(a);

		const plan = await run(dayPlans.getForDate, ctx, { localDate: "2026-10-05" });
		expect(plan.intention).toBe("Ship it");
		expect(plan.energy).toBe("high");
		expect(plan.status).toBe("draft");
	});

	test("rejects more than 3 top tasks", async () => {
		const ctx = makeFakeCtx(USER);
		const ids = [await addTask(ctx), await addTask(ctx), await addTask(ctx), await addTask(ctx)];
		await expect(
			run(dayPlans.upsert, ctx, { localDate: "2026-10-05", topTaskIds: ids }),
		).rejects.toThrow("at most 3");
		await run(dayPlans.upsert, ctx, { localDate: "2026-10-05", topTaskIds: ids.slice(0, 3) });
	});

	test("rejects tasks the caller does not own", async () => {
		const ctx = makeFakeCtx(USER);
		const foreign = await addTask(ctx, { userId: "users:b" });
		await expect(
			run(dayPlans.upsert, ctx, { localDate: "2026-10-05", topTaskIds: [foreign] }),
		).rejects.toThrow("Task not found");
	});

	test("never moves a committed plan back to draft", async () => {
		const ctx = makeFakeCtx(USER);
		await run(dayPlans.upsert, ctx, { localDate: "2026-10-05" });
		const first = await run(dayPlans.commit, ctx, { localDate: "2026-10-05" });
		await run(dayPlans.upsert, ctx, { localDate: "2026-10-05", intention: "later edit" });
		const plan = await run(dayPlans.getForDate, ctx, { localDate: "2026-10-05" });
		expect(plan.status).toBe("committed");
		const again = await run(dayPlans.commit, ctx, { localDate: "2026-10-05" });
		expect(again).toEqual(first);
	});

	test("commit creates a plan when none exists", async () => {
		const ctx = makeFakeCtx(USER);
		const { dayPlanId } = await run(dayPlans.commit, ctx, { localDate: "2026-10-07" });
		const plan = await run(dayPlans.getForDate, ctx, { localDate: "2026-10-07" });
		expect(plan._id).toBe(dayPlanId);
		expect(plan.status).toBe("committed");
	});

	test("rejects a malformed localDate", async () => {
		const ctx = makeFakeCtx(USER);
		await expect(run(dayPlans.upsert, ctx, { localDate: "10/05/2026" })).rejects.toThrow("YYYY-MM-DD");
	});
});

describe("dayPlans.listCarryOver", () => {
	test("returns open, live, past-due tasks in ascending dueAt, max 50", async () => {
		const ctx = makeFakeCtx(USER);
		const late = await addTask(ctx, { dueAt: 300 });
		const early = await addTask(ctx, { dueAt: 100, status: "in_progress" });
		await addTask(ctx, { dueAt: 150, status: "done" });
		await addTask(ctx, { dueAt: 160, status: "cancelled" });
		await addTask(ctx, { dueAt: 170, deletedAt: 5 });
		await addTask(ctx, { dueAt: 1000 });
		await addTask(ctx, {});
		await addTask(ctx, { userId: "users:b", dueAt: 50 });

		const rows = await run(dayPlans.listCarryOver, ctx, { beforeMs: 500 });
		expect(rows.map((r: Row) => r._id)).toEqual([early, late]);

		for (let i = 0; i < 60; i++) await addTask(ctx, { dueAt: 400 + i });
		const capped = await run(dayPlans.listCarryOver, ctx, { beforeMs: 500 });
		expect(capped).toHaveLength(50);
	});
});

describe("dayPlans.moveTaskToDay", () => {
	test("patches dueAt and updatedAt only, owner checked", async () => {
		const ctx = makeFakeCtx(USER);
		const id = await addTask(ctx, { dueAt: 1 });
		await run(dayPlans.moveTaskToDay, ctx, { taskId: id, dueAt: 999 });
		const task = await ctx.db.get(id);
		expect(task.dueAt).toBe(999);
		expect(task.title).toBe("t");
		expect(task.status).toBe("todo");
		expect(task.updatedAt).toBeGreaterThan(1);

		const foreign = await addTask(ctx, { userId: "users:b" });
		await expect(run(dayPlans.moveTaskToDay, ctx, { taskId: foreign, dueAt: 5 })).rejects.toThrow(
			"Task not found",
		);
	});
});
