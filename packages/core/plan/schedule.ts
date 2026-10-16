/**
 * Grid helpers for the SessionScheduler (week and month views), kitchen T8 (S4).
 *
 * Pure and clock-free. An item sits on a local date at a local clock minute (0–1439), the way the
 * day timeline places things, so a DST change never shifts it. Callers convert from Unix ms.
 * Fixed items are events that can't move (classes, meetings); flexible items are study sessions.
 */

import { addDays, type LocalDate, type MonthCell, toDayNumber, weekDates } from "./calendar-math";

export const DAY_MINUTES = 1440;

/** Shortest item the grid draws, so a 5-minute item stays readable and tappable. */
export const MIN_VISIBLE_MINUTES = 15;

export type ScheduleItemKind = "fixed" | "flexible";

export type ScheduleItem = {
  id: string;
  date: LocalDate;
  /** Local clock minute the item starts, 0–1439. */
  startMinute: number;
  durationMinutes: number;
  kind: ScheduleItemKind;
  title?: string;
};

export type GridOptions = {
  /** First visible hour, 0–23. Default 7. */
  dayStartHour?: number;
  /** Hour the visible day ends, 1–24, after `dayStartHour`. Default 22. */
  dayEndHour?: number;
  /** Minutes per grid row. Default 30. */
  slotMinutes?: number;
};

export type GridRange = { dayStartMinute: number; dayEndMinute: number; slotMinutes: number };

export function gridRange(options: GridOptions = {}): GridRange {
  const startHour = options.dayStartHour ?? 7;
  const endHour = options.dayEndHour ?? 22;
  const slotMinutes = options.slotMinutes ?? 30;
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new RangeError("dayStartHour must be an integer from 0 to 23");
  }
  if (!Number.isInteger(endHour) || endHour <= startHour || endHour > 24) {
    throw new RangeError("dayEndHour must be an integer after dayStartHour, at most 24");
  }
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) {
    throw new RangeError("slotMinutes must be a positive number");
  }
  return { dayStartMinute: startHour * 60, dayEndMinute: endHour * 60, slotMinutes };
}

export type PlacedItem<T extends ScheduleItem = ScheduleItem> = {
  item: T;
  /** Rows from the top of the visible day (may be fractional). */
  top: number;
  /** Rows tall (may be fractional). */
  height: number;
  /** 0-based lane among the items it overlaps. */
  lane: number;
  /** Lanes in its overlap group; the column is split this many ways. */
  lanes: number;
  /** True when the item starts before the visible day. */
  clippedStart: boolean;
  /** True when the item runs past the visible day. */
  clippedEnd: boolean;
};

export type WeekColumn<T extends ScheduleItem = ScheduleItem> = {
  date: LocalDate;
  items: PlacedItem<T>[];
  /** Items that end before the visible day starts ("1 item earlier"). */
  hiddenBefore: number;
  /** Items that start after the visible day ends ("2 items later"). */
  hiddenAfter: number;
};

export type WeekLayout<T extends ScheduleItem = ScheduleItem> = GridRange & {
  days: WeekColumn<T>[];
  /** Rows in a visible day. */
  slots: number;
};

function compareItems(a: ScheduleItem, b: ScheduleItem): number {
  return (
    toDayNumber(a.date) - toDayNumber(b.date) ||
    a.startMinute - b.startMinute ||
    a.durationMinutes - b.durationMinutes ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Splits overlapping placements into side-by-side lanes (greedy, like the day timeline). */
function assignLanes<T extends ScheduleItem>(
  placed: Array<PlacedItem<T> & { start: number; end: number }>
): void {
  placed.sort((a, b) => a.start - b.start || a.end - b.end || compareItems(a.item, b.item));
  const laneEnds: number[] = [];
  let group: typeof placed = [];
  let groupEnd = -Infinity;
  const closeGroup = () => {
    const lanes = group.reduce((max, p) => Math.max(max, p.lane + 1), 1);
    for (const p of group) p.lanes = lanes;
    group = [];
    laneEnds.length = 0;
  };
  for (const p of placed) {
    if (group.length > 0 && p.start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= p.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.end);
    } else {
      laneEnds[lane] = p.end;
    }
    p.lane = lane;
    group.push(p);
    groupEnd = group.length === 1 ? p.end : Math.max(groupEnd, p.end);
  }
  if (group.length > 0) closeGroup();
}

/**
 * Lays a week out as 7 day columns starting at `weekStart`. Items are clipped to the visible
 * hours; items past midnight are clipped at the end of their own day.
 */
export function layoutWeek<T extends ScheduleItem>(
  items: readonly T[],
  weekStart: LocalDate,
  options: GridOptions = {}
): WeekLayout<T> {
  const range = gridRange(options);
  const { dayStartMinute, dayEndMinute, slotMinutes } = range;
  const days = weekDates(weekStart).map((date) => {
    const column: WeekColumn<T> = { date, items: [], hiddenBefore: 0, hiddenAfter: 0 };
    const placed: Array<PlacedItem<T> & { start: number; end: number }> = [];
    for (const item of items) {
      if (item.date !== date) continue;
      if (!Number.isFinite(item.startMinute) || !Number.isFinite(item.durationMinutes)) continue;
      const rawStart = item.startMinute;
      const rawEnd = Math.min(
        DAY_MINUTES,
        rawStart + Math.max(MIN_VISIBLE_MINUTES, item.durationMinutes)
      );
      if (rawEnd <= dayStartMinute) {
        column.hiddenBefore += 1;
        continue;
      }
      if (rawStart >= dayEndMinute) {
        column.hiddenAfter += 1;
        continue;
      }
      let start = Math.max(dayStartMinute, rawStart);
      let end = Math.min(dayEndMinute, rawEnd);
      if (end - start < MIN_VISIBLE_MINUTES) {
        if (start + MIN_VISIBLE_MINUTES <= dayEndMinute) end = start + MIN_VISIBLE_MINUTES;
        else start = Math.max(dayStartMinute, dayEndMinute - MIN_VISIBLE_MINUTES);
      }
      placed.push({
        item,
        top: (start - dayStartMinute) / slotMinutes,
        height: (end - start) / slotMinutes,
        lane: 0,
        lanes: 1,
        clippedStart: rawStart < dayStartMinute,
        clippedEnd: item.startMinute + item.durationMinutes > dayEndMinute,
        start,
        end,
      });
    }
    assignLanes(placed);
    column.items = placed.map(({ start: _start, end: _end, ...rest }) => rest);
    return column;
  });
  return { ...range, days, slots: (dayEndMinute - dayStartMinute) / slotMinutes };
}

export type ConflictKind = "fixed-flexible" | "flexible-flexible" | "fixed-fixed";

export type Conflict<T extends ScheduleItem = ScheduleItem> = {
  /** The fixed item when only one of the two is fixed; otherwise the earlier one. */
  a: T;
  b: T;
  kind: ConflictKind;
  /** Date the overlap starts on. */
  date: LocalDate;
  overlapMinutes: number;
};

function absoluteStart(item: ScheduleItem): number {
  return toDayNumber(item.date) * DAY_MINUTES + item.startMinute;
}

/**
 * Every pair of items whose times overlap (touching ends don't count), across midnight too.
 * Sorted by when the overlap starts, then by ids.
 */
export function conflicts<T extends ScheduleItem>(items: readonly T[]): Conflict<T>[] {
  const spans = items
    .filter(
      (item) =>
        Number.isFinite(item.startMinute) &&
        Number.isFinite(item.durationMinutes) &&
        item.durationMinutes > 0
    )
    .map((item) => {
      const start = absoluteStart(item);
      return { item, start, end: start + item.durationMinutes };
    })
    .sort((x, y) => x.start - y.start || x.end - y.end || compareItems(x.item, y.item));

  const found: Array<Conflict<T> & { at: number }> = [];
  for (let i = 0; i < spans.length; i += 1) {
    const first = spans[i]!;
    for (let j = i + 1; j < spans.length; j += 1) {
      const second = spans[j]!;
      if (second.start >= first.end) break;
      const overlapStart = second.start;
      const overlapMinutes = Math.min(first.end, second.end) - overlapStart;
      if (overlapMinutes <= 0) continue;
      const fixedCount = Number(first.item.kind === "fixed") + Number(second.item.kind === "fixed");
      const swap = fixedCount === 1 && second.item.kind === "fixed";
      found.push({
        a: swap ? second.item : first.item,
        b: swap ? first.item : second.item,
        kind:
          fixedCount === 2
            ? "fixed-fixed"
            : fixedCount === 1
              ? "fixed-flexible"
              : "flexible-flexible",
        date: addDays("1970-01-01", Math.floor(overlapStart / DAY_MINUTES)),
        overlapMinutes,
        at: overlapStart,
      });
    }
  }
  found.sort(
    (x, y) =>
      x.at - y.at ||
      (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : 0) ||
      (x.b.id < y.b.id ? -1 : x.b.id > y.b.id ? 1 : 0)
  );
  return found.map(({ at: _at, ...conflict }) => conflict);
}

export type MoveBy = { days?: number; minutes?: number };

/**
 * Moves an item by whole days and/or minutes. A minute move is clamped so the item stays inside
 * the visible day (`options`, default 07:00–22:00); it never rolls over to another day, and it
 * never goes the opposite way to the one asked (then the start stays as it was). A
 * day-only move keeps the start time. Returns a new item; the input is not changed.
 */
export function moveItem<T extends ScheduleItem>(
  item: T,
  by: MoveBy,
  options: GridOptions = {}
): T {
  const days = by.days ?? 0;
  const minutes = by.minutes ?? 0;
  if (!Number.isInteger(days)) throw new RangeError("days must be an integer");
  if (!Number.isFinite(minutes)) throw new RangeError("minutes must be a finite number");
  const date = days === 0 ? item.date : addDays(item.date, days);
  let startMinute = item.startMinute;
  if (minutes !== 0) {
    const { dayStartMinute, dayEndMinute } = gridRange(options);
    const latest = Math.max(dayStartMinute, dayEndMinute - Math.max(0, item.durationMinutes));
    const clamped = Math.min(latest, Math.max(dayStartMinute, item.startMinute + minutes));
    // Clamping never moves an item the other way ("earlier" on a 06:30 item would give 07:00).
    const wrongWay = minutes < 0 ? clamped > item.startMinute : clamped < item.startMinute;
    startMinute = wrongWay ? item.startMinute : clamped;
  }
  return { ...item, date, startMinute };
}

export type MonthCountCell = MonthCell & { count: number; fixed: number; flexible: number };

/** Item counts for each cell of a `monthMatrix` grid, same 6 × 7 shape. */
export function monthCounts(
  items: readonly ScheduleItem[],
  matrix: readonly (readonly MonthCell[])[]
): MonthCountCell[][] {
  const tally = new Map<LocalDate, { fixed: number; flexible: number }>();
  for (const item of items) {
    const entry = tally.get(item.date) ?? { fixed: 0, flexible: 0 };
    if (item.kind === "fixed") entry.fixed += 1;
    else entry.flexible += 1;
    tally.set(item.date, entry);
  }
  return matrix.map((row) =>
    row.map((cell) => {
      const entry = tally.get(cell.date) ?? { fixed: 0, flexible: 0 };
      return { ...cell, count: entry.fixed + entry.flexible, ...entry };
    })
  );
}
