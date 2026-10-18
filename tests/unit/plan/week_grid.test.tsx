/**
 * Kitchen T8 (S4): WeekGrid and its ItemMover. Static renders plus the pure move helpers.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import {
  fixedClashes,
  ItemMover,
  moverMoves,
  WeekGrid,
  type WeekGridProps,
  type WeekItem,
} from "../../../apps/web/components/calendar/WeekGrid";

const item = (over: Partial<WeekItem> & { id: string }): WeekItem => ({
  date: "2026-10-20",
  startMinute: 9 * 60,
  durationMinutes: 60,
  kind: "flexible",
  title: over.id,
  ...over,
});

const items: WeekItem[] = [
  item({ id: "class", title: "Physics class", kind: "fixed", startMinute: 10 * 60 }),
  item({ id: "algebra", title: "Learn: Algebra", startMinute: 10 * 60 + 30, durationMinutes: 45 }),
  item({ id: "early", title: "Gym", date: "2026-10-21", startMinute: 6 * 60, durationMinutes: 30 }),
  item({ id: "late1", title: "Call", date: "2026-10-22", startMinute: 23 * 60, durationMinutes: 30 }),
  item({ id: "late2", title: "Read", date: "2026-10-22", startMinute: 22 * 60 + 30, durationMinutes: 15 }),
];

function render(props: Partial<WeekGridProps> = {}): string {
  return renderToStaticMarkup(
    createElement(WeekGrid, {
      weekStart: "2026-10-19",
      items,
      allDay: [{ id: "trip", date: "2026-10-23", title: "School trip", kind: "fixed" as const }],
      today: "2026-10-20",
      nowMinute: 11 * 60 + 5,
      lang: "en",
      onMove: () => {},
      ...props,
    })
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("WeekGrid", () => {
  test("7 day columns, today marked, scrolling inside its own region", () => {
    const html = render();
    expect(count(html, 'class="tp-week__col tp-sched__col"')).toBe(7);
    expect(html).toMatch(/aria-current="date"[^>]*data-date="2026-10-20"/);
    expect(html).toMatch(/<section class="tp-sched__scroll" aria-label="Week of Mon,? 19 Oct, scrolls inside itself">/);
    expect(html).toContain("07:00");
    expect(html).toContain("21:00");
  });

  test("fixed items are solid with the word Fixed, flexible ones dashed with Flexible", () => {
    const html = render();
    expect(html).toMatch(/data-kind="fixed" data-item-id="class"[^>]*>.*?Physics class.*?Fixed/);
    expect(html).toMatch(/data-kind="flex" data-item-id="algebra"[^>]*>.*?Learn: Algebra.*?Flexible/);
    expect(html).toContain('<span class="tp-week__time tp-num tp-mono tp-ltr">10:30–11:15</span>');
  });

  test("overlapping items share the column in lanes", () => {
    const html = render();
    expect(html).toContain("--top:6;--height:2;--lane:0;--lanes:2");
    expect(html).toContain("--top:7;--height:1.5;--lane:1;--lanes:2");
  });

  test("items outside the visible hours are counted in words", () => {
    const html = render();
    expect(html).toContain('<span class="tp-num">1</span> item earlier');
    expect(html).toContain('<span class="tp-num">2</span> items later');
    expect(html).not.toContain(">Gym<");
  });

  test("all-day items show their title; empty days say so", () => {
    const html = render();
    expect(html).toContain("School trip");
    expect(html).toContain("Nothing planned.");
  });

  test("a Now line in today's column only", () => {
    const html = render();
    expect(count(html, "tp-sched__now")).toBe(1);
    expect(html).toContain('<span class="tp-num tp-mono tp-ltr">11:05</span>');
    expect(render({ today: "2026-11-02" })).not.toContain("tp-sched__now");
  });

  test("a clash with a fixed item is named in words", () => {
    const html = render();
    expect(html).toContain("Overlaps with fixed items");
    expect(html).toMatch(/<bdi dir="auto">Learn: Algebra<\/bdi> overlaps <bdi dir="auto">Physics class<\/bdi> \(Fixed\) on Tue,? 20 Oct for <span class="tp-num">30<\/span> min\./);
    expect(fixedClashes(items).map((c) => [c.flexible.id, c.fixed.id, c.minutes])).toEqual([
      ["algebra", "class", 30],
    ]);
  });

  test("every visible item is a button that controls the mover", () => {
    const html = render();
    expect(count(html, 'aria-controls="week-mover"')).toBe(2);
    expect(count(html, 'aria-expanded="false"')).toBe(2);
  });

  test("Hebrew labels and a Sunday-first week", () => {
    const html = render({ lang: "he", weekStart: "2026-10-18" });
    expect(html).toContain("קבוע");
    expect(html).toContain("גמיש");
    expect(html).toMatch(/data-date="2026-10-18"/);
  });
});

describe("ItemMover", () => {
  const algebra = items[1] as WeekItem;
  const mover = (props: Partial<Parameters<typeof ItemMover>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(ItemMover, {
        item: algebra,
        items,
        today: "2026-10-16",
        lang: "en" as const,
        onMove: () => {},
        onClose: () => {},
        ...props,
      })
    );

  test("a flexible item gets day, half-hour and Move to buttons", () => {
    const html = mover();
    for (const key of ["prevDay", "nextDay", "earlier", "later", "to"]) {
      expect(html).toContain(`data-move="${key}"`);
    }
    expect(html).toContain("A day earlier");
    expect(html).toContain("30 minutes later");
    expect(html).toContain("Move to…");
    expect(html).toContain("Overlaps <bdi dir=\"auto\">Physics class</bdi> (Fixed)");
  });

  test("a fixed item, or a read-only grid, offers no moves", () => {
    expect(mover({ item: items[0] as WeekItem })).not.toContain("data-move");
    expect(mover({ item: items[0] as WeekItem })).toContain("Fixed items stay where they are");
    expect(mover({ onMove: undefined })).not.toContain("data-move");
  });

  test("moves are disabled when they would change nothing", () => {
    const atOpen = item({ id: "x", startMinute: 7 * 60 });
    const moves = moverMoves(atOpen);
    expect(moves.find((m) => m.key === "earlier")?.disabled).toBe(true);
    expect(moves.find((m) => m.key === "later")).toEqual({
      key: "later",
      to: { date: "2026-10-20", startMinute: 7 * 60 + 30 },
      disabled: false,
    });
    expect(moves.find((m) => m.key === "prevDay")?.to).toEqual({ date: "2026-10-19", startMinute: 420 });
    expect(moves.find((m) => m.key === "nextDay")?.to.date).toBe("2026-10-21");
  });

  test("a move the clamp would turn the other way is disabled, not saved backwards", () => {
    const early = moverMoves(item({ id: "e", startMinute: 6 * 60 + 30, durationMinutes: 45 }));
    expect(early.find((m) => m.key === "earlier")?.disabled).toBe(true);
    const late = moverMoves(item({ id: "l", startMinute: 21 * 60, durationMinutes: 120 }));
    expect(late.find((m) => m.key === "later")?.disabled).toBe(true);
    expect(late.find((m) => m.key === "earlier")).toMatchObject({
      to: { startMinute: 20 * 60 },
      disabled: false,
    });
  });
});
