import { describe, expect, test } from "bun:test";
import {
  lastLocalDaysRange,
  lastSevenDaysSeries,
  localDayKey,
  MAX_BLOCK_MINUTES,
  parseBlockMinutes,
  totalsPerLocalDay,
} from "./focusBlockStats";

const min = 60_000;

describe("focusBlockStats", () => {
  test("empty input gives no totals and a zero-filled 7-day series", () => {
    expect(totalsPerLocalDay([])).toEqual([]);
    const series = lastSevenDaysSeries([], new Date(2026, 9, 5, 12).getTime());
    expect(series).toHaveLength(7);
    expect(series.every((p) => p.blocks === 0 && p.minutes === 0)).toBe(true);
    expect(series[6]?.day).toBe("2026-10-05");
    expect(series[0]?.day).toBe("2026-09-29");
  });

  test("buckets blocks across local midnight", () => {
    const late = new Date(2026, 9, 4, 23, 59).getTime();
    const early = new Date(2026, 9, 5, 0, 1).getTime();
    const totals = totalsPerLocalDay([
      { startedAtMs: late, durationMs: 25 * min },
      { startedAtMs: early, durationMs: 10 * min },
      { startedAtMs: early + 5 * min, durationMs: 5 * min },
    ]);
    expect(totals).toEqual([
      { day: "2026-10-04", blocks: 1, minutes: 25 },
      { day: "2026-10-05", blocks: 2, minutes: 15 },
    ]);
  });

  test("block minutes: 1 to 8 hours, anything else is refused before it reaches the server", () => {
    expect(MAX_BLOCK_MINUTES).toBe(480);
    expect(parseBlockMinutes("25")).toBe(25);
    expect(parseBlockMinutes("1")).toBe(1);
    expect(parseBlockMinutes("480")).toBe(480);
    expect(parseBlockMinutes("481")).toBeNull();
    expect(parseBlockMinutes("600")).toBeNull();
    expect(parseBlockMinutes("0")).toBeNull();
    expect(parseBlockMinutes("-5")).toBeNull();
    expect(parseBlockMinutes("")).toBeNull();
    expect(parseBlockMinutes("abc")).toBeNull();
  });

  test("range spans seven local days ending at tomorrow's local midnight", () => {
    const now = new Date(2026, 9, 5, 12).getTime();
    const { startMs, endMs } = lastLocalDaysRange(now);
    expect(localDayKey(startMs)).toBe("2026-09-29");
    expect(endMs).toBe(new Date(2026, 9, 6).getTime());
  });
});
