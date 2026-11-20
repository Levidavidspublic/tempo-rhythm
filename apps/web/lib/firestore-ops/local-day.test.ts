import { expect, test } from "bun:test";
import { localDayWindow, shiftLocalDate } from "./local-day";

test("returns the UTC day window", () => {
  expect(localDayWindow(Date.UTC(2026, 10, 20, 12), "UTC")).toEqual({
    ok: true,
    localDate: "2026-11-20",
    dayStartMs: Date.UTC(2026, 10, 20),
    dayEndMs: Date.UTC(2026, 10, 21),
    timeZone: "UTC",
  });
});

test("returns an Asia/Jerusalem winter day window", () => {
  expect(localDayWindow(Date.UTC(2026, 0, 15, 12), "Asia/Jerusalem")).toEqual({
    ok: true,
    localDate: "2026-01-15",
    dayStartMs: Date.UTC(2026, 0, 14, 22),
    dayEndMs: Date.UTC(2026, 0, 15, 22),
    timeZone: "Asia/Jerusalem",
  });
});

test("makes a New York spring-forward day 23 hours", () => {
  const result = localDayWindow(Date.UTC(2026, 2, 8, 16), "America/New_York");
  expect(result.ok && result.dayEndMs - result.dayStartMs).toBe(23 * 60 * 60 * 1_000);
});

test("makes a New York fall-back day 25 hours", () => {
  const result = localDayWindow(Date.UTC(2026, 10, 1, 16), "America/New_York");
  expect(result.ok && result.dayEndMs - result.dayStartMs).toBe(25 * 60 * 60 * 1_000);
});

test("keeps an instant just before local midnight on the earlier date", () => {
  const result = localDayWindow(Date.UTC(2026, 10, 20, 4, 59, 59, 999), "Asia/Jerusalem");
  expect(result.ok && result.localDate).toBe("2026-11-20");
});

test("falls back to UTC for an unknown time zone", () => {
  expect(localDayWindow(Date.UTC(2026, 10, 20, 12), "Not/A_Zone")).toEqual({
    ok: true,
    localDate: "2026-11-20",
    dayStartMs: Date.UTC(2026, 10, 20),
    dayEndMs: Date.UTC(2026, 10, 21),
    timeZone: "UTC",
  });
});

test("refuses a non-finite time", () => {
  expect(localDayWindow(Number.NaN, "UTC")).toEqual({ ok: false, reason: "bad-time" });
});

test("shifts across a month end and rejects a malformed or impossible date", () => {
  expect(shiftLocalDate("2026-01-31", 1)).toBe("2026-02-01");
  expect(shiftLocalDate("2026-2-01", 1)).toBeNull();
  expect(shiftLocalDate("2026-02-30", 1)).toBeNull();
});
