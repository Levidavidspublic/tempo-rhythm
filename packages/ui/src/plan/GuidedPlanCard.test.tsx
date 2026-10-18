import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyLabelKeys } from "../study/shared";
import { GuidedPlanCard, type GuidedPlanCardProps, type GuidedPlanLabels } from "./GuidedPlanCard";
import type { GuidedStep } from "./guided-plan";

const labels: GuidedPlanLabels = {
  kind: "Plan",
  target: "Adds to your calendar",
  summary: "{steps} sessions on {days} days, {hours} h {minutes} min in all.",
  list: "Plan steps",
  minutes: "{n} min",
  kinds: { learn: "Learn", review: "Review", practice: "Practice", rest: "Rest", task: "Task" },
  statuses: { todo: "To do", doing: "Doing", done: "Done" },
  statusGroup: "Status of {title}",
  accept: "Add these sessions",
  accepting: "Adding…",
  edit: "Edit",
  doneEditing: "Done editing",
  reject: "Not this one",
  undo: "Undo",
  undoLeft: "{time} left to undo",
  accepted: "Added to your calendar. You can take it back for 5 minutes.",
  kept: "Added to your calendar.",
  undone: "Taken back. Nothing from this plan is on your calendar.",
  rejected: "Set aside. Change the form to see a new plan.",
  editHint: "Rename, change lengths, or move steps with the buttons. Nothing is saved until you add them.",
  nameField: "Name of step {n}",
  minutesField: "Minutes for step {n}",
  moveUp: "Move {title} earlier",
  moveDown: "Move {title} later",
  remove: "Remove {title}",
  errors: {
    titleEmpty: "Give this step a short name.",
    titleLong: "A shorter name fits better.",
    minutesRange: "Use {min} to {max} minutes.",
  },
  tooFew: "Keep at least one step.",
};

const steps: GuidedStep[] = [
  { id: "a", title: "Learn: Algebra", minutes: 45, kind: "learn", date: "2026-10-16", startMinute: 1020, groupId: "w1", groupLabel: "Week of 12 Oct" },
  { id: "b", title: "Review: Algebra", minutes: 30, kind: "review", date: "2026-10-19", startMinute: 1020, groupId: "w2", groupLabel: "Week of 19 Oct" },
  { id: "c", title: "Practice test", minutes: 60, kind: "practice", date: "2026-10-20", startMinute: 1020, groupId: "w2", groupLabel: "Week of 19 Oct" },
];

const render = (over: Partial<GuidedPlanCardProps> = {}) =>
  renderToStaticMarkup(
    createElement(GuidedPlanCard, {
      title: "Maths exam",
      steps,
      labels,
      onAccept: () => {},
      onReject: () => {},
      ...over,
    })
  );

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("GuidedPlanCard", () => {
  test("pending: proposal look, summary in words, steps by week, one primary and three actions", () => {
    const html = render();
    expect(html).toContain('data-component="GuidedPlanCard"');
    expect(html).toContain('class="tp-proposal tp-guided"');
    expect(html).toContain('data-state="pending"');
    expect(html).toContain('<span class="tp-num">3</span> sessions on <span class="tp-num">3</span> days');
    expect(html).toContain('<span class="tp-num">2</span> h <span class="tp-num">15</span> min');
    expect(count(html, 'class="tp-guided__group"')).toBe(2);
    expect(html).toContain("Week of 12 Oct");
    // Numbering runs on across groups.
    expect(html).toContain('<ol class="tp-guided__steps" start="2" aria-label="Week of 19 Oct">');
    expect(count(html, "tp-btn--primary")).toBe(1);
    for (const action of ["guided-accept", "guided-edit", "guided-reject"]) {
      expect(html).toContain(`data-action="${action}"`);
    }
    expect(html).not.toContain('data-action="guided-status"');
    expect(html).not.toContain('data-action="guided-undo"');
  });

  test("steps go through json-render as TaskBlocks; when, kind and status are words with icons", () => {
    const html = render();
    const titles = [...html.matchAll(/<span class="tp-task-row__title" dir="auto">([^<]*)<\/span>/g)].map(
      (m) => m[1]
    );
    expect(titles).toEqual(["Learn: Algebra", "Review: Algebra", "Practice test"]);
    expect(html).toContain('<span class="tp-num">45</span> min');
    expect(html).toContain('<span class="tp-num tp-mono tp-ltr">17:00</span>');
    expect(html).toContain('<span class="tp-num">2026-10-16</span>');
    expect(html).toMatch(/data-kind="practice"><svg[^>]*aria-hidden="true"[\s\S]*?<span>Practice<\/span>/);
    expect(count(html, '<span class="tp-guided__status" data-status="todo"><svg')).toBe(3);
    expect(count(html, "<span>To do</span>")).toBe(3);
    expect(html).not.toContain("<input");
  });

  test("the host's date format is used", () => {
    const html = render({ formatDate: (d) => (d === "2026-10-16" ? "Fri 16 Oct" : d) });
    expect(html).toContain('<span class="tp-num">Fri 16 Oct</span>');
  });

  test("editing: labelled name and minutes fields, move and remove buttons, Accept stays primary", () => {
    const html = render({ initialEditing: true });
    expect(count(html, 'data-field="title"')).toBe(3);
    expect(count(html, 'data-field="minutes"')).toBe(3);
    expect(html).toContain("Name of step 1");
    expect(html).toContain("Minutes for step 3");
    expect(html).toContain('aria-label="Move Learn: Algebra earlier"');
    expect(html).toContain('aria-label="Move Practice test later"');
    expect(html).toContain('aria-label="Remove Review: Algebra"');
    // First can't go earlier, last can't go later.
    expect(html).toMatch(/data-action="guided-move-up" aria-label="Move Learn: Algebra earlier" disabled=""/);
    expect(html).toMatch(/data-action="guided-move-down" aria-label="Move Practice test later" disabled=""/);
    expect(html).toContain('data-action="guided-done-editing"');
    expect(count(html, "tp-btn--primary")).toBe(1);
    expect(html).toContain("Nothing is saved until you add them.");
  });

  test("a step that can't be saved shows a kind error tied to its field, and Accept waits", () => {
    const html = render({
      initialEditing: true,
      steps: [{ ...(steps[0] as GuidedStep), minutes: 800 }, steps[1] as GuidedStep],
    });
    expect(html).toContain("Use 1 to 720 minutes.");
    expect(html).toMatch(/aria-invalid="true" aria-describedby="[^"]*-err-a"/);
    expect(html).toMatch(/data-action="guided-accept" disabled=""/);
  });

  test("accepted: Undo with a 5:00 countdown, status buttons per step, no Accept", () => {
    const html = render({
      status: "accepted",
      undoUntilMs: Date.now() + 5 * 60_000,
      onUndo: () => {},
      onStepStatus: () => {},
      stepStatuses: { a: "done", b: "doing" },
    });
    expect(html).toContain('data-state="accepted"');
    expect(html).toContain('data-action="guided-undo"');
    expect(html).toMatch(/<span class="tp-num tp-mono" aria-hidden="true">(5:00|4:59)<\/span>/);
    expect(html).toContain(labels.accepted);
    expect(html).not.toContain('data-action="guided-accept"');
    expect(count(html, 'data-action="guided-status"')).toBe(9);
    expect(html).toContain("Status of Learn: Algebra");
    expect(html).toMatch(/data-value="done" aria-pressed="true"/);
    expect(html).toMatch(/data-step-id="b"[^>]*data-status="doing"/);
    // Done is a word (and the json-render row knows it), not only a colour.
    expect(html).toContain('data-done="true"');
  });

  test("accepted: the live note holds only the words; Undo and its ticking time sit outside it", () => {
    const html = render({ status: "accepted", undoUntilMs: Date.now() + 5 * 60_000, onUndo: () => {} });
    const live = html.match(/<output[^>]*>[\s\S]*?<\/output>/)?.[0] ?? "";
    expect(live).toContain(labels.accepted);
    expect(live).not.toContain("guided-undo");
    expect(live).not.toContain("left to undo");
    expect(live).not.toMatch(/\d:\d\d/);
    expect(html).toContain('data-action="guided-undo"');
    expect(html).toContain("left to undo");
  });

  test("accepted after the window: kept note, no Undo", () => {
    const html = render({ status: "accepted", undoUntilMs: Date.now() - 1, onUndo: () => {} });
    expect(html).toContain(labels.kept);
    expect(html).not.toContain('data-action="guided-undo"');
    // Without onStepStatus there are no buttons, only the word.
    expect(html).not.toContain('data-action="guided-status"');
  });

  test("undone and rejected: a calm note, no steps", () => {
    for (const status of ["undone", "rejected"] as const) {
      const html = render({ status });
      expect(html).toContain(status === "undone" ? labels.undone : labels.rejected);
      expect(html).not.toContain("tp-guided__step");
      expect(html).toContain('<output class="tp-proposal__note tp-guided__note">');
    }
  });

  test("notice and message slots, and RTL user text", () => {
    const html = render({
      title: "מבחן במתמטיקה",
      steps: [{ id: "h", title: "לימוד: אלגברה", minutes: 30, kind: "learn" }],
      notice: createElement("p", { "data-testid": "notice" }, "short"),
      message: createElement("p", { role: "alert" }, "Sign in"),
    });
    expect(html).toContain('<strong id="');
    expect(html).toMatch(/dir="auto">מבחן במתמטיקה<\/strong>/);
    expect(html).toContain('dir="auto">לימוד: אלגברה</span>');
    expect(html).toContain('data-testid="notice"');
    expect(html).toContain('role="alert"');
    // No groups given: one unlabelled list.
    expect(html).not.toContain("tp-guided__group-title");
  });

  test("labels are complete and the copy is kind", () => {
    expect(emptyLabelKeys(labels)).toEqual([]);
    const html = [render(), render({ initialEditing: true }), render({ status: "rejected" })].join("");
    expect(html.toLowerCase()).not.toMatch(/fail|overdue|must|—/);
  });
});
