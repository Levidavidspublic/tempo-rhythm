/**
 * Review finding (a11y, WCAG 2.4.11 Focus Not Obscured): the week grid's day names stick to the
 * top of its scroll region above the items (z-index 3 over the focus ring's 2), and the region had
 * no scroll padding, so Shift+Tab to an item scrolled it in under the day names and hid its ring.
 * The region now keeps the day names' height (plus room for the ring) clear when it scrolls focus
 * into view. The calendar's Week view draws the same WeekGrid, so the one rule covers both.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const css = readFileSync(join(root, "apps/web/app/v3/plan.css"), "utf8");

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!match?.[1]) throw new Error(`no rule for ${selector}`);
  return match[1];
}

describe("week grid: focus isn't hidden under the sticky day names", () => {
  test("the scroll region keeps the day names' height clear, plus room for the ring", () => {
    expect(rule(".tp-sched__scroll")).toMatch(
      /scroll-padding-block-start:\s*calc\(var\(--tp-sched-head\) \+ var\(--tp-space-2\)\)/
    );
  });

  test("the day names are that height at least, and the height comes from type and space tokens", () => {
    expect(rule(".tp-sched__col > .tp-week__head, .tp-sched__corner")).toMatch(
      /position:\s*sticky[\s\S]*min-block-size:\s*var\(--tp-sched-head\)/
    );
    expect(rule(".tp-sched")).toMatch(
      /--tp-sched-head:\s*calc\(var\(--tp-text-lg\) \* var\(--tp-leading-body\) \+ var\(--tp-space-1\) \* 2\)/
    );
  });

  test("the calendar's Week view is the same grid, so the rule covers it too", () => {
    const views = readFileSync(join(root, "apps/web/components/calendar/CalendarViews.tsx"), "utf8");
    expect(views).toContain('import { WeekGrid } from "./WeekGrid"');
    const grid = readFileSync(join(root, "apps/web/components/calendar/WeekGrid.tsx"), "utf8");
    expect(grid).toContain('className="tp-sched__scroll"');
  });
});
