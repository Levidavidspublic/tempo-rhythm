import { describe, expect, test } from "bun:test";
import { monthMatrix } from "./calendar-math";
import {
  conflicts,
  gridRange,
  layoutWeek,
  monthCounts,
  moveItem,
  type ScheduleItem,
} from "./schedule";

function item(
  id: string,
  date: string,
  start: string,
  durationMinutes: number,
  kind: ScheduleItem["kind"] = "flexible"
): ScheduleItem {
  const [h, m] = start.split(":").map(Number);
  return { id, date, startMinute: h! * 60 + m!, durationMinutes, kind };
}

describe("layoutWeek", () => {
  test("7 day columns, positions in slots", () => {
    const layout = layoutWeek([item("a", "2026-10-13", "09:00", 60)], "2026-10-12");
    expect(layout.days.map((d) => d.date)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(layout.slots).toBe(30);
    expect(layout.days[1]!.items).toEqual([
      {
        item: item("a", "2026-10-13", "09:00", 60),
        top: 4,
        height: 2,
        lane: 0,
        lanes: 1,
        clippedStart: false,
        clippedEnd: false,
      },
    ]);
  });

  test("Sunday-first week across a year end", () => {
    const layout = layoutWeek([item("x", "2027-01-01", "10:00", 30)], "2026-12-27");
    expect(layout.days[5]!.date).toBe("2027-01-01");
    expect(layout.days[5]!.items[0]!.top).toBe(6);
  });

  test("overlap lanes: overlapping items sit side by side, separate groups reset", () => {
    const items = [
      item("a", "2026-10-12", "09:00", 60, "fixed"),
      item("b", "2026-10-12", "09:30", 60),
      item("c", "2026-10-12", "10:00", 30),
      item("d", "2026-10-12", "13:00", 30),
    ];
    const day = layoutWeek(items, "2026-10-12").days[0]!;
    const byId = Object.fromEntries(day.items.map((p) => [p.item.id, p]));
    expect([byId.a!.lane, byId.b!.lane, byId.c!.lane]).toEqual([0, 1, 0]);
    expect([byId.a!.lanes, byId.b!.lanes, byId.c!.lanes]).toEqual([2, 2, 2]);
    expect([byId.d!.lane, byId.d!.lanes]).toEqual([0, 1]);
  });

  test("clips to the visible hours and counts hidden items", () => {
    const items = [
      item("early", "2026-10-12", "05:00", 60),
      item("spans", "2026-10-12", "06:30", 60),
      item("late", "2026-10-12", "22:30", 30),
      item("edge", "2026-10-12", "21:45", 60),
      item("tiny", "2026-10-12", "12:00", 5),
      item("other-week", "2026-10-19", "09:00", 60),
    ];
    const layout = layoutWeek(items, "2026-10-12", {
      dayStartHour: 7,
      dayEndHour: 22,
      slotMinutes: 15,
    });
    const day = layout.days[0]!;
    expect(day.hiddenBefore).toBe(1);
    expect(day.hiddenAfter).toBe(1);
    const byId = Object.fromEntries(day.items.map((p) => [p.item.id, p]));
    expect(byId.spans).toMatchObject({ top: 0, height: 2, clippedStart: true, clippedEnd: false });
    expect(byId.edge).toMatchObject({ top: 59, height: 1, clippedEnd: true });
    expect(byId.tiny).toMatchObject({ top: 20, height: 1 });
    expect(layout.days.flatMap((d) => d.items).some((p) => p.item.id === "other-week")).toBe(false);
  });

  test("rejects a bad range", () => {
    expect(() => gridRange({ dayStartHour: 10, dayEndHour: 9 })).toThrow(RangeError);
    expect(() => gridRange({ slotMinutes: 0 })).toThrow(RangeError);
    expect(gridRange()).toEqual({ dayStartMinute: 420, dayEndMinute: 1320, slotMinutes: 30 });
  });
});

describe("conflicts", () => {
  test("names overlapping pairs, fixed first, touching ends don't count", () => {
    const items = [
      item("study", "2026-10-12", "09:30", 60),
      item("class", "2026-10-12", "09:00", 60, "fixed"),
      item("next", "2026-10-12", "10:30", 30),
      item("meet", "2026-10-12", "10:15", 30, "fixed"),
    ];
    const found = conflicts(items);
    expect(found.map((c) => [c.a.id, c.b.id, c.kind, c.overlapMinutes])).toEqual([
      ["class", "study", "fixed-flexible", 30],
      ["meet", "study", "fixed-flexible", 15],
      ["meet", "next", "fixed-flexible", 15],
    ]);
    expect(found[0]!.date).toBe("2026-10-12");
  });

  test("flexible-flexible, fixed-fixed and across midnight", () => {
    const items = [
      item("a", "2026-12-31", "23:30", 60),
      item("b", "2027-01-01", "00:00", 30, "fixed"),
      item("c", "2027-01-01", "00:00", 30, "fixed"),
      item("d", "2027-01-02", "08:00", 30),
      item("e", "2027-01-02", "08:10", 10),
      item("zero", "2027-01-02", "08:15", 0),
    ];
    expect(conflicts(items).map((c) => [c.a.id, c.b.id, c.kind, c.date, c.overlapMinutes])).toEqual(
      [
        ["b", "a", "fixed-flexible", "2027-01-01", 30],
        ["b", "c", "fixed-fixed", "2027-01-01", 30],
        ["c", "a", "fixed-flexible", "2027-01-01", 30],
        ["d", "e", "flexible-flexible", "2027-01-02", 10],
      ]
    );
  });
});

describe("moveItem", () => {
  const study = item("s", "2026-10-31", "09:00", 60);

  test("moves by days across month ends, keeping the time", () => {
    expect(moveItem(study, { days: 1 })).toEqual({ ...study, date: "2026-11-01" });
    expect(moveItem(study, { days: -31 })).toEqual({ ...study, date: "2026-09-30" });
    expect(study.date).toBe("2026-10-31");
  });

  test("moves by minutes, clamped to the visible day", () => {
    expect(moveItem(study, { minutes: 30 }).startMinute).toBe(570);
    expect(moveItem(study, { minutes: -30 }).startMinute).toBe(510);
    expect(moveItem(study, { minutes: -600 }).startMinute).toBe(420);
    expect(moveItem(study, { minutes: 900 }).startMinute).toBe(1320 - 60);
    const custom = moveItem(study, { days: 1, minutes: 900 }, { dayStartHour: 8, dayEndHour: 20 });
    expect(custom).toMatchObject({ date: "2026-11-01", startMinute: 1140 });
    expect(() => moveItem(study, { days: 0.5 })).toThrow(RangeError);
  });

  test("a minute move never goes the other way: outside the visible day it stays put", () => {
    const early = item("e", "2026-10-20", "06:30", 45);
    expect(moveItem(early, { minutes: -30 }).startMinute).toBe(390);
    // Moving later from before the visible day still brings it into view.
    expect(moveItem(early, { minutes: 30 }).startMinute).toBe(420);
    const late = item("l", "2026-10-20", "21:00", 120);
    expect(moveItem(late, { minutes: 30 }).startMinute).toBe(1260);
    expect(moveItem(late, { minutes: -30 }).startMinute).toBe(1200);
    // A partial move in the asked direction still clamps to the edge.
    expect(moveItem(item("p", "2026-10-20", "07:10", 30), { minutes: -30 }).startMinute).toBe(420);
  });

  test("keeps extra fields", () => {
    const withTitle = { ...study, title: "Review: תאים", taskId: "t1" };
    expect(moveItem(withTitle, { days: 1 })).toMatchObject({ title: "Review: תאים", taskId: "t1" });
  });
});

describe("monthCounts", () => {
  test("counts per cell, same 6 × 7 shape", () => {
    const matrix = monthMatrix(2026, 10, { weekStartsOn: 0 });
    const items = [
      item("a", "2026-10-16", "09:00", 30, "fixed"),
      item("b", "2026-10-16", "11:00", 30),
      item("c", "2026-10-16", "13:00", 30),
      item("d", "2026-11-01", "09:00", 30),
      item("far", "2027-03-01", "09:00", 30),
    ];
    const counts = monthCounts(items, matrix);
    expect(counts).toHaveLength(6);
    const cells = counts.flat();
    expect(cells.find((c) => c.date === "2026-10-16")).toMatchObject({
      count: 3,
      fixed: 1,
      flexible: 2,
      inMonth: true,
    });
    expect(cells.find((c) => c.date === "2026-11-01")).toMatchObject({ count: 1, inMonth: false });
    expect(cells.reduce((sum, c) => sum + c.count, 0)).toBe(4);
  });
});
