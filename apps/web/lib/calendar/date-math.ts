export type CalendarViewMode = "day" | "week" | "month";

export type CalendarRange = {
  startMs: number;
  endMs: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  startsAtMs: number;
};

export function getLocalDayStartMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getLocalWeekStartMondayMs(date: Date): number {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff).getTime();
}

function getLocalMonthStartMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

export function getCalendarRangeMs(mode: CalendarViewMode, date: Date): CalendarRange {
  if (mode === "day") {
    const startMs = getLocalDayStartMs(date);
    return {
      startMs,
      endMs: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime(),
    };
  }

  if (mode === "week") {
    const startMs = getLocalWeekStartMondayMs(date);
    const start = new Date(startMs);
    return {
      startMs,
      endMs: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7).getTime(),
    };
  }

  return {
    startMs: getLocalMonthStartMs(date),
    endMs: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
  };
}

/**
 * The window a 6 × 7 month grid draws: from its first cell (the start of the week holding the
 * 1st) to the day after its last cell, half-open. `getCalendarRangeMs("month", …)` stays the
 * 1st-to-1st month; query with this one so the leading and trailing days show their items too.
 * `weekStartsOn`: 0 = Sunday … 6 = Saturday.
 */
export function getMonthGridRangeMs(date: Date, weekStartsOn: number): CalendarRange {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lead = (new Date(year, month, 1).getDay() - weekStartsOn + 7) % 7;
  return {
    startMs: new Date(year, month, 1 - lead).getTime(),
    endMs: new Date(year, month, 1 - lead + 42).getTime(),
  };
}

export function getEventsInRange<T extends CalendarEvent>(
  events: readonly T[],
  range: CalendarRange,
): T[] {
  return events
    .filter((event) => event.startsAtMs >= range.startMs && event.startsAtMs < range.endMs)
    .toSorted((a, b) => a.startsAtMs - b.startsAtMs || a.title.localeCompare(b.title));
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateInputValue(value: string): Date {
  const parsed = parseDateInputValue(value);
  if (!parsed) {
    throw new Error("Choose a calendar date.");
  }

  return parsed;
}

export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}
