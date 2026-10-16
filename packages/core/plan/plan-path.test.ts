import { describe, expect, test } from "bun:test";
import { addDays, daysBetween, weekday } from "./calendar-math";
import { type PlanBackInput, type PlanSession, planBack, practiceDayCount } from "./plan-path";

const TODAY = "2026-10-16"; // a Friday

function minutesByDate(sessions: readonly PlanSession[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of sessions) totals.set(s.date, (totals.get(s.date) ?? 0) + s.minutes);
  return totals;
}

const BASE: PlanBackInput = {
  today: TODAY,
  deadline: "2026-11-06",
  topics: [{ title: "Cells" }, { title: "Genetics", weight: 2 }, { title: "Ecology" }],
  minutesPerDay: 90,
  sessionMinutes: 45,
};

describe("planBack", () => {
  test("an exam in 3 weeks: rest the day before, practice before that, learning first", () => {
    const plan = planBack(BASE);
    const { sessions } = plan;
    expect(plan.shortBy).toBe(0);

    const rest = sessions.filter((s) => s.kind === "rest");
    expect(rest).toEqual([
      { date: "2026-11-05", kind: "rest", minutes: 30, title: "Light review and rest" },
    ]);

    const practice = sessions.filter((s) => s.kind === "practice");
    expect(practice.map((s) => s.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(practice.every((s) => s.title === "Practice test" && s.minutes === 90)).toBe(true);
    expect(practice.map((s) => s.part)).toEqual([1, 2, 3]);

    const learn = sessions.filter((s) => s.kind === "learn");
    expect(learn.map((s) => [s.date, s.topic, s.part])).toEqual([
      ["2026-10-16", "Cells", 1],
      ["2026-10-20", "Genetics", 1],
      ["2026-10-24", "Genetics", 2],
      ["2026-10-28", "Ecology", 1],
    ]);
    expect(learn[0]!.title).toBe("Learn: Cells");

    // Reviews 1, 3 and 7 days after each learn session, before the practice phase only.
    const reviews = sessions.filter((s) => s.kind === "review");
    const cells = reviews.filter((s) => s.topic === "Cells");
    expect(cells.map((s) => [s.date, s.reviewOffset])).toEqual([
      ["2026-10-17", 1],
      ["2026-10-19", 3],
      ["2026-10-23", 7],
    ]);
    expect(cells[0]!.title).toBe("Review: Cells");
    const ecology = reviews.filter((s) => s.topic === "Ecology").map((s) => s.date);
    expect(ecology).toEqual(["2026-10-29", "2026-10-31"]);
    for (const r of reviews) expect(daysBetween(r.date, "2026-11-02")).toBeGreaterThan(0);

    for (const total of minutesByDate(sessions).values()) expect(total).toBeLessThanOrEqual(90);
    expect(plan.totalMinutes).toBe(sessions.reduce((sum, s) => sum + s.minutes, 0));
    expect(plan.daysUsed).toBe(new Set(sessions.map((s) => s.date)).size);
    expect(sessions.every((s) => daysBetween(s.date, BASE.deadline) > 0)).toBe(true);
  });

  test("sessions come back sorted by date, then review, learn, practice, rest", () => {
    const { sessions } = planBack({
      ...BASE,
      minutesPerDay: 200,
      topics: [{ title: "A", weight: 6 }],
    });
    for (let i = 1; i < sessions.length; i += 1) {
      expect(daysBetween(sessions[i - 1]!.date, sessions[i]!.date)).toBeGreaterThanOrEqual(0);
    }
    const order = { review: 0, learn: 1, practice: 2, rest: 3 };
    for (let i = 1; i < sessions.length; i += 1) {
      const [a, b] = [sessions[i - 1]!, sessions[i]!];
      if (a.date === b.date) expect(order[a.kind]).toBeLessThanOrEqual(order[b.kind]);
    }
  });

  test("deterministic: the same input gives the same plan", () => {
    expect(planBack(BASE)).toEqual(planBack(structuredClone(BASE)));
  });

  test("an exam tomorrow: learning uses what today has left, then light review and rest", () => {
    const plan = planBack({ ...BASE, deadline: addDays(TODAY, 1) });
    expect(plan.sessions.map((s) => [s.kind, s.topic, s.minutes])).toEqual([
      ["learn", "Cells", 45],
      ["rest", undefined, 30],
    ]);
    expect(plan.shortBy).toBe(3 * 45);
    expect(plan.daysUsed).toBe(1);
    expect(plan.totalMinutes).toBe(75);
  });

  test("an exam tomorrow with room for everything is not short", () => {
    const plan = planBack({
      today: TODAY,
      deadline: addDays(TODAY, 1),
      topics: [{ title: "Cells" }],
      minutesPerDay: 180,
      sessionMinutes: 45,
    });
    expect(plan.shortBy).toBe(0);
    expect(plan.sessions.map((s) => [s.date, s.kind])).toEqual([
      [TODAY, "learn"],
      [TODAY, "rest"],
    ]);
    expect(plan.totalMinutes).toBeLessThanOrEqual(180);
  });

  test("a deadline today or earlier plans nothing and says what's missing", () => {
    const plan = planBack({ ...BASE, deadline: TODAY });
    expect(plan.sessions).toEqual([]);
    expect(plan.shortBy).toBe(180);
    expect(planBack({ ...BASE, deadline: addDays(TODAY, -3) }).sessions).toEqual([]);
  });

  test("an exam in 3 days: one practice day, learning squeezed in, shortBy when it can't fit", () => {
    const plan = planBack({ ...BASE, deadline: addDays(TODAY, 3) });
    // Days: 16 learn, 17 practice, 18 rest.
    expect(plan.sessions.find((s) => s.kind === "practice")!.date).toBe("2026-10-17");
    expect(plan.sessions.find((s) => s.kind === "rest")!.date).toBe("2026-10-18");
    const learn = plan.sessions.filter((s) => s.kind === "learn");
    expect(learn.map((s) => s.date)).toEqual(["2026-10-16", "2026-10-16"]);
    expect(plan.shortBy).toBe(2 * 45);
    for (const total of minutesByDate(plan.sessions).values())
      expect(total).toBeLessThanOrEqual(90);
  });

  test("a full calendar: busy days are skipped and shortBy counts the missing minutes", () => {
    const busy: Record<string, number> = {};
    for (let i = 0; i < 21; i += 1) busy[addDays(TODAY, i)] = 90;
    const plan = planBack({ ...BASE, busy });
    expect(plan.sessions).toEqual([]);
    expect(plan.shortBy).toBe(180);
    expect(plan.daysUsed).toBe(0);
  });

  test("partly busy days get only what is left", () => {
    const busy = { "2026-10-16": 60, "2026-10-17": 80 };
    const plan = planBack({ ...BASE, busy });
    const totals = minutesByDate(plan.sessions);
    expect(totals.get("2026-10-16") ?? 0).toBeLessThanOrEqual(30);
    expect(totals.get("2026-10-17") ?? 0).toBeLessThanOrEqual(10);
    expect(plan.sessions.some((s) => s.date === "2026-10-16" && s.kind === "learn")).toBe(false);
    expect(plan.shortBy).toBe(0);
  });

  test("weekends off: nothing on Friday or Saturday, the rest day moves with them", () => {
    const plan = planBack({ ...BASE, deadline: "2026-11-08", daysOff: [5, 6] }); // exam on Sunday
    expect(plan.sessions.length).toBeGreaterThan(0);
    expect(plan.sessions.every((s) => weekday(s.date) !== 5 && weekday(s.date) !== 6)).toBe(true);
    // The day before (Saturday) is off, so there is no rest session; practice ends on Thursday.
    expect(plan.sessions.some((s) => s.kind === "rest")).toBe(false);
    expect(plan.sessions.filter((s) => s.kind === "practice").at(-1)!.date).toBe("2026-11-05");
    expect(plan.shortBy).toBe(0);
  });

  test("Hebrew topic titles pass through untouched", () => {
    const topics = [{ title: "תאים" }, { title: "גנטיקה ותורשה", weight: 2 }];
    const plan = planBack({ ...BASE, topics });
    const learn = plan.sessions.filter((s) => s.kind === "learn");
    expect(learn.map((s) => s.topic)).toEqual(["תאים", "גנטיקה ותורשה", "גנטיקה ותורשה"]);
    expect(learn[0]!.title).toBe("Learn: תאים");
    expect(learn[0]!.topicIndex).toBe(0);
    const review = plan.sessions.find((s) => s.kind === "review" && s.topicIndex === 1)!;
    expect(review.topic).toBe("גנטיקה ותורשה");
  });

  test("weight spreads learning in proportion", () => {
    const plan = planBack({
      ...BASE,
      minutesPerDay: 120,
      topics: [
        { title: "Big", weight: 3 },
        { title: "Small", weight: 0.4 },
      ],
    });
    const learn = plan.sessions.filter((s) => s.kind === "learn");
    expect(learn.filter((s) => s.topic === "Big")).toHaveLength(3);
    expect(learn.filter((s) => s.topic === "Small")).toHaveLength(1);
    expect(learn.filter((s) => s.topic === "Big").map((s) => s.parts)).toEqual([3, 3, 3]);
  });

  test("Bagrut-style practice tests", () => {
    const plan = planBack({ ...BASE, practiceStyle: "bagrut", practiceMinutes: 180 });
    const practice = plan.sessions.filter((s) => s.kind === "practice");
    expect(practice.every((s) => s.style === "bagrut")).toBe(true);
    expect(practice[0]!.title).toBe("Practice test (Bagrut style)");
    expect(practice[0]!.minutes).toBe(90); // never more than minutesPerDay
  });

  test("practice day count by study days left", () => {
    expect([0, 1, 2, 3, 4, 11, 12, 30].map(practiceDayCount)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  test("rejects input it can't plan from", () => {
    expect(() => planBack({ ...BASE, today: "16.10.2026" })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, deadline: "2026-02-30" })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, minutesPerDay: 0 })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, sessionMinutes: Number.NaN })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, topics: [{ title: "  " }] })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, topics: [{ title: "A", weight: -1 }] })).toThrow(RangeError);
    expect(() => planBack({ ...BASE, daysOff: [7 as 0] })).toThrow(RangeError);
  });

  test("no topics: still practice and rest, nothing short", () => {
    const plan = planBack({ ...BASE, topics: [] });
    expect(plan.shortBy).toBe(0);
    expect(plan.sessions.map((s) => s.kind)).toEqual(["practice", "practice", "practice", "rest"]);
  });
});
