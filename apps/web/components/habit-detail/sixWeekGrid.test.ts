import { describe, expect, test } from "bun:test";
import { buildSixWeekGrid, type SixWeekCell } from "./sixWeekGrid";

function weekday(localDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    throw new Error(`bad local date ${localDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).getDay();
}

function flat(today: Date, checked: Set<string> = new Set()): SixWeekCell[] {
  return buildSixWeekGrid(today, checked).flat();
}

describe("buildSixWeekGrid", () => {
  test("returns 6 weeks of 7 days (42 cells)", () => {
    const grid = buildSixWeekGrid(new Date(2026, 9, 7, 15, 0, 0), new Set());
    expect(grid).toHaveLength(6);
    for (const row of grid) {
      expect(row).toHaveLength(7);
    }
    expect(grid.flat()).toHaveLength(42);
  });

  test("each week starts on Monday and the last week contains today", () => {
    const wednesday = new Date(2026, 9, 7, 18, 30, 0);
    const grid = buildSixWeekGrid(wednesday, new Set());
    for (const row of grid) {
      expect(weekday(row[0].localDate)).toBe(1);
    }
    expect(grid[5][0].localDate).toBe("2026-10-05");
    expect(grid[5][2].localDate).toBe("2026-10-07");
    expect(grid[5][2].isToday).toBe(true);
    expect(grid[5][6].localDate).toBe("2026-10-11");

    const sunday = buildSixWeekGrid(new Date(2026, 9, 11, 9, 0, 0), new Set());
    expect(sunday[5][0].localDate).toBe("2026-10-05");
    expect(sunday[5][6].isToday).toBe(true);

    const monday = buildSixWeekGrid(new Date(2026, 9, 5, 8, 0, 0), new Set());
    expect(monday[5][0].localDate).toBe("2026-10-05");
    expect(monday[5][0].isToday).toBe(true);
  });

  test("marks only days after today as future", () => {
    const cells = flat(new Date(2026, 9, 7, 12, 0, 0));
    const today = cells.find((cell) => cell.isToday);
    expect(today?.localDate).toBe("2026-10-07");
    expect(today?.isFuture).toBe(false);
    expect(cells.filter((cell) => cell.isToday)).toHaveLength(1);

    for (const cell of cells) {
      if (cell.localDate > "2026-10-07") {
        expect(cell.isFuture).toBe(true);
        expect(cell.isToday).toBe(false);
      } else {
        expect(cell.isFuture).toBe(false);
      }
    }
  });

  test("applies checked dates and leaves the rest unchecked", () => {
    const checked = new Set(["2026-09-01", "2026-10-07", "2026-12-25"]);
    const cells = flat(new Date(2026, 9, 7, 12, 0, 0), checked);
    const byDate = new Map(cells.map((cell) => [cell.localDate, cell]));

    expect(byDate.get("2026-09-01")?.checked).toBe(true);
    expect(byDate.get("2026-10-07")?.checked).toBe(true);
    expect(byDate.get("2026-08-31")?.checked).toBe(false);
    expect(byDate.get("2026-10-06")?.checked).toBe(false);
    expect(byDate.has("2026-12-25")).toBe(false);
  });

  test("crosses a month boundary as local calendar dates", () => {
    const grid = buildSixWeekGrid(new Date(2026, 9, 7, 12, 0, 0), new Set());
    expect(grid[0][0].localDate).toBe("2026-08-31");
    expect(grid[0][1].localDate).toBe("2026-09-01");
    expect(weekday(grid[0][0].localDate)).toBe(1);
    expect(weekday(grid[0][1].localDate)).toBe(2);
  });
});
