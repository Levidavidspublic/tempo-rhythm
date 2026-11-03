import { describe, expect, test } from "bun:test";
import {
	TEN_SECOND_ACTIONS,
	afterAccept,
	afterReject,
	checkRealism,
	effectiveLoad,
	pickTenSecondAction,
	taskMinutes,
} from "./coachLoad";

const SHAME_WORDS = /\b(behind|failing|failure|lazy|laziness|overdue)\b/i;

describe("load rule", () => {
	test("three accepts in a row raise the load by one", () => {
		let s = { taskLoad: 2, acceptedStreak: 0 };
		s = afterAccept(s.taskLoad, s.acceptedStreak);
		s = afterAccept(s.taskLoad, s.acceptedStreak);
		expect(s).toEqual({ taskLoad: 2, acceptedStreak: 2 });
		s = afterAccept(s.taskLoad, s.acceptedStreak);
		expect(s).toEqual({ taskLoad: 3, acceptedStreak: 0 });
	});

	test("load never goes above 4", () => {
		expect(afterAccept(4, 2).taskLoad).toBe(4);
	});

	test("a reject returns the load to 2 with no streak", () => {
		expect(afterReject()).toEqual({ taskLoad: 2, acceptedStreak: 0 });
	});

	test("a bad day is load 2", () => {
		expect(effectiveLoad(4, true)).toBe(2);
		expect(effectiveLoad(4, false)).toBe(4);
	});
});

describe("realism", () => {
	test("uses the estimate in minutes, else 25", () => {
		expect(taskMinutes({ timeEstimate: 10 * 60_000 })).toBe(10);
		expect(taskMinutes({})).toBe(25);
	});

	test("ok when the total fits the available minutes", () => {
		const r = checkRealism([{ timeEstimate: 30 * 60_000 }, {}], 60);
		expect(r).toMatchObject({ ok: true, totalMinutes: 55, availableMinutes: 60 });
	});

	test("not ok when over, with copy that never shames", () => {
		const r = checkRealism([{}, {}, {}], 60);
		expect(r.ok).toBe(false);
		expect(r.note).not.toMatch(SHAME_WORDS);
	});
});

describe("ten second action", () => {
	test("is picked from the fixed list for any seed", () => {
		for (const seed of [0, 1, 7, 123456789, -5]) {
			expect(TEN_SECOND_ACTIONS).toContain(pickTenSecondAction(seed));
		}
	});

	test("no action shames", () => {
		for (const a of TEN_SECOND_ACTIONS) {
			expect(a).not.toMatch(SHAME_WORDS);
		}
	});
});
