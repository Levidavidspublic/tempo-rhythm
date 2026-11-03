import { describe, expect, test } from "bun:test";
import { computeHabitCheckInStreaks, isLocalDate } from "./habitCheckInStreak";

describe("computeHabitCheckInStreaks", () => {
	test("no check-ins gives zeros", () => {
		expect(computeHabitCheckInStreaks([], "2026-10-05")).toEqual({
			currentStreak: 0,
			longestStreak: 0,
			lastLocalDate: undefined,
		});
	});

	test("consecutive days ending today", () => {
		const r = computeHabitCheckInStreaks(["2026-10-03", "2026-10-04", "2026-10-05"], "2026-10-05");
		expect(r.currentStreak).toBe(3);
		expect(r.longestStreak).toBe(3);
		expect(r.lastLocalDate).toBe("2026-10-05");
	});

	test("run ending yesterday still counts", () => {
		const r = computeHabitCheckInStreaks(["2026-10-03", "2026-10-04"], "2026-10-05");
		expect(r.currentStreak).toBe(2);
	});

	test("a gap restarts the run at 0 but keeps the longest", () => {
		const r = computeHabitCheckInStreaks(
			["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-06"],
			"2026-10-09",
		);
		expect(r.currentStreak).toBe(0);
		expect(r.longestStreak).toBe(3);
	});

	test("a gap in the middle splits runs", () => {
		const r = computeHabitCheckInStreaks(
			["2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05"],
			"2026-10-05",
		);
		expect(r.currentStreak).toBe(2);
		expect(r.longestStreak).toBe(2);
	});

	test("undo: removing today's check-in drops the streak by one", () => {
		const before = computeHabitCheckInStreaks(["2026-10-04", "2026-10-05"], "2026-10-05");
		const after = computeHabitCheckInStreaks(["2026-10-04"], "2026-10-05");
		expect(before.currentStreak).toBe(2);
		expect(after.currentStreak).toBe(1);
	});

	test("same-day duplicates count once", () => {
		const r = computeHabitCheckInStreaks(["2026-10-05", "2026-10-05"], "2026-10-05");
		expect(r.currentStreak).toBe(1);
		expect(r.longestStreak).toBe(1);
	});

	test("works across month and year boundaries and input order", () => {
		const r = computeHabitCheckInStreaks(["2027-01-01", "2026-12-31", "2026-12-30"], "2027-01-01");
		expect(r.currentStreak).toBe(3);
	});

	test("never negative", () => {
		const r = computeHabitCheckInStreaks(["2020-01-01"], "2026-10-05");
		expect(r.currentStreak).toBe(0);
		expect(r.longestStreak).toBe(1);
	});
});

describe("isLocalDate", () => {
	test("accepts real dates and rejects bad ones", () => {
		expect(isLocalDate("2026-10-05")).toBe(true);
		expect(isLocalDate("2026-02-30")).toBe(false);
		expect(isLocalDate("2026-1-5")).toBe(false);
		expect(isLocalDate("tomorrow")).toBe(false);
	});
});
