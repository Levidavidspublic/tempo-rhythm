/**
 * Kitchen T8 (S4): the week grid opens at 07:00, so it scrolls itself to the week's first item
 * (a 17:00 session used to sit below the fold). scrollMinuteFor picks the hour; the grid renders
 * with its own scroll region and sticky day names either way.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { scrollMinuteFor, WeekGrid, type WeekItem } from "../../../apps/web/components/calendar/WeekGrid";

const WEEK = "2026-10-19"; // Monday
const item = (id: string, date: string, start: string, over: Partial<WeekItem> = {}): WeekItem => {
  const [h, m] = start.split(":").map(Number);
  return { id, date, startMinute: h! * 60 + m!, durationMinutes: 45, kind: "flexible", title: id, ...over };
};
const hour = (h: number) => h * 60;

describe("scrollMinuteFor", () => {
  test("the hour of the week's earliest item, on any day of the week", () => {
    const items = [item("a", "2026-10-23", "17:30"), item("b", "2026-10-20", "18:00"), item("c", "2026-10-25", "16:15")];
    expect(scrollMinuteFor(items, WEEK, "2026-10-21", hour(9))).toBe(hour(16));
  });

  test("items of other weeks don't count", () => {
    const items = [item("before", "2026-10-18", "08:00"), item("after", "2026-10-26", "08:00"), item("in", "2026-10-22", "17:00")];
    expect(scrollMinuteFor(items, WEEK, "2026-10-21", null)).toBe(hour(17));
  });

  test("no items: the current hour on this week, the top on any other week", () => {
    expect(scrollMinuteFor([], WEEK, "2026-10-21", hour(14) + 40)).toBe(hour(14));
    expect(scrollMinuteFor([], WEEK, "2026-11-02", hour(14))).toBe(hour(7));
    expect(scrollMinuteFor([], WEEK, "2026-10-21", null)).toBe(hour(7));
  });

  test("an item is always found before now is used", () => {
    expect(scrollMinuteFor([item("a", "2026-10-24", "19:00")], WEEK, "2026-10-21", hour(10))).toBe(hour(19));
  });

  test("kept inside the visible day: early items mean the top, late ones the last hour", () => {
    expect(scrollMinuteFor([item("gym", "2026-10-20", "06:00")], WEEK, "2026-10-21", null)).toBe(hour(7));
    expect(scrollMinuteFor([item("call", "2026-10-20", "23:00")], WEEK, "2026-10-21", null)).toBe(hour(21));
    expect(scrollMinuteFor([], WEEK, "2026-10-21", hour(23) + 30)).toBe(hour(21));
    expect(
      scrollMinuteFor([item("x", "2026-10-20", "17:45")], WEEK, "2026-10-21", null, { dayStartHour: 6, dayEndHour: 24 })
    ).toBe(hour(17));
  });

  test("a Sunday-first week (Hebrew) counts its own seven days", () => {
    const items = [item("sun", "2026-10-18", "17:00"), item("sat", "2026-10-24", "15:00")];
    expect(scrollMinuteFor(items, "2026-10-18", "2026-10-21", null)).toBe(hour(15));
    expect(scrollMinuteFor(items, WEEK, "2026-10-21", null)).toBe(hour(15));
    expect(scrollMinuteFor([items[0]!], WEEK, "2026-10-21", null)).toBe(hour(7));
  });
});

describe("WeekGrid scroll region", () => {
  test("still one labelled region that scrolls inside itself; the day names are in each column", () => {
    const html = renderToStaticMarkup(
      createElement(WeekGrid, {
        weekStart: WEEK,
        items: [item("a", "2026-10-20", "17:00")],
        today: "2026-10-20",
        lang: "en",
      })
    );
    expect(html.split('class="tp-sched__scroll"')).toHaveLength(2);
    expect(html.split('class="tp-week__head"')).toHaveLength(8);
    expect(html).toContain('class="tp-sched__corner"');
  });
});
