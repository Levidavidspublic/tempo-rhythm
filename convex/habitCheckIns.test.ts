import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import * as habitCheckIns from "./habitCheckIns";

type Row = Record<string, unknown>;

/** Minimal in-memory Convex ctx (same idea as `convex/dayPlans.test.ts`), eq-only indexes. */
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
	table("users").set("users:b", { _id: "users:b", email: "b@example.com" });

	function builder(rows: Row[]) {
		return {
			withIndex: (_name: string, fn: (q: any) => unknown) => {
				const conds: Array<[string, unknown]> = [];
				const q: any = {
					eq: (field: string, value: unknown) => {
						conds.push([field, value]);
						return q;
					},
				};
				fn(q);
				return builder(rows.filter((r) => conds.every(([f, v]) => r[f] === v)));
			},
			collect: async () => [...rows],
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

async function addHabit(ctx: any, over: Row = {}) {
	return ctx.db.insert("habits", {
		userId: USER,
		name: "h",
		currentStreak: 0,
		longestStreak: 0,
		createdAt: 1,
		updatedAt: 1,
		...over,
	});
}

async function addCheckIn(ctx: any, habitId: string, localDate: string, over: Row = {}) {
	return ctx.db.insert("habitCheckIns", {
		userId: USER,
		habitId,
		localDate,
		checkedAt: 1000,
		source: "habits",
		createdAt: 1,
		updatedAt: 1,
		...over,
	});
}

const check = (ctx: any, habitId: string, localDate: string, asOfLocalDate?: string) =>
	run(habitCheckIns.check, ctx, {
		habitId,
		localDate,
		source: "habits",
		...(asOfLocalDate === undefined ? {} : { asOfLocalDate }),
	});
const undo = (ctx: any, habitId: string, localDate: string, asOfLocalDate?: string) =>
	run(habitCheckIns.undo, ctx, {
		habitId,
		localDate,
		...(asOfLocalDate === undefined ? {} : { asOfLocalDate }),
	});

afterEach(() => {
	setSystemTime();
});

describe("habitCheckIns.check asOfLocalDate", () => {
	test("west of UTC: local date still the 6th while UTC is already the 7th", async () => {
		// 2026-10-07T03:00Z is still 2026-10-06 in the Americas.
		setSystemTime(new Date("2026-10-07T03:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-05");
		const res = await check(ctx, habitId, "2026-10-06", "2026-10-06");
		expect(res.alreadyChecked).toBe(false);
		expect(res.currentStreak).toBe(2);
		expect((await ctx.db.get(habitId)).currentStreak).toBe(2);
	});

	test("west of UTC: UTC fallback would break the streak, local as-of keeps it", async () => {
		setSystemTime(new Date("2026-10-08T02:00:00Z"));
		// UTC is already 10-08 but the user is still on 10-07.
		const setup = async () => {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await addCheckIn(ctx, habitId, "2026-10-05");
			return { ctx, habitId };
		};
		const a = await setup();
		const legacy = await check(a.ctx, a.habitId, "2026-10-06");
		expect(legacy.currentStreak).toBe(0); // UTC today 10-08: latest 10-06 is 2 days back
		const b = await setup();
		const local = await check(b.ctx, b.habitId, "2026-10-06", "2026-10-07");
		expect(local.currentStreak).toBe(2); // local today 10-07: latest 10-06 is yesterday
	});

	test("east of UTC: local date is already the 8th while UTC is the 7th", async () => {
		setSystemTime(new Date("2026-10-07T20:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-06");
		// Local today 10-08: a check-in on 10-06 is two days old -> streak is 0.
		const res = await check(ctx, habitId, "2026-10-04", "2026-10-08");
		expect(res.currentStreak).toBe(0);
		// UTC fallback (10-07) would still count 10-06.
		const ctx2 = makeFakeCtx(USER);
		const h2 = await addHabit(ctx2);
		await addCheckIn(ctx2, h2, "2026-10-06");
		const legacy = await check(ctx2, h2, "2026-10-04");
		expect(legacy.currentStreak).toBe(1);
	});

	test("UTC midnight boundary: fallback flips at 00:00Z, explicit date does not", async () => {
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-05");
		setSystemTime(new Date("2026-10-06T23:59:59Z"));
		const before = await check(ctx, habitId, "2026-10-01");
		expect(before.currentStreak).toBe(1);
		setSystemTime(new Date("2026-10-07T00:00:00Z"));
		const explicit = await check(ctx, habitId, "2026-10-02", "2026-10-06");
		expect(explicit.currentStreak).toBe(1);
		const after = await undo(ctx, habitId, "2026-10-02");
		expect(after.currentStreak).toBe(0);
	});

	test("historical toggle uses distinct current as-of date, not localDate", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-05");
		await addCheckIn(ctx, habitId, "2026-10-06");
		const res = await check(ctx, habitId, "2026-09-01", "2026-10-07");
		expect(res.currentStreak).toBe(2);
		expect(res.longestStreak).toBe(2);
	});

	test("omitted asOfLocalDate falls back to UTC today", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		const res = await check(ctx, habitId, "2026-10-06");
		expect(res).toEqual({
			checkInId: expect.any(String),
			alreadyChecked: false,
			currentStreak: 1,
			longestStreak: 1,
		});
		const stale = await check(ctx, habitId, "2026-10-01");
		expect(stale.currentStreak).toBe(1);
	});

	test("preserves longestStreak (Math.max) and lastCompletedAt from completeToday", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { longestStreak: 9, lastCompletedAt: 5000 });
		const res = await check(ctx, habitId, "2026-10-07", "2026-10-07");
		expect(res.currentStreak).toBe(1);
		expect(res.longestStreak).toBe(9);
		const habit = await ctx.db.get(habitId);
		expect(habit.longestStreak).toBe(9);
		expect(habit.lastCompletedAt).toBe(Date.parse("2026-10-07T12:00:00Z"));
	});

	test("lastCompletedAt is preserved when no check-in rows remain after undo", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { longestStreak: 4, lastCompletedAt: 5000 });
		await addCheckIn(ctx, habitId, "2026-10-07");
		const res = await undo(ctx, habitId, "2026-10-07", "2026-10-07");
		expect(res).toEqual({ removed: true, currentStreak: 0, longestStreak: 4 });
		const habit = await ctx.db.get(habitId);
		expect(habit.lastCompletedAt).toBe(5000);
		expect(habit.longestStreak).toBe(4);
	});

	test("idempotent re-check returns cached values and does not recompute", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { currentStreak: 3, longestStreak: 5 });
		const existing = await addCheckIn(ctx, habitId, "2026-10-06");
		const res = await check(ctx, habitId, "2026-10-06", "2026-10-08");
		expect(res).toEqual({
			checkInId: existing,
			alreadyChecked: true,
			currentStreak: 3,
			longestStreak: 5,
		});
		expect((await ctx.db.get(habitId)).currentStreak).toBe(3);
	});
});

describe("habitCheckIns.undo asOfLocalDate", () => {
	test("historical undo recomputes against the supplied current date", async () => {
		setSystemTime(new Date("2026-10-07T03:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-04");
		await addCheckIn(ctx, habitId, "2026-10-05");
		await addCheckIn(ctx, habitId, "2026-10-06");
		await addCheckIn(ctx, habitId, "2026-09-01");
		const res = await undo(ctx, habitId, "2026-09-01", "2026-10-06");
		expect(res).toEqual({ removed: true, currentStreak: 3, longestStreak: 3 });
		expect((await ctx.db.get(habitId)).currentStreak).toBe(3);
	});

	test("no-op undo returns cached values and leaves the habit untouched", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { currentStreak: 2, longestStreak: 6 });
		const res = await undo(ctx, habitId, "2026-10-06", "2026-10-07");
		expect(res).toEqual({ removed: false, currentStreak: 2, longestStreak: 6 });
		expect((await ctx.db.get(habitId)).updatedAt).toBe(1);
	});

	test("omitted asOfLocalDate falls back to UTC today", async () => {
		setSystemTime(new Date("2026-10-10T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await addCheckIn(ctx, habitId, "2026-10-06");
		await addCheckIn(ctx, habitId, "2026-10-05");
		const res = await undo(ctx, habitId, "2026-10-05");
		expect(res).toEqual({ removed: true, currentStreak: 0, longestStreak: 1 });
	});
});

describe("habitCheckIns asOfLocalDate validation", () => {
	const bad = ["", "2026-13-01", "2026-02-30", "2026-1-1", "tomorrow", "2026-10-07T00:00:00Z"];

	for (const value of bad) {
		test(`check rejects ${JSON.stringify(value)} before writes`, async () => {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await expect(check(ctx, habitId, "2026-10-06", value)).rejects.toThrow(
				"asOfLocalDate must be YYYY-MM-DD",
			);
			expect(await ctx.db.query("habitCheckIns").collect()).toHaveLength(0);
			expect((await ctx.db.get(habitId)).updatedAt).toBe(1);
		});

		test(`check rejects ${JSON.stringify(value)} on the already-checked no-op path`, async () => {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await addCheckIn(ctx, habitId, "2026-10-06");
			await expect(check(ctx, habitId, "2026-10-06", value)).rejects.toThrow(
				"asOfLocalDate must be YYYY-MM-DD",
			);
		});

		test(`undo rejects ${JSON.stringify(value)} before writes`, async () => {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			const id = await addCheckIn(ctx, habitId, "2026-10-06");
			await expect(undo(ctx, habitId, "2026-10-06", value)).rejects.toThrow(
				"asOfLocalDate must be YYYY-MM-DD",
			);
			expect((await ctx.db.get(id)).deletedAt).toBeUndefined();
		});

		test(`undo rejects ${JSON.stringify(value)} on the nothing-to-remove no-op path`, async () => {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await expect(undo(ctx, habitId, "2026-10-06", value)).rejects.toThrow(
				"asOfLocalDate must be YYYY-MM-DD",
			);
		});
	}

	test("localDate is still validated independently", async () => {
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await expect(check(ctx, habitId, "2026-02-30", "2026-10-07")).rejects.toThrow(
			"localDate must be YYYY-MM-DD",
		);
		await expect(undo(ctx, habitId, "nope", "2026-10-07")).rejects.toThrow(
			"localDate must be YYYY-MM-DD",
		);
	});
});

describe("habitCheckIns asOfLocalDate trusted bounds", () => {
	const NOW = "2026-10-07T12:00:00Z";
	const outOfRange = ["2026-10-05", "2026-10-09", "2025-10-07", "2099-01-01"];
	const message = "asOfLocalDate must be within one day of UTC today";

	test("accepts UTC today -1, today and +1 inclusive", async () => {
		setSystemTime(new Date(NOW));
		for (const asOf of ["2026-10-06", "2026-10-07", "2026-10-08"]) {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			const res = await check(ctx, habitId, "2026-10-01", asOf);
			expect(res.alreadyChecked).toBe(false);
			const gone = await undo(ctx, habitId, "2026-10-01", asOf);
			expect(gone.removed).toBe(true);
		}
	});

	test("bounds follow month and year rollover", async () => {
		setSystemTime(new Date("2026-12-31T23:59:59Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		await check(ctx, habitId, "2026-12-01", "2027-01-01");
		await check(ctx, habitId, "2026-12-02", "2026-12-30");
		await expect(check(ctx, habitId, "2026-12-03", "2027-01-02")).rejects.toThrow(message);
		await expect(check(ctx, habitId, "2026-12-03", "2026-12-29")).rejects.toThrow(message);
	});

	test("bounds move with the UTC midnight boundary", async () => {
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		setSystemTime(new Date("2026-10-07T23:59:59Z"));
		await check(ctx, habitId, "2026-10-01", "2026-10-08");
		await expect(check(ctx, habitId, "2026-10-02", "2026-10-09")).rejects.toThrow(message);
		setSystemTime(new Date("2026-10-08T00:00:00Z"));
		await check(ctx, habitId, "2026-10-02", "2026-10-09");
		await expect(check(ctx, habitId, "2026-10-03", "2026-10-06")).rejects.toThrow(message);
	});

	for (const value of outOfRange) {
		test(`check rejects ${value} before writes`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await expect(check(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
			expect(await ctx.db.query("habitCheckIns").collect()).toHaveLength(0);
			expect((await ctx.db.get(habitId)).updatedAt).toBe(1);
		});

		test(`check rejects ${value} on the already-checked no-op path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx, { currentStreak: 3 });
			await addCheckIn(ctx, habitId, "2026-10-06");
			await expect(check(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
			expect((await ctx.db.get(habitId)).currentStreak).toBe(3);
		});

		test(`undo rejects ${value} before writes`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx, { currentStreak: 3 });
			const id = await addCheckIn(ctx, habitId, "2026-10-06");
			await expect(undo(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
			expect((await ctx.db.get(id)).deletedAt).toBeUndefined();
			expect((await ctx.db.get(habitId)).currentStreak).toBe(3);
		});

		test(`undo rejects ${value} on the nothing-to-remove no-op path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await expect(undo(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
		});
	}

	test("historical localDate edits stay allowed with a bounded as-of date", async () => {
		setSystemTime(new Date(NOW));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		const res = await check(ctx, habitId, "2020-01-01", "2026-10-07");
		expect(res.alreadyChecked).toBe(false);
		const gone = await undo(ctx, habitId, "2020-01-01", "2026-10-07");
		expect(gone.removed).toBe(true);
	});

	test("a rejected as-of date does not touch another user's habit or rows", async () => {
		setSystemTime(new Date(NOW));
		const ctx = makeFakeCtx(USER);
		const theirs = await addHabit(ctx, { userId: "users:b", currentStreak: 2 });
		const row = await addCheckIn(ctx, theirs, "2026-10-06", { userId: "users:b" });
		await expect(undo(ctx, theirs, "2026-10-06", "2099-01-01")).rejects.toThrow(message);
		expect((await ctx.db.get(row)).deletedAt).toBeUndefined();
		expect((await ctx.db.get(theirs)).currentStreak).toBe(2);
	});
});

describe("habitCheckIns ownership and deletion", () => {
	test("another user's habit is not found and untouched, for both mutations", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { userId: "users:b", currentStreak: 2 });
		await expect(check(ctx, habitId, "2026-10-06", "2026-10-07")).rejects.toThrow("Habit not found");
		await expect(undo(ctx, habitId, "2026-10-06", "2026-10-07")).rejects.toThrow("Habit not found");
		expect(await ctx.db.query("habitCheckIns").collect()).toHaveLength(0);
		expect((await ctx.db.get(habitId)).currentStreak).toBe(2);
	});

	test("soft-deleted habits are not revived by either mutation", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx, { deletedAt: 5 });
		await expect(check(ctx, habitId, "2026-10-06", "2026-10-07")).rejects.toThrow("Habit not found");
		await expect(undo(ctx, habitId, "2026-10-06", "2026-10-07")).rejects.toThrow("Habit not found");
		const habit = await ctx.db.get(habitId);
		expect(habit.deletedAt).toBe(5);
		expect(habit.currentStreak).toBe(0);
	});

	test("soft-deleted check-ins are ignored: re-check inserts a new row and does not revive", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		const deleted = await addCheckIn(ctx, habitId, "2026-10-06", { deletedAt: 9 });
		const res = await check(ctx, habitId, "2026-10-06", "2026-10-07");
		expect(res.alreadyChecked).toBe(false);
		expect(res.checkInId).not.toBe(deleted);
		expect((await ctx.db.get(deleted)).deletedAt).toBe(9);
	});

	test("another user's check-ins on the same date do not affect isolation", async () => {
		setSystemTime(new Date("2026-10-07T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const mine = await addHabit(ctx);
		const theirs = await addHabit(ctx, { userId: "users:b" });
		await addCheckIn(ctx, theirs, "2026-10-06", { userId: "users:b" });
		const res = await check(ctx, mine, "2026-10-07", "2026-10-07");
		expect(res.currentStreak).toBe(1);
		const other = await undo(ctx, mine, "2026-10-06", "2026-10-07");
		expect(other.removed).toBe(false);
	});
});

async function snapshot(ctx: any) {
	const state: Record<string, Row[]> = {};
	for (const name of ["users", "habits", "habitCheckIns"]) {
		state[name] = structuredClone(await ctx.db.query(name).collect());
	}
	return state;
}

async function seedFullState(ctx: any) {
	const habitId = await addHabit(ctx, {
		currentStreak: 3,
		longestStreak: 7,
		lastCompletedAt: 4242,
		updatedAt: 77,
	});
	await addCheckIn(ctx, habitId, "2026-10-06");
	await addCheckIn(ctx, habitId, "2026-10-05", { deletedAt: 9 });
	const other = await addHabit(ctx, { userId: "users:b", currentStreak: 2, updatedAt: 55 });
	await addCheckIn(ctx, other, "2026-10-06", { userId: "users:b" });
	return habitId;
}

describe("habitCheckIns rejected calls leave complete persisted state unchanged", () => {
	const NOW = "2026-10-07T12:00:00Z";
	const format = "asOfLocalDate must be YYYY-MM-DD";
	const window = "asOfLocalDate must be within one day of UTC today";
	const rejected: Array<[string, string]> = [
		["", format],
		["2026-13-01", format],
		["2026-02-30", format],
		["2026-1-1", format],
		["tomorrow", format],
		["2026-10-07T00:00:00Z", format],
		["2026-10-05", window],
		["2026-10-09", window],
		["2099-01-01", window],
	];

	for (const [value, message] of rejected) {
		const label = JSON.stringify(value);
		// 2026-10-01 has no row (write path); 2026-10-06 already has one (no-op path).
		test(`check ${label}: write path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await seedFullState(ctx);
			const before = await snapshot(ctx);
			await expect(check(ctx, habitId, "2026-10-01", value)).rejects.toThrow(message);
			expect(await snapshot(ctx)).toEqual(before);
		});

		test(`check ${label}: already-checked path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await seedFullState(ctx);
			const before = await snapshot(ctx);
			await expect(check(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
			expect(await snapshot(ctx)).toEqual(before);
		});

		test(`undo ${label}: write path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await seedFullState(ctx);
			const before = await snapshot(ctx);
			await expect(undo(ctx, habitId, "2026-10-06", value)).rejects.toThrow(message);
			expect(await snapshot(ctx)).toEqual(before);
		});

		test(`undo ${label}: nothing-to-remove path`, async () => {
			setSystemTime(new Date(NOW));
			const ctx = makeFakeCtx(USER);
			const habitId = await seedFullState(ctx);
			const before = await snapshot(ctx);
			await expect(undo(ctx, habitId, "2026-10-01", value)).rejects.toThrow(message);
			expect(await snapshot(ctx)).toEqual(before);
		});
	}

	test("malformed localDate is rejected without changing state", async () => {
		setSystemTime(new Date(NOW));
		const ctx = makeFakeCtx(USER);
		const habitId = await seedFullState(ctx);
		const before = await snapshot(ctx);
		await expect(check(ctx, habitId, "2026-02-30", "2026-10-07")).rejects.toThrow(
			"localDate must be YYYY-MM-DD",
		);
		await expect(undo(ctx, habitId, "", "2026-10-07")).rejects.toThrow(
			"localDate must be YYYY-MM-DD",
		);
		expect(await snapshot(ctx)).toEqual(before);
	});
});

describe("habitCheckIns as-of window across leap day (2028)", () => {
	const message = "asOfLocalDate must be within one day of UTC today";

	/** Accepted dates work for check and undo (write and no-op); rejected dates change nothing. */
	async function expectWindow(now: string, accepted: string[], rejectedDates: string[]) {
		setSystemTime(new Date(now));
		for (const asOf of accepted) {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			expect((await check(ctx, habitId, "2028-02-01", asOf)).alreadyChecked).toBe(false);
			expect((await check(ctx, habitId, "2028-02-01", asOf)).alreadyChecked).toBe(true);
			expect((await undo(ctx, habitId, "2028-02-01", asOf)).removed).toBe(true);
			expect((await undo(ctx, habitId, "2028-02-01", asOf)).removed).toBe(false);
		}
		for (const asOf of rejectedDates) {
			const ctx = makeFakeCtx(USER);
			const habitId = await addHabit(ctx);
			await addCheckIn(ctx, habitId, "2028-02-02");
			const before = await snapshot(ctx);
			await expect(check(ctx, habitId, "2028-02-01", asOf)).rejects.toThrow(message);
			await expect(check(ctx, habitId, "2028-02-02", asOf)).rejects.toThrow(message);
			await expect(undo(ctx, habitId, "2028-02-02", asOf)).rejects.toThrow(message);
			await expect(undo(ctx, habitId, "2028-02-01", asOf)).rejects.toThrow(message);
			expect(await snapshot(ctx)).toEqual(before);
		}
	}

	test("UTC Feb 28 spans Feb 27..Feb 29, rejects Feb 26 and Mar 1", async () => {
		await expectWindow(
			"2028-02-28T23:59:59Z",
			["2028-02-27", "2028-02-28", "2028-02-29"],
			["2028-02-26", "2028-03-01"],
		);
	});

	test("UTC Feb 29 spans Feb 28..Mar 1, rejects Feb 27 and Mar 2", async () => {
		await expectWindow(
			"2028-02-29T12:00:00Z",
			["2028-02-28", "2028-02-29", "2028-03-01"],
			["2028-02-27", "2028-03-02"],
		);
	});

	test("UTC Mar 1 spans Feb 29..Mar 2, rejects Feb 28 and Mar 3", async () => {
		await expectWindow(
			"2028-03-01T00:00:00Z",
			["2028-02-29", "2028-03-01", "2028-03-02"],
			["2028-02-28", "2028-03-03"],
		);
	});

	test("Feb 29 is impossible in non-leap 2027 and the window skips it", async () => {
		setSystemTime(new Date("2027-02-28T12:00:00Z"));
		const ctx = makeFakeCtx(USER);
		const habitId = await addHabit(ctx);
		const before = await snapshot(ctx);
		await expect(check(ctx, habitId, "2027-02-01", "2027-02-29")).rejects.toThrow(
			"asOfLocalDate must be YYYY-MM-DD",
		);
		expect(await snapshot(ctx)).toEqual(before);
		expect((await check(ctx, habitId, "2027-02-01", "2027-03-01")).alreadyChecked).toBe(false);
		await expect(check(ctx, habitId, "2027-02-02", "2027-03-02")).rejects.toThrow(message);
	});
});
