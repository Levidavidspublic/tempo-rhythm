/**
 * Kitchen F-07: "Re-plan the rest" on the plan screen. A saved plan's tasks and the calendar become
 * `replanRest` input; the notice says what needs a new time in words; the preview shows what moves
 * where, what doesn't fit and the ways out, with Use these times / Cancel.
 */
import { describe, expect, test } from "bun:test";
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { en, he } from "../../../apps/web/lib/i18n-groups/plan";
import { localSlotToMs } from "../../../apps/web/components/calendar/gridData";
import { ReplanNotice, ReplanPreview } from "../../../apps/web/components/calendar/plan/ReplanPanel";
import {
  type PlanTask,
  planDayCap,
  planSessions,
  replanBusy,
  replanInput,
  replanNotice,
  replanToastTitle,
  replanWindow,
} from "../../../apps/web/components/calendar/plan/replanForm";
import { pt } from "../../../apps/web/components/calendar/planCopy";
import { replanRest, replanWaysOut } from "../../../packages/core/plan/replan";

const MIN = 60_000;
const at = (date: string, hour: number, minute = 0) => localSlotToMs(date, hour * 60 + minute);
const task = (id: string, date: string, hour: number, over: Partial<PlanTask> = {}): PlanTask => ({
  _id: id,
  title: `Session ${id}`,
  status: "todo",
  dueAt: at(date, hour),
  timeEstimate: 45 * MIN,
  ...over,
});

/** A biology plan: Tuesday 20 Oct 2026 at 18:00, the exam on Friday 30 Oct. */
const NOW = { date: "2026-10-20", minute: 18 * 60 };
const planTasks: PlanTask[] = [
  task("t1", "2026-10-18", 17, { title: "Learn: Cells", status: "done" }),
  task("t2", "2026-10-19", 17, { title: "Learn: Mitosis" }),
  task("t3", "2026-10-20", 17, { title: "Review: Cells", status: "in_progress" }),
  task("t4", "2026-10-21", 17, { title: "Learn: Photosynthesis" }),
  task("t5", "2026-10-22", 17, { title: "Practice test", timeEstimate: 90 * MIN }),
  task("t6", "2026-10-23", 17, { title: "Gone", status: "cancelled" }),
  { _id: "t7", title: "No time", status: "todo" },
];
const source = {
  // Swimming moved onto Thursday's practice test.
  events: [{ id: "e1", title: "Swimming club", startsAtMs: at("2026-10-22", 17, 30) }],
  tasks: [
    // This plan's own session shows up in the calendar's task list: never busy for itself.
    { _id: "t4", title: "Learn: Photosynthesis", dueAt: at("2026-10-21", 17), timeEstimate: 45 * MIN, status: "todo" },
    { _id: "x1", title: "Dentist", dueAt: at("2026-10-21", 9), timeEstimate: 60 * MIN, status: "todo" },
    { _id: "x2", title: "Old errand", dueAt: at("2026-10-21", 12), timeEstimate: 30 * MIN, status: "done" },
  ],
};

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("a saved plan as re-plan input", () => {
  test("sessions in local time; cancelled and untimed tasks left out; in progress stays like done", () => {
    expect(planSessions(planTasks)).toEqual([
      { id: "t1", date: "2026-10-18", startMinute: 17 * 60, minutes: 45, status: "done" },
      { id: "t2", date: "2026-10-19", startMinute: 17 * 60, minutes: 45, status: "todo" },
      { id: "t3", date: "2026-10-20", startMinute: 17 * 60, minutes: 45, status: "doing" },
      { id: "t4", date: "2026-10-21", startMinute: 17 * 60, minutes: 45, status: "todo" },
      { id: "t5", date: "2026-10-22", startMinute: 17 * 60, minutes: 90, status: "todo" },
    ]);
  });

  test("the day window is the grid's, widened to the plan's own times, never past midnight", () => {
    const sessions = planSessions(planTasks);
    expect(replanWindow(sessions)).toEqual({ startMinute: 7 * 60, endMinute: 22 * 60 });
    expect(
      replanWindow([...sessions, { id: "x", date: "2026-10-24", startMinute: 6 * 60 + 30, minutes: 30, status: "todo" }])
    ).toEqual({ startMinute: 6 * 60 + 30, endMinute: 22 * 60 });
    expect(
      replanWindow([{ id: "x", date: "2026-10-24", startMinute: 23 * 60 + 30, minutes: 60, status: "todo" }])
    ).toEqual({ startMinute: 7 * 60, endMinute: 1440 });
  });

  test("a day holds no more plan time than the plan's busiest day", () => {
    expect(planDayCap(planSessions(planTasks))).toBe(90);
    expect(planDayCap([])).toBeUndefined();
  });

  test("busy time: events and other tasks, not this plan's sessions, done tasks or all-day items", () => {
    const busy = replanBusy(
      {
        events: [...source.events, { id: "e2", title: "Trip", startsAtMs: at("2026-10-24", 0) }],
        tasks: source.tasks,
      },
      new Set(planTasks.map((t) => t._id))
    );
    expect(busy).toEqual([
      { date: "2026-10-22", startMinute: 17 * 60 + 30, durationMinutes: 60 },
      { date: "2026-10-21", startMinute: 9 * 60, durationMinutes: 60 },
    ]);
  });

  test("nothing can move once the deadline is today or past", () => {
    for (const deadline of ["2026-10-20", "2026-10-19", "not a date"]) {
      expect(replanInput({ deadline, tasks: planTasks, source, now: NOW })).toBeNull();
    }
  });

  test("end to end: the missed session and the one under the swimming club move; the rest stay", () => {
    const input = replanInput({ deadline: "2026-10-30", tasks: planTasks, source, now: NOW });
    if (!input) throw new Error("expected input");
    expect(input.minutesPerDay).toBe(90);
    const result = replanRest(input);
    expect({ missed: result.missed, clashing: result.clashing }).toEqual({ missed: 1, clashing: 1 });
    expect(result.moves.map((m) => [m.id, m.reason, m.to.date, m.to.startMinute])).toEqual([
      // Missed yesterday at 17:00: 18:00 today is free and within 2 hours of 17:00.
      ["t2", "missed", "2026-10-20", 18 * 60],
      // The practice test can't sit under swimming (17:30–18:30); today and tomorrow already hold
      // their 90 minutes, so it stays on Thursday, 16:00–17:30, ending as swimming starts.
      ["t5", "clash", "2026-10-22", 16 * 60],
    ]);
    expect(result.unplaced).toEqual([]);
  });

  test("ways out the person picks feed back in: a later date and longer days", () => {
    const input = replanInput({
      deadline: "2026-10-30",
      tasks: planTasks,
      source,
      now: NOW,
      overrides: { deadline: "2026-11-02", minutesPerDay: 120 },
    });
    expect(input).toMatchObject({ deadline: "2026-11-02", minutesPerDay: 120 });
  });
});

describe("the notice's words", () => {
  test("missed, overlapping or both, in words, with no guilt words", () => {
    expect(replanNotice({ missed: 0, clashing: 0 })).toBeNull();
    expect(replanNotice({ missed: 2, clashing: 0 })).toEqual({ key: "rp.n.missedN", n: 2 });
    expect(replanNotice({ missed: 1, clashing: 0 })).toEqual({ key: "rp.n.missed1", n: 1 });
    expect(replanNotice({ missed: 0, clashing: 3 })).toEqual({ key: "rp.n.clashN", n: 3 });
    expect(replanNotice({ missed: 1, clashing: 1 })).toEqual({ key: "rp.n.mixed", n: 2 });
    expect(pt("en", "rp.n.missedN", { n: 2 })).toBe("2 sessions were missed. Move them to new times?");
  });

  test("every re-plan string in English and Hebrew: present, kind, no em dashes", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("rp."));
    expect(keys.length).toBeGreaterThan(30);
    for (const key of keys) {
      for (const table of [en, he] as Record<string, string>[]) {
        const text = table[key];
        expect(text?.trim()).toBeTruthy();
        expect(text).not.toContain("—");
        expect(text?.toLowerCase()).not.toMatch(/fail|overdue|must|behind|lazy|streak/);
      }
    }
  });

  test("the toast says what moved and what was left out", () => {
    expect(replanToastTitle("en", 2, 0)).toBe("2 sessions have new times.");
    expect(replanToastTitle("en", 1, 1)).toBe("1 session has a new time. 1 session left out.");
    expect(replanToastTitle("en", 0, 3)).toBe("3 sessions left out.");
    expect(replanToastTitle("he", 2, 0)).toBe("ל־2 מפגשים יש זמנים חדשים.");
  });
});

describe("ReplanNotice", () => {
  const render = (lang: "en" | "he" = "en") =>
    renderToStaticMarkup(
      createElement(ReplanNotice, {
        lang,
        notice: { key: "rp.n.missedN", n: 2 },
        open: false,
        onToggle: () => {},
        controls: "rp-preview",
      })
    );

  test("a quiet info notice in words, with one secondary button that opens the preview", () => {
    const html = render();
    expect(html).toContain('data-tone="info"');
    expect(html).not.toMatch(/data-tone="(danger|caution)"/);
    // An <output>: a polite live region, so the words are read when the notice appears.
    expect(html).toContain('<output class="tp-notice__title">');
    expect(html).toContain('<span class="tp-num">2</span> sessions were missed. Move them to new times?');
    expect(html).toMatch(/class="tp-btn tp-btn--secondary tp-btn--sm"[^>]*aria-expanded="false" aria-controls="rp-preview"/);
    expect(html).toContain("Re-plan the rest");
    expect(html).not.toContain("tp-btn--primary");
  });

  test("Hebrew", () => {
    const html = render("he");
    expect(html).toContain("מפגשים התפספסו. להעביר אותם לזמנים חדשים?");
    expect(html).toContain("תכנון מחדש של השאר");
  });
});

describe("ReplanPreview", () => {
  const titles = new Map(planTasks.map((t) => [t._id, t.title]));
  const input = replanInput({ deadline: "2026-10-30", tasks: planTasks, source, now: NOW });
  if (!input) throw new Error("expected input");
  const result = replanRest(input);
  const preview = (over: Partial<Parameters<typeof ReplanPreview>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(ReplanPreview, {
        lang: "en" as const,
        result,
        titles,
        deadline: "2026-10-30",
        leaveOut: false,
        onLeaveOut: () => {},
        onAccept: () => {},
        onCancel: () => {},
        ...over,
      })
    );

  test("what moves where, in words, then Use these times and Cancel", () => {
    const html = preview();
    expect(count(html, 'data-replan="move"')).toBe(2);
    expect(html).toMatch(
      /Learn: Mitosis<\/strong><span>Moves from Mon,? 19 Oct, <span class="tp-num tp-mono tp-ltr">17:00<\/span> to Tue,? 20 Oct, <span class="tp-num tp-mono tp-ltr">18:00<\/span><\/span>/
    );
    expect(html).toContain("Done sessions and fixed events stay where they are.");
    expect(html).toMatch(/class="tp-btn tp-btn--primary" type="button" data-action="replan-accept"/);
    expect(html).toContain("Use these times");
    expect(html).toContain('data-action="replan-cancel"');
    expect(html).not.toContain('data-testid="replan-short"');
    expect(count(html, "tp-btn--primary")).toBe(1);
  });

  test("Accept is secondary when the screen already has its primary", () => {
    const html = preview({ primary: false });
    expect(html).not.toContain("tp-btn--primary");
    expect(html).toMatch(/class="tp-btn tp-btn--secondary" type="button" data-action="replan-accept"/);
  });

  test("what doesn't fit, with the three ways out", () => {
    const tight = replanInput({
      deadline: "2026-10-21",
      tasks: planTasks.filter((t) => t._id !== "t5"),
      source,
      now: { date: "2026-10-20", minute: 21 * 60 + 30 },
    });
    if (!tight) throw new Error("expected input");
    const short = replanRest(tight);
    expect(short.unplaced.map((u) => u.id)).toEqual(["t2"]);
    const ways = replanWaysOut(tight);
    const html = preview({ result: short, deadline: "2026-10-21", ways, onUseDate: () => {}, onUseMinutes: () => {} });
    expect(html).toContain('data-testid="replan-short"');
    expect(html).toMatch(/1 session doesn(&#x27;|')t fit before Wednesday,? 21 October\./);
    expect(html).toContain("For now it stays where it is.");
    expect(html).toContain("Learn: Mitosis");
    for (const way of ["later", "longer", "fewer"]) expect(html).toContain(`data-way="${way}"`);
    // Only today is left before the 21st and it is 21:30: longer days can't help, a later date can.
    expect(ways).toEqual({ longerMinutes: null, laterDate: "2026-10-23" });
    expect(html).toMatch(/Moving the date to Friday,? 23 October would make room\./);
    expect(html).toMatch(/Use Fri,? 23 Oct/);
    expect(html).toMatch(/Longer days wouldn(&#x27;|')t make room before the date\./);
    expect(html).toContain("Leave it out");
    expect(html).toContain('aria-pressed="false"');
    // Nothing moves yet and nothing is left out: Accept waits, and says why.
    expect(html).toMatch(/data-action="replan-accept" disabled=""/);
    expect(html).toMatch(/There(&#x27;|')s nothing to change yet\./);
    expect(html.toLowerCase()).not.toMatch(/fail|overdue|behind/);

    const leaving = preview({ result: short, deadline: "2026-10-21", ways, leaveOut: true });
    expect(leaving).toContain('aria-pressed="true"');
    expect(leaving).toContain("Left out");
    expect(leaving).not.toMatch(/data-action="replan-accept" disabled=""/);
  });

  test("longer days offered as a button; no later date said in words", () => {
    const short = { moves: [], unplaced: [{ id: "t2", reason: "missed" as const, minutes: 45, from: { date: "2026-10-19", startMinute: 1020 } }] };
    const html = preview({ result: short, ways: { longerMinutes: 120, laterDate: null }, onUseMinutes: () => {} });
    expect(html).toMatch(/About <span class="tp-num">120<\/span> minutes a day would make room\./);
    expect(html).toMatch(/<button class="tp-btn tp-btn--secondary tp-btn--sm" type="button"><span>Use <span class="tp-num">120<\/span> minutes a day<\/span><\/button>/);
    expect(html).toContain("No date in the next 6 months makes room at this pace.");
  });

  test("a later date picked here is said in words; errors are kind", () => {
    const html = preview({ newDate: "2026-11-02", failed: true });
    expect(html).toMatch(/The plan(&#x27;|')s date moves to Monday,? 2 November\./);
    expect(html).toMatch(/role="alert">That didn(&#x27;|')t go through\. Your sessions are where they were/);
  });

  test("Hebrew", () => {
    const html = preview({ lang: "he" });
    expect(html).toContain("זמנים חדשים");
    expect(html).toContain("להשתמש בזמנים האלה");
    expect(html).toContain("ביטול");
  });
});
