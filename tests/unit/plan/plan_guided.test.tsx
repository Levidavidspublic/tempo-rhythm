/**
 * Kitchen S9: the plan preview as a GuidedPlanCard. Sessions become steps grouped by week, the
 * edited steps go back as the sessions `plans.createFromPreview` takes, and the "doesn't fit"
 * notice with its three ways out stays above the card.
 */
import { describe, expect, test } from "bun:test";
import { GuidedPlanCard } from "../../../packages/ui/src/plan/GuidedPlanCard";
import { guidedEditReducer } from "../../../packages/ui/src/plan/guided-plan";
import { emptyLabelKeys } from "../../../packages/ui/src/study/shared";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { PlanPreview } from "../../../apps/web/components/calendar/plan/PlanParts";
import {
  buildPreview,
  DEFAULT_FORM,
  guidedLabels,
  type PlanFormValues,
  previewKey,
  sessionsFromSteps,
  toGuidedSteps,
  waysOut,
} from "../../../apps/web/components/calendar/plan/planForm";

const TODAY = "2026-10-16"; // a Friday

const form = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({
  ...DEFAULT_FORM,
  title: "Maths exam",
  deadline: "2026-11-06",
  topicsText: "Algebra\nGeometry | 2\nProbability",
  ...over,
});

const okPreview = (values: PlanFormValues, lang: "en" | "he" = "en") => {
  const state = buildPreview(values, TODAY, lang);
  if (state.status !== "ok") throw new Error("expected a plan");
  return state;
};

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("sessions as GuidedPlanCard steps", () => {
  test("one step per session, in order, grouped by week (Monday first in English, Sunday in Hebrew)", () => {
    const state = okPreview(form());
    const steps = toGuidedSteps(state.sessions, "en");
    expect(steps).toHaveLength(state.sessions.length);
    expect(steps[0]).toMatchObject({
      id: "s0",
      title: "Learn: Algebra",
      kind: "learn",
      date: TODAY,
      startMinute: 17 * 60,
      groupId: "2026-10-12",
    });
    expect(steps[0]?.groupLabel).toMatch(/Week of Mon,? 12 Oct/);
    expect([...new Set(steps.map((s) => s.groupId))]).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
    const he = toGuidedSteps(okPreview(form(), "he").sessions, "he");
    expect(he[0]?.groupId).toBe("2026-10-11");
    expect(he[0]?.title).toBe("לימוד: Algebra");
  });

  test("unedited steps go back as exactly the preview's sessions", () => {
    const state = okPreview(form());
    expect(sessionsFromSteps(toGuidedSteps(state.sessions, "en"))).toEqual(
      state.sessions.map((s) => ({
        title: s.label,
        date: s.date,
        startMinute: s.startMinute,
        minutes: s.minutes,
        kind: s.kind,
      }))
    );
  });

  test("edits change what is saved: rename, a new length, a move and a removal", () => {
    const state = okPreview(form());
    let steps = toGuidedSteps(state.sessions, "en");
    // A day with two sessions, one after the other.
    const first = steps.findIndex((s, i) => steps[i + 1]?.date === s.date);
    expect(first).toBeGreaterThanOrEqual(0);
    const a = steps[first]!;
    const b = steps[first + 1]!;
    expect(b.startMinute).toBe(a.startMinute! + a.minutes);

    steps = guidedEditReducer(steps, { type: "rename", id: a.id, title: "  Algebra, chapter 1  " });
    steps = guidedEditReducer(steps, { type: "setMinutes", id: a.id, minutes: 40 });
    const saved = sessionsFromSteps(steps);
    expect(saved[first]).toMatchObject({ title: "Algebra, chapter 1", minutes: 40, startMinute: a.startMinute });
    // The next session that day now starts when the longer one ends.
    expect(saved[first + 1]?.startMinute).toBe(a.startMinute! + 40);

    const moved = sessionsFromSteps(guidedEditReducer(steps, { type: "move", id: b.id, by: -1 }));
    expect(moved[first]).toMatchObject({ title: b.title, startMinute: a.startMinute, date: a.date });
    expect(moved[first + 1]).toMatchObject({ title: "Algebra, chapter 1", startMinute: a.startMinute! + b.minutes });

    const removed = sessionsFromSteps(guidedEditReducer(steps, { type: "remove", id: a.id }));
    expect(removed).toHaveLength(state.sessions.length - 1);
    expect(removed[first]).toMatchObject({ title: b.title, startMinute: a.startMinute });
    // Every saved session stays inside what the plans backend takes.
    for (const s of removed) {
      expect(s.startMinute).toBeGreaterThanOrEqual(0);
      expect(s.startMinute).toBeLessThanOrEqual(1439);
      expect(s.minutes).toBeGreaterThan(0);
    }
  });

  test("the preview key changes with the plan, not with a re-render", () => {
    const a = okPreview(form());
    const b = okPreview(form());
    expect(previewKey(a.sessions)).toBe(previewKey(b.sessions));
    expect(previewKey(okPreview(form({ sessionMinutes: 60 })).sessions)).not.toBe(previewKey(a.sessions));
  });

  test("labels are complete in English and Hebrew, kind, with no em dashes", () => {
    for (const lang of ["en", "he"] as const) {
      const labels = guidedLabels(lang);
      expect(emptyLabelKeys(labels)).toEqual([]);
      expect(emptyLabelKeys(labels.kinds)).toEqual([]);
      expect(emptyLabelKeys(labels.statuses)).toEqual([]);
      expect(emptyLabelKeys(labels.errors)).toEqual([]);
      const all = JSON.stringify(labels);
      expect(all.toLowerCase()).not.toMatch(/fail|overdue|must|—/);
    }
    expect(guidedLabels("en").accept).toBe("Add these sessions");
    expect(guidedLabels("he").statuses).toEqual({ todo: "לביצוע", doing: "בתהליך", done: "בוצע" });
  });
});

describe("PlanPreview with the GuidedPlanCard", () => {
  const card = (lang: "en" | "he") => (sessions: Parameters<typeof toGuidedSteps>[0]) =>
    createElement(GuidedPlanCard, {
      title: "Maths exam",
      steps: toGuidedSteps(sessions, lang),
      labels: guidedLabels(lang),
      onAccept: () => {},
      onReject: () => {},
    });

  test("the card replaces the week list and its totals; Accept is the one primary", () => {
    const state = okPreview(form());
    const html = renderToStaticMarkup(createElement(PlanPreview, { state, lang: "en", renderSessions: card("en") }));
    expect(html).toContain('data-component="GuidedPlanCard"');
    expect(html).not.toContain('class="tp-plan__week"');
    expect(html).not.toContain('data-testid="plan-totals"');
    expect(count(html, 'class="tp-guided__group"')).toBe(4);
    expect(html).toMatch(
      new RegExp(`Adds <span class="tp-num">${state.sessions.length}</span> sessions on <span class="tp-num">${state.result.daysUsed}</span> days`)
    );
    expect(count(html, "tp-btn--primary")).toBe(1);
    expect(html).toContain("Add these sessions");
    expect(html).toContain("Not this plan");
    expect(html).toContain('<span class="tp-num tp-mono tp-ltr">17:00</span>');
  });

  test("when it doesn't fit, the three ways out stay above the card", () => {
    const values = form({ deadline: "2026-10-19", topicsText: "A | 3\nB | 3\nC | 3", minutesPerDay: 60 });
    const state = okPreview(values);
    expect(state.result.shortBy).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      createElement(PlanPreview, {
        state,
        lang: "en",
        ways: waysOut(values, TODAY),
        onUseDate: () => {},
        onUseMinutes: () => {},
        onEditTopics: () => {},
        renderSessions: card("en"),
      })
    );
    expect(html).toContain('data-testid="plan-short"');
    for (const way of ["topics", "longer", "later"]) expect(html).toContain(`data-way="${way}"`);
    expect(html.indexOf('data-testid="plan-short"')).toBeLessThan(html.indexOf('data-component="GuidedPlanCard"'));
    expect(html.toLowerCase()).not.toMatch(/fail|overdue|must|behind/);
  });

  test("Hebrew: week groups and the card's words", () => {
    const state = okPreview(form(), "he");
    const html = renderToStaticMarkup(createElement(PlanPreview, { state, lang: "he", renderSessions: card("he") }));
    expect(html).toContain("הוספת המפגשים");
    expect(html).toContain("עריכה");
    expect(html).toContain("לביצוע");
    expect(html).toContain("השבוע של");
  });
});
