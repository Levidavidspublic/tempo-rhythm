/**
 * Kitchen T8 (S3): "Plan back from a deadline". The form, the live preview (grouped by week,
 * totals in words) and the three ways out when the plan doesn't fit.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { PlanForm, PlanPreview } from "../../../apps/web/components/calendar/plan/PlanParts";
import {
  buildPreview,
  busyByDate,
  DEFAULT_FORM,
  groupByWeek,
  type PlanFormValues,
  parseTopics,
  waysOut,
} from "../../../apps/web/components/calendar/plan/planForm";
import { pt } from "../../../apps/web/components/calendar/planCopy";

const TODAY = "2026-10-16"; // a Friday

const form = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({
  ...DEFAULT_FORM,
  title: "Maths exam",
  deadline: "2026-11-06",
  topicsText: "Algebra\nGeometry | 2\nProbability",
  ...over,
});

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("parseTopics", () => {
  test("one per line, optional | weight, blank lines skipped", () => {
    expect(parseTopics("Algebra\n\n  Geometry | 2 \nחשבון דיפרנציאלי|1.5\nChapter 3")).toEqual([
      { title: "Algebra" },
      { title: "Geometry", weight: 2 },
      { title: "חשבון דיפרנציאלי", weight: 1.5 },
      { title: "Chapter 3" },
    ]);
    expect(parseTopics("| 2")).toEqual([{ title: "| 2" }]);
  });
});

describe("buildPreview", () => {
  test("empty until there is a date and a topic; kind errors for a past date or zero minutes", () => {
    expect(buildPreview(form({ topicsText: "  " }), TODAY, "en")).toEqual({ status: "empty" });
    expect(buildPreview(form({ deadline: "" }), TODAY, "en")).toEqual({ status: "empty" });
    expect(buildPreview(form({ deadline: TODAY }), TODAY, "en")).toEqual({ status: "error", message: "pp.err.date" });
    expect(buildPreview(form({ minutesPerDay: 0 }), TODAY, "en")).toEqual({ status: "error", message: "pp.err.number" });
  });

  test("sessions on a day follow each other from the start time, titled in the person's language", () => {
    const state = buildPreview(form(), TODAY, "en");
    if (state.status !== "ok") throw new Error("expected a plan");
    expect(state.result.shortBy).toBe(0);
    const first = state.sessions[0];
    expect(first).toMatchObject({ date: TODAY, kind: "learn", startMinute: 17 * 60, label: "Learn: Algebra" });
    const sameDay = state.sessions.filter((s) => s.date === state.sessions[1]?.date);
    for (let i = 1; i < sameDay.length; i += 1) {
      const prev = sameDay[i - 1]!;
      expect(sameDay[i]!.startMinute).toBe(prev.startMinute + prev.minutes);
    }
    const he = buildPreview(form(), TODAY, "he");
    if (he.status !== "ok") throw new Error("expected a plan");
    expect(he.sessions[0]?.label).toBe("לימוד: Algebra");
  });
});

describe("PlanPreview", () => {
  test("groups sessions by week, Monday first in English and Sunday first in Hebrew", () => {
    const state = buildPreview(form(), TODAY, "en");
    if (state.status !== "ok") throw new Error("expected a plan");
    const weeks = groupByWeek(state.sessions, 1);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(groupByWeek(state.sessions, 0).map((w) => w.weekStart)[0]).toBe("2026-10-11");

    const html = renderToStaticMarkup(createElement(PlanPreview, { state, lang: "en" }));
    expect(count(html, 'class="tp-plan__week"')).toBe(4);
    expect(html).toMatch(/Week of Mon,? 12 Oct/);
    expect(html).toContain('data-testid="plan-totals"');
    expect(html).toMatch(
      new RegExp(`<span class="tp-num">${state.sessions.length}</span> sessions on <span class="tp-num">${state.result.daysUsed}</span> days`)
    );
    expect(html).toContain('<span class="tp-num tp-mono tp-ltr">17:00</span>');
    expect(html).not.toContain("plan-short");
  });

  test("when it doesn't fit: the minutes missing and three ways out, no shaming", () => {
    const values = form({ deadline: "2026-10-19", topicsText: "A | 3\nB | 3\nC | 3", minutesPerDay: 60 });
    const state = buildPreview(values, TODAY, "en");
    if (state.status !== "ok") throw new Error("expected a plan");
    expect(state.result.shortBy).toBeGreaterThan(0);
    const ways = waysOut(values, TODAY);
    expect(ways.longerMinutes).not.toBeNull();
    expect(ways.laterDate).not.toBeNull();
    // Each way really fits.
    for (const fix of [{ minutesPerDay: ways.longerMinutes as number }, { deadline: ways.laterDate as string }]) {
      const fixed = buildPreview({ ...values, ...fix }, TODAY, "en");
      expect(fixed.status === "ok" && fixed.result.shortBy).toBe(0);
    }

    const html = renderToStaticMarkup(
      createElement(PlanPreview, {
        state,
        lang: "en",
        ways,
        onUseDate: () => {},
        onUseMinutes: () => {},
        onEditTopics: () => {},
      })
    );
    expect(html).toContain('data-testid="plan-short"');
    expect(html).toContain(`<span class="tp-num">${state.result.shortBy}</span> more minutes than the days hold`);
    for (const way of ["topics", "longer", "later"]) expect(html).toContain(`data-way="${way}"`);
    expect(html).toContain("Fewer topics");
    expect(html).toContain("Longer days");
    expect(html).toContain("A later date");
    expect(html).toContain(`<span class="tp-num">${ways.longerMinutes}</span> minutes a day`);
    expect(html.toLowerCase()).not.toMatch(/fail|overdue|must|behind/);
  });

  test("a way out that can't be offered says so in words instead of an empty heading", () => {
    // A session longer than the minutes a day: no later date fits, so that way explains itself.
    const values = form({ deadline: "2026-10-19", minutesPerDay: 30, sessionMinutes: 45 });
    const state = buildPreview(values, TODAY, "en");
    if (state.status !== "ok") throw new Error("expected a preview");
    expect(state.result.shortBy).toBeGreaterThan(0);
    const ways = waysOut(values, TODAY);
    expect(ways.laterDate).toBeNull();
    for (const lang of ["en", "he"] as const) {
      const html = renderToStaticMarkup(
        createElement(PlanPreview, { state, lang, ways, onUseDate: () => {}, onUseMinutes: () => {} })
      );
      expect(html).toContain(pt(lang, "pp.short.laterNone"));
      // When no day length holds it either, that way says so too.
      const none = renderToStaticMarkup(
        createElement(PlanPreview, { state, lang, ways: { longerMinutes: null, laterDate: null } })
      );
      expect(none).toContain(pt(lang, "pp.short.longerNone"));
      expect(none).toContain(pt(lang, "pp.short.laterNone"));
      expect(html).toContain(pt(lang, "pp.short.laterNone"));
    }
  });

  test("a day that would run past midnight is a kind form error, in English and Hebrew", () => {
    const late = form({ startTime: "23:30", minutesPerDay: 135 });
    expect(buildPreview(late, TODAY, "en")).toEqual({ status: "error", message: "pp.err.late" });
    // Ending exactly at midnight is fine.
    expect(buildPreview(form({ startTime: "22:30", minutesPerDay: 90 }), TODAY, "en").status).toBe("ok");
    for (const lang of ["en", "he"] as const) {
      const html = renderToStaticMarkup(
        createElement(PlanPreview, { state: { status: "error", message: "pp.err.late" }, lang })
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(lang === "en" ? "past midnight" : "אחרי חצות");
      expect(html.toLowerCase()).not.toMatch(/fail|overdue|must/);
    }
    // "Longer days" never offers a day that would cross midnight.
    const tight = form({ deadline: "2026-10-19", topicsText: "A | 3\nB | 3\nC | 3", minutesPerDay: 60, startTime: "21:00" });
    const ways = waysOut(tight, TODAY);
    if (ways.longerMinutes !== null) expect(21 * 60 + ways.longerMinutes).toBeLessThanOrEqual(1440);
  });

  test("busy minutes from fixed events and dated tasks shrink the days the plan uses", () => {
    const at = (date: string, h: number, m = 0) => {
      const [y, mo, d] = date.split("-").map(Number);
      return new Date(y!, mo! - 1, d!, h, m).getTime();
    };
    const busy = busyByDate({
      events: [
        { id: "e1", title: "Class", startsAtMs: at("2026-10-16", 9) },
        { id: "e2", title: "Trip", startsAtMs: at("2026-10-17", 0) }, // all day: no time taken
      ],
      tasks: [
        { _id: "t1", title: "Essay", dueAt: at("2026-10-16", 14), timeEstimate: 30 * 60_000, status: "todo" },
        { _id: "t2", title: "Done", dueAt: at("2026-10-16", 15), status: "done" },
        { _id: "t3", title: "Gone", dueAt: at("2026-10-16", 16), status: "cancelled" },
      ],
    });
    expect(busy).toEqual({ "2026-10-16": 90 });

    const values = form();
    const free = buildPreview(values, TODAY, "en");
    const taken = buildPreview(values, TODAY, "en", busy);
    if (free.status !== "ok" || taken.status !== "ok") throw new Error("expected plans");
    expect(free.sessions.some((s) => s.date === TODAY)).toBe(true);
    // 90 busy minutes fill the 90-minute day, so nothing lands on it.
    expect(taken.sessions.some((s) => s.date === TODAY)).toBe(false);
  });

  test("empty and error states read kindly", () => {
    expect(renderToStaticMarkup(createElement(PlanPreview, { state: { status: "empty" }, lang: "en" }))).toContain(
      "Add a date and at least one topic"
    );
    const err = renderToStaticMarkup(
      createElement(PlanPreview, { state: { status: "error", message: "pp.err.date" }, lang: "he" })
    );
    expect(err).toContain('role="alert"');
    expect(err).toContain("בחרו תאריך אחרי היום.");
  });
});

describe("PlanForm", () => {
  test("labelled fields, seven days-off checkboxes, Sunday first in Hebrew", () => {
    const en = renderToStaticMarkup(createElement(PlanForm, { values: form(), onChange: () => {}, lang: "en" }));
    expect(en).toContain("What it&#x27;s for");
    expect(en).toContain('type="date"');
    expect(en).toContain("Topics, one per line");
    expect(count(en, 'type="checkbox"')).toBe(7);
    expect(en.indexOf("Monday")).toBeLessThan(en.indexOf("Sunday"));
    const he = renderToStaticMarkup(createElement(PlanForm, { values: form(), onChange: () => {}, lang: "he" }));
    expect(he.indexOf("יום ראשון")).toBeLessThan(he.indexOf("יום שני"));
  });

  test("a missing name is flagged on the field", () => {
    const html = renderToStaticMarkup(
      createElement(PlanForm, { values: form({ title: "" }), onChange: () => {}, lang: "en", titleError: true })
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="pp-title-err"');
    expect(html).toContain("Give the plan a short name first.");
  });
});
