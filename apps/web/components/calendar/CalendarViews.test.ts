import { describe, expect, test } from "bun:test";
import {
  type CalendarViewMode,
  fromDateInputValue,
  getCalendarRangeMs,
  getEventsInRange,
} from "@/lib/calendar/date-math";

const modes: CalendarViewMode[] = ["day", "week", "month"];
const zones = ["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"];
const maxRangeMs = 32 * 24 * 60 * 60 * 1000;

describe("calendar visibility", () => {
  test("created event is visible in day, week and month ranges", () => {
    const original = process.env.TZ;
    try {
      for (const tz of zones) {
        process.env.TZ = tz;
        for (const dateValue of ["2026-10-05", "2026-10-01", "2026-10-31", "2026-03-29"]) {
          // Same shape the form submits: local midnight of the chosen date.
          const selected = fromDateInputValue(dateValue);
          const created = { id: "e1", title: "Planning call", startsAtMs: selected.getTime() };
          for (const mode of modes) {
            const range = getCalendarRangeMs(mode, selected);
            expect(getEventsInRange([created], range)).toHaveLength(1);
            // listInRange rejects ranges over 32 days.
            expect(range.endMs - range.startMs).toBeLessThanOrEqual(maxRangeMs);
          }
        }
      }
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });

  test("last millisecond of the day stays in the day range, next midnight does not", () => {
    const range = getCalendarRangeMs("day", fromDateInputValue("2026-10-05"));
    const last = { id: "a", title: "a", startsAtMs: range.endMs - 1 };
    const next = { id: "b", title: "b", startsAtMs: range.endMs };
    expect(getEventsInRange([last, next], range)).toEqual([last]);
  });
});
