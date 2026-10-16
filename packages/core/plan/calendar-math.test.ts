import { describe, expect, test } from "bun:test";
import {
  addDays,
  compareLocalDates,
  dateRange,
  daysBetween,
  daysInMonth,
  formatLocalDate,
  fromDayNumber,
  isLocalDate,
  monthMatrix,
  parseLocalDate,
  startOfWeek,
  toDayNumber,
  weekDates,
  weekday,
} from "./calendar-math";

describe("calendar math", () => {
  test("validates and parses YYYY-MM-DD", () => {
    expect(isLocalDate("2026-10-16")).toBe(true);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2100-02-29")).toBe(false);
    expect(isLocalDate("2000-02-29")).toBe(true);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("2026-1-01")).toBe(false);
    expect(isLocalDate(20261016)).toBe(false);
    expect(parseLocalDate("2026-10-16")).toEqual({ year: 2026, month: 10, day: 16 });
    expect(() => parseLocalDate("16/10/2026")).toThrow(RangeError);
    expect(formatLocalDate(2026, 1, 5)).toBe("2026-01-05");
    expect(() => formatLocalDate(2026, 4, 31)).toThrow(RangeError);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  test("day numbers round-trip and start at 1970-01-01", () => {
    expect(toDayNumber("1970-01-01")).toBe(0);
    expect(toDayNumber("1969-12-31")).toBe(-1);
    expect(toDayNumber("2000-03-01")).toBe(11017);
    for (let n = -800; n < 30000; n += 37) expect(toDayNumber(fromDayNumber(n))).toBe(n);
  });

  test("addDays crosses month, year and leap-day ends without DST drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    // Spring-forward and fall-back weekends (Israel and the US) are just days.
    expect(addDays("2026-03-27", 1)).toBe("2026-03-28");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(addDays("2026-10-16", 365)).toBe("2027-10-16");
    expect(() => addDays("2026-10-16", 1.5)).toThrow(RangeError);
  });

  test("daysBetween and compare", () => {
    expect(daysBetween("2026-10-16", "2026-11-06")).toBe(21);
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(daysBetween("2027-01-02", "2026-12-30")).toBe(-3);
    expect(daysBetween("2028-02-01", "2028-03-01")).toBe(29);
    expect(compareLocalDates("2026-10-16", "2026-10-17")).toBe(-1);
    expect(compareLocalDates("2026-10-16", "2026-10-16")).toBe(0);
    expect(dateRange("2026-12-30", "2027-01-02")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(dateRange("2026-10-02", "2026-10-01")).toEqual([]);
  });

  test("weekday follows Date#getDay (0 = Sunday)", () => {
    expect(weekday("1970-01-01")).toBe(4);
    expect(weekday("2026-10-16")).toBe(5);
    expect(weekday("2026-10-18")).toBe(0);
    expect(weekday("1969-12-28")).toBe(0);
    expect(weekday("2000-01-01")).toBe(6);
  });

  test("startOfWeek is Monday-first by default and Sunday-first for Hebrew weeks", () => {
    expect(startOfWeek("2026-10-16")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
    expect(startOfWeek("2026-10-16", { weekStartsOn: 0 })).toBe("2026-10-11");
    expect(startOfWeek("2026-10-18", { weekStartsOn: 0 })).toBe("2026-10-18");
    expect(startOfWeek("2027-01-01", { weekStartsOn: 0 })).toBe("2026-12-27");
    expect(startOfWeek("2026-10-16", { weekStartsOn: 6 })).toBe("2026-10-10");
    expect(() => startOfWeek("2026-10-16", { weekStartsOn: 7 as 0 })).toThrow(RangeError);
    expect(weekDates("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });

  test("monthMatrix is always 6 × 7 with inMonth flags", () => {
    const october = monthMatrix(2026, 10);
    expect(october).toHaveLength(6);
    for (const row of october) expect(row).toHaveLength(7);
    expect(october[0]![0]).toEqual({ date: "2026-09-28", day: 28, inMonth: false, weekday: 1 });
    expect(october[0]![3]).toEqual({ date: "2026-10-01", day: 1, inMonth: true, weekday: 4 });
    expect(october.flat().filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(october[5]![6]!.date).toBe("2026-11-08");
    expect(october.flat().every((cell) => cell.weekday === weekday(cell.date))).toBe(true);
  });

  test("monthMatrix Sunday-first, February and year ends", () => {
    const sunday = monthMatrix(2026, 11, { weekStartsOn: 0 });
    expect(sunday[0]![0]).toMatchObject({ date: "2026-11-01", inMonth: true, weekday: 0 });
    expect(sunday[0]!.every((cell) => cell.inMonth)).toBe(true);

    const february = monthMatrix(2028, 2);
    expect(february.flat().filter((cell) => cell.inMonth)).toHaveLength(29);

    const december = monthMatrix(2026, 12, { weekStartsOn: 0 });
    const trailing = december.flat().filter((cell) => !cell.inMonth && cell.day < 15);
    expect(trailing[0]!.date).toBe("2027-01-01");
    const january = monthMatrix(2027, 1);
    expect(january[0]![0]!.date).toBe("2026-12-28");
  });
});
