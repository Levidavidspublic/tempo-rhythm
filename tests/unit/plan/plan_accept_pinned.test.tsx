/**
 * Kitchen S9 fix: after "Add these sessions", the accepted plan stays on the card while its 5:00
 * Undo is open, whatever the form says now. A title typo, another date or a language switch
 * changes the preview key; before this fix that drew a fresh pending card, so Undo was gone and
 * Accept could add the plan a second time.
 */
import { describe, expect, test } from "bun:test";
import { GuidedPlanCard } from "../../../packages/ui/src/plan/GuidedPlanCard";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { PlanPreview } from "../../../apps/web/components/calendar/plan/PlanParts";
import {
  buildPreview,
  DEFAULT_FORM,
  guidedLabels,
  type PlanFormValues,
  previewKey,
  shownDecision,
  toGuidedSteps,
} from "../../../apps/web/components/calendar/plan/planForm";

const TODAY = "2026-10-16";

const form = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({
  ...DEFAULT_FORM,
  title: "Maths exam",
  deadline: "2026-11-06",
  topicsText: "Algebra\nGeometry | 2\nProbability",
  ...over,
});

const ok = (values: PlanFormValues, lang: "en" | "he" = "en") => {
  const state = buildPreview(values, TODAY, lang);
  if (state.status !== "ok") throw new Error("expected a plan");
  return state;
};

const accepted = (key: string) => ({ key, status: "accepted" as const, undoUntil: Date.now() + 5 * 60_000 });

describe("shownDecision", () => {
  const first = ok(form());
  const keyA = previewKey(first.sessions);

  test("a key change after Accept keeps the accepted plan while Undo is open", () => {
    const decision = accepted(keyA);
    const changes = [
      previewKey(ok(form({ title: "Maths exam!" })).sessions),
      previewKey(ok(form({ minutesPerDay: 120 })).sessions),
      previewKey(ok(form({ deadline: "2026-11-13" })).sessions),
      previewKey(ok(form(), "he").sessions),
      "",
    ];
    // A language switch is one of these: session labels are translated, so the key changes.
    expect(changes[3]).not.toBe(keyA);
    for (const key of changes) {
      expect(shownDecision(decision, key, true)).toEqual({ decision, pinned: true });
    }
  });

  test("once the window closes, a new key is a fresh proposal and the same key keeps its card", () => {
    const decision = accepted(keyA);
    expect(shownDecision(decision, "other", false)).toEqual({ decision: null, pinned: false });
    expect(shownDecision(decision, keyA, false)).toEqual({ decision, pinned: false });
  });

  test("undone and rejected decisions follow the key, as before", () => {
    for (const status of ["undone", "rejected"] as const) {
      const decision = { key: keyA, status };
      expect(shownDecision(decision, keyA, true)).toEqual({ decision, pinned: false });
      expect(shownDecision(decision, "other", true)).toEqual({ decision: null, pinned: false });
    }
    expect(shownDecision(null, keyA, true)).toEqual({ decision: null, pinned: false });
  });
});

describe("PlanPreview with a pinned accepted card", () => {
  const steps = toGuidedSteps(ok(form()).sessions, "en");
  const pinnedCard = createElement(GuidedPlanCard, {
    title: "Maths exam",
    steps,
    labels: guidedLabels("en"),
    status: "accepted",
    undoUntilMs: Date.now() + 5 * 60_000,
    onAccept: () => {},
    onReject: () => {},
    onUndo: () => {},
  });
  const freshCard = (sessions: Parameters<typeof toGuidedSteps>[0]) =>
    createElement(GuidedPlanCard, {
      title: "Maths exam!",
      steps: toGuidedSteps(sessions, "en"),
      labels: guidedLabels("en"),
      onAccept: () => {},
      onReject: () => {},
    });

  test("the form changed: the accepted card keeps Undo and offers no second Accept", () => {
    const changed = ok(form({ title: "Maths exam!", minutesPerDay: 120 }));
    const html = renderToStaticMarkup(
      createElement(PlanPreview, { state: changed, lang: "en", pinned: pinnedCard, renderSessions: freshCard })
    );
    expect(html).toContain('data-state="accepted"');
    expect(html).toContain('data-action="guided-undo"');
    expect(html).not.toContain('data-action="guided-accept"');
    expect(html).not.toContain("tp-btn--primary");
    expect(html.split('data-component="GuidedPlanCard"')).toHaveLength(2);
  });

  test("the form is now empty or wrong: the accepted card still shows with Undo", () => {
    for (const state of [{ status: "empty" } as const, { status: "error", message: "pp.err.date" } as const]) {
      const html = renderToStaticMarkup(createElement(PlanPreview, { state, lang: "en", pinned: pinnedCard }));
      expect(html).toContain('data-action="guided-undo"');
      expect(html).not.toContain("Add a date and at least one topic");
      expect(html).not.toContain('role="alert"');
    }
  });

  test("without a pinned card the preview draws as before", () => {
    const html = renderToStaticMarkup(
      createElement(PlanPreview, { state: ok(form()), lang: "en", pinned: null, renderSessions: freshCard })
    );
    expect(html).toContain('data-action="guided-accept"');
    expect(html).toContain('data-state="pending"');
  });
});
