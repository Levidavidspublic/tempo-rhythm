/**
 * Review finding (re-plan, MEDIUM): the planner put today's sessions at the form's start time
 * whatever the clock said, so a plan made at 20:00 with the default 17:00 start showed "2 sessions
 * were missed" moments after "Add these sessions". Today's sessions now start no earlier than now,
 * rounded up to the quarter hour, and today gets none once its study window has gone by.
 */
import { describe, expect, test } from "bun:test";
import { localSlotToMs } from "../../../apps/web/components/calendar/gridData";
import {
  buildPreview,
  DEFAULT_FORM,
  firstStartToday,
  type PlanFormValues,
  waysOut,
} from "../../../apps/web/components/calendar/plan/planForm";
import { replanInput, replanNotice } from "../../../apps/web/components/calendar/plan/replanForm";
import { replanRest } from "../../../packages/core/plan/replan";

const TODAY = "2026-10-16"; // a Friday
const clock = (text: string) => {
  const [h, m] = text.split(":").map(Number);
  return h! * 60 + m!;
};

// Default form: 90 minutes a day from 17:00, 45-minute sessions.
const form = (over: Partial<PlanFormValues> = {}): PlanFormValues => ({
  ...DEFAULT_FORM,
  title: "Maths exam",
  deadline: "2026-11-06",
  topicsText: "Algebra\nGeometry | 2\nProbability",
  ...over,
});

const sessionsOn = (state: ReturnType<typeof buildPreview>, date: string) =>
  state.status === "ok" ? state.sessions.filter((s) => s.date === date) : [];

describe("today's sessions and the clock", () => {
  test("now rounds up to the next quarter hour", () => {
    expect([clock("17:00"), clock("17:01"), clock("17:14"), clock("17:15"), clock("23:59")].map(firstStartToday)).toEqual([
      clock("17:00"),
      clock("17:15"),
      clock("17:15"),
      clock("17:15"),
      1440,
    ]);
  });

  test("at 20:00, with the day's 17:00 to 18:30 gone, nothing is planned for today", () => {
    const state = buildPreview(form(), TODAY, "en", undefined, clock("20:00"));
    if (state.status !== "ok") throw new Error("expected a plan");
    expect(sessionsOn(state, TODAY)).toEqual([]);
    expect(state.sessions[0]).toMatchObject({ date: "2026-10-17", startMinute: clock("17:00") });
    for (const session of state.sessions) {
      if (session.date === TODAY) expect(session.startMinute).toBeGreaterThanOrEqual(clock("20:00"));
    }
  });

  test("part way through the window, today starts at the next quarter hour with what's left", () => {
    const state = buildPreview(form(), TODAY, "en", undefined, clock("17:20"));
    const today = sessionsOn(state, TODAY);
    expect(today.map((s) => s.startMinute)).toEqual([clock("17:30")]);
    // 17:30 to 18:30 is what is left of the window; the day still ends when it would have.
    const end = Math.max(...today.map((s) => s.startMinute + s.minutes));
    expect(end).toBeLessThanOrEqual(clock("18:30"));
  });

  test("before the window opens, today is planned from the start time as before", () => {
    const early = buildPreview(form(), TODAY, "en", undefined, clock("09:10"));
    const noClock = buildPreview(form(), TODAY, "en");
    expect(early).toEqual(noClock);
    expect(sessionsOn(early, TODAY)[0]?.startMinute).toBe(clock("17:00"));
  });

  test("a plan made at 20:00 shows nothing missed straight after it is added", () => {
    const state = buildPreview(form(), TODAY, "en", undefined, clock("20:00"));
    if (state.status !== "ok") throw new Error("expected a plan");
    // What plans.createFromPreview saves: one task per session at its local start.
    const tasks = state.sessions.map((s, i) => ({
      _id: `tasks:${i}`,
      title: s.label,
      status: "todo" as const,
      dueAt: localSlotToMs(s.date, s.startMinute),
      timeEstimate: s.minutes * 60_000,
    }));
    const input = replanInput({
      deadline: "2026-11-06",
      tasks,
      source: { events: [], tasks: [] },
      now: { date: TODAY, minute: clock("20:01") },
    });
    if (!input) throw new Error("expected input");
    expect(replanNotice(replanRest(input))).toBeNull();
  });

  test("the ways out count from now too: the exam is tomorrow and today's window has gone", () => {
    const tight = form({ deadline: "2026-10-17", topicsText: "Algebra" });
    const state = buildPreview(tight, TODAY, "en", undefined, clock("21:00"));
    if (state.status !== "ok") throw new Error("expected a plan");
    expect(state.result.shortBy).toBe(45);
    // Longer days only count what is left after now: the rest and the lesson need 75 minutes from
    // 21:00, so the day has to run from 17:00 to 22:15 (315 minutes). Without the clock, 90 would do.
    expect(waysOut(tight, TODAY, undefined, clock("21:00"))).toEqual({
      longerMinutes: 315,
      laterDate: "2026-10-18",
    });
    const longer = buildPreview({ ...tight, minutesPerDay: 315 }, TODAY, "en", undefined, clock("21:00"));
    expect(sessionsOn(longer, TODAY).map((s) => s.startMinute)).toEqual([clock("21:00"), clock("21:45")]);
    // At 17:00 there is still time today.
    expect(buildPreview(tight, TODAY, "en", undefined, clock("17:00"))).toMatchObject({ result: { shortBy: 0 } });
  });
});
