import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeekGlanceView } from "@/components/notes/WeekGlanceView";
import { type Lang, translate } from "./i18n";
import { formatMinutes, weekBounds, weekGlance } from "./week-glance";

const at = (date: string, hour: number) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour).getTime();
};

const TASKS = [
  { status: "done", completedAt: at("2026-10-12", 9) },
  { status: "done", completedAt: at("2026-10-12", 17) },
  { status: "done", completedAt: at("2026-10-14", 11) },
  { status: "todo" },
  { status: "done", completedAt: at("2026-10-19", 8) }, // next Monday: not this week
  { status: "cancelled", completedAt: at("2026-10-13", 8) },
];
const BLOCKS = [
  { startedAtMs: at("2026-10-13", 10), durationMs: 25 * 60_000 },
  { startedAtMs: at("2026-10-13", 15), durationMs: 50 * 60_000 },
  { startedAtMs: at("2026-10-11", 15), durationMs: 50 * 60_000 }, // the Sunday before
];

describe("weekGlance", () => {
  test("counts finished tasks and focus minutes per local day, Monday to Sunday", () => {
    const g = weekGlance("2026-10-12", TASKS, BLOCKS);
    expect(g?.days.map((d) => d.date)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(g?.days.map((d) => d.done)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(g?.days.map((d) => d.focusMinutes)).toEqual([0, 75, 0, 0, 0, 0, 0]);
    expect(g?.done).toBe(3);
    expect(g?.focusMinutes).toBe(75);
    expect(g?.activeDays).toBe(3);
    // Each finished task and each 25 focus minutes is one: 2 done -> 2, 75 min -> 3, 1 done -> 1.
    expect(g?.days.slice(0, 3).map((d) => d.level)).toEqual([2, 3, 1]);
  });

  test("a quiet week is all zeros, and a bad date gives nothing", () => {
    const g = weekGlance("2026-10-12", [], []);
    expect(g?.activeDays).toBe(0);
    expect(g?.days.every((d) => d.level === 0)).toBe(true);
    expect(weekGlance("2026-02-30", TASKS, BLOCKS)).toBeNull();
    expect(weekGlance("week 42", TASKS, BLOCKS)).toBeNull();
  });

  test("days follow local midnights, so a clock change never moves a task to the wrong day", () => {
    const bounds = weekBounds("2026-10-19");
    expect(bounds).toHaveLength(8);
    for (let i = 0; i < 7; i += 1) {
      const start = new Date(bounds?.[i] as number);
      expect([start.getHours(), start.getMinutes()]).toEqual([0, 0]);
    }
  });

  test("minutes read as minutes, then hours and minutes", () => {
    const p = { min: "{m} min", hmin: "{h} h {m} min" };
    expect(formatMinutes(40, p)).toBe("40 min");
    expect(formatMinutes(75, p)).toBe("1 h 15 min");
    expect(formatMinutes(-3, p)).toBe("0 min");
  });
});

describe("WeekGlanceView (PanelUI KPI and Day Grid)", () => {
  const render = (lang: Lang, tasks = TASKS, blocks = BLOCKS) => {
    const glance = weekGlance("2026-10-12", tasks, blocks);
    if (!glance) throw new Error("no glance");
    return renderToStaticMarkup(
      createElement(WeekGlanceView, { glance, lang, t: (key: Parameters<typeof translate>[1]) => translate(lang, key) }),
    );
  };

  test("three stat cards with the week's numbers and labelled sparklines", () => {
    const html = render("en");
    expect(html).toContain('data-component="WeekGlance"');
    expect(html.match(/data-component="StatCard"/g)).toHaveLength(3);
    expect(html).toContain("This week at a glance");
    expect(html).toContain(">3<");
    expect(html).toContain("1 h 15 min");
    expect(html).toContain('aria-label="Finished each day, Monday to Sunday"');
    expect(html).not.toContain('aria-label="Trend"');
    expect(html).toContain("Something on 3 of 7 days this week.");
    // Tempo's tokens feed PanelUI's raw colour names.
    expect(html).toContain("--primary:var(--color-primary)");
  });

  test("a quiet week says it's fine, never a streak or a score", () => {
    const html = render("en", [], []);
    expect(html).toContain("Nothing finished yet this week, and that&#x27;s fine.");
    expect(html.toLowerCase()).not.toContain("streak");
  });

  test("the focus total follows the page's direction, so Hebrew reads hours first", () => {
    for (const lang of ["en", "he"] as const) {
      const total = formatMinutes(75, { min: translate(lang, "wk.min"), hmin: translate(lang, "wk.hmin") });
      const tag = render(lang).match(new RegExp(`<[^<>]*class="([^"]*)"[^<>]*>${total}<`));
      expect({ lang, found: tag !== null }).toEqual({ lang, found: true });
      // tp-num forces left to right: right for a bare number, backwards for "1 שע׳ 15 דק׳".
      expect({ lang, tpNum: tag?.[1]?.split(" ").includes("tp-num") }).toEqual({ lang, tpNum: false });
      expect(tag?.[1]).toContain("tabular-nums");
    }
  });

  test("Hebrew: the same cards in Hebrew", () => {
    const html = render("he");
    expect(html).toContain(translate("he", "wk.title"));
    expect(html).toContain(translate("he", "wk.summary").replace("{a}", "3"));
    expect(html).not.toContain("This week at a glance");
  });
});
