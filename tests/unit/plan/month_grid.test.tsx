/**
 * Kitchen T8 (S4): MonthGrid. Static renders (no DOM in this repo's tests) plus the pure key
 * handling the grid uses. Lives in tests/unit because `bun run test` does not include
 * apps/web/components.
 */
import { describe, expect, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import {
  MonthGrid,
  type MonthGridProps,
  monthKeyTarget,
  sameDayIn,
  shiftMonth,
} from "../../../apps/web/components/calendar/MonthGrid";

const items = [
  { id: "a", date: "2026-10-20", startMinute: 540, durationMinutes: 60, kind: "fixed" as const },
  { id: "b", date: "2026-10-20", startMinute: 600, durationMinutes: 45, kind: "flexible" as const },
  { id: "c", date: "2026-10-20", startMinute: 700, durationMinutes: 30, kind: "flexible" as const },
  { id: "d", date: "2026-10-22", startMinute: 700, durationMinutes: 30, kind: "flexible" as const },
];

function render(props: Partial<MonthGridProps> = {}): string {
  return renderToStaticMarkup(
    createElement(MonthGrid, {
      year: 2026,
      month: 10,
      items,
      today: "2026-10-16",
      selected: "2026-10-20",
      lang: "en",
      onSelectDay: () => {},
      onMonthChange: () => {},
      ...props,
    })
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("MonthGrid", () => {
  test("6 weeks of day buttons with dots and an item count in words", () => {
    const html = render();
    expect(html).toContain('data-component="MonthGrid"');
    expect(count(html, 'class="tp-month__day"')).toBe(42);
    expect(html).toContain("October 2026");
    expect(html).toMatch(/data-date="2026-10-20"[^>]*>.*?<span class="tp-num">3<\/span> items/);
    expect(html).toMatch(/data-date="2026-10-22"[^>]*>.*?<span class="tp-num">1<\/span> item</);
    expect(count(html, "tp-dot tp-dot--fixed")).toBe(1);
    expect(count(html, "tp-dot tp-dot--flex")).toBe(3);
    // Days outside the month are marked, the count is also in the label.
    expect(html).toContain('data-date="2026-09-28" data-outside="true"');
    expect(html).toContain('aria-label="Tuesday 20 October, 3 items"');
  });

  test("today is aria-current, the chosen day aria-pressed, one tab stop", () => {
    const html = render();
    expect(count(html, 'aria-current="date"')).toBe(1);
    expect(html).toMatch(/data-date="2026-10-16"[^>]*aria-current="date"/);
    expect(count(html, 'aria-pressed="true"')).toBe(1);
    expect(html).toMatch(/data-date="2026-10-20"[^>]*aria-pressed="true"[^>]*tabindex="0"/);
    expect(count(html, 'tabindex="0"')).toBe(1);
    expect(count(html, 'aria-pressed="false"')).toBe(41);
  });

  test("without a chosen day the tab stop is today; read-only grids have no aria-pressed", () => {
    const html = render({ selected: null, onSelectDay: undefined });
    expect(html).not.toContain("aria-pressed");
    expect(html).toMatch(/data-date="2026-10-16"[^>]*tabindex="0"/);
  });

  test("previous and next month buttons are labelled", () => {
    const html = render();
    expect(html).toContain('aria-label="Previous month"');
    expect(html).toContain('aria-label="Next month"');
  });

  test("English weeks start on Monday, Hebrew weeks on Sunday", () => {
    const en = render();
    expect(en.indexOf('data-weekday="1"')).toBeLessThan(en.indexOf('data-weekday="0"'));
    expect(en).toMatch(/class="tp-month__day"[^>]*data-date="2026-09-28"/); // Monday
    const he = render({ lang: "he" });
    expect(he.indexOf('data-weekday="0"')).toBeLessThan(he.indexOf('data-weekday="1"'));
    expect(he).toMatch(/^.*?class="tp-month__day"[^>]*data-date="2026-09-27"/s); // Sunday
    expect(he).toContain("אוקטובר");
    expect(he).toContain('aria-label="החודש הבא"');
    expect(he).toContain("3</span> פריטים");
  });
});

describe("MonthGrid keys", () => {
  test("arrows move a day or a week; left and right swap in Hebrew", () => {
    expect(monthKeyTarget("2026-10-20", "ArrowRight", false, 1)).toBe("2026-10-21");
    expect(monthKeyTarget("2026-10-20", "ArrowLeft", false, 1)).toBe("2026-10-19");
    expect(monthKeyTarget("2026-10-20", "ArrowRight", true, 0)).toBe("2026-10-19");
    expect(monthKeyTarget("2026-10-20", "ArrowLeft", true, 0)).toBe("2026-10-21");
    expect(monthKeyTarget("2026-10-20", "ArrowDown", false, 1)).toBe("2026-10-27");
    expect(monthKeyTarget("2026-10-02", "ArrowUp", false, 1)).toBe("2026-09-25");
  });

  test("Home and End follow the week start", () => {
    expect(monthKeyTarget("2026-10-21", "Home", false, 1)).toBe("2026-10-19");
    expect(monthKeyTarget("2026-10-21", "End", false, 1)).toBe("2026-10-25");
    expect(monthKeyTarget("2026-10-21", "Home", true, 0)).toBe("2026-10-18");
    expect(monthKeyTarget("2026-10-21", "End", true, 0)).toBe("2026-10-24");
  });

  test("Page Up and Page Down change the month and keep the day when it exists", () => {
    expect(monthKeyTarget("2026-01-31", "PageDown", false, 1)).toBe("2026-02-28");
    expect(monthKeyTarget("2026-03-15", "PageUp", false, 1)).toBe("2026-02-15");
    expect(monthKeyTarget("2026-10-20", "Enter", false, 1)).toBeNull();
  });

  test("month arithmetic wraps the year", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(sameDayIn("2024-03-31", 2024, 2)).toBe("2024-02-29");
  });
});
