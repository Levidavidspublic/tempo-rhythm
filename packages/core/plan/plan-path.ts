/**
 * PlanPath: plan back from a deadline, kitchen T8 (S3).
 *
 * Pure and deterministic: no clock, no randomness. The caller passes `today` and the deadline as
 * local `YYYY-MM-DD` dates. The deadline day itself is never planned (that is the exam).
 *
 * How a plan is built, working backwards from the deadline:
 * 1. The day before the deadline is light review and rest (when it is a study day).
 * 2. The 1–3 study days before that hold one practice test each (3 when there are 12 or more
 *    study days left, 2 from 4, 1 from 2, none below that).
 * 3. Every earlier study day is a learn day. Each topic gets `round(weight)` learn sessions
 *    (at least 1, weight defaults to 1), in topic order, spread evenly over the learn days.
 *    Learn sessions that don't fit a learn day may use what is left of a practice day.
 * 4. Each learn session gets short review sessions 1, 3 and 7 days later when the review lands
 *    on a learn day with room left (before the practice phase). Reviews are a bonus: a review that
 *    doesn't fit is dropped, never counted as missing.
 *
 * A study day is a day from `today` up to the day before the deadline that is not in `daysOff`
 * and has room: `minutesPerDay` minus that day's `busy` minutes. No day ever gets more than that.
 * When learning doesn't fit, `shortBy` is the learn minutes left over, so the UI can offer
 * fewer topics, longer days or a later date.
 *
 * Titles are a neutral English fallback; the UI translates from `kind` and `topic`, which is
 * passed through exactly as given (Hebrew included).
 */

import {
  addDays,
  dateRange,
  daysBetween,
  isLocalDate,
  type LocalDate,
  type Weekday,
  weekday,
} from "./calendar-math";

export type PlanSessionKind = "learn" | "review" | "practice" | "rest";

export type PlanTopic = {
  title: string;
  /** Relative size of the topic; `round(weight)` learn sessions, at least 1. Defaults to 1. */
  weight?: number;
};

export type PlanBackInput = {
  today: LocalDate;
  deadline: LocalDate;
  topics: readonly PlanTopic[];
  /** Most study minutes on any one day. */
  minutesPerDay: number;
  /** Length of one learn session. */
  sessionMinutes: number;
  /** Week days with no study (0 = Sunday … 6 = Saturday). */
  daysOff?: readonly Weekday[];
  /** Minutes already taken on a date (meetings, classes). */
  busy?: Readonly<Record<LocalDate, number>>;
  /** Length of one review session. Defaults to a third of `sessionMinutes`, at least 10. */
  reviewMinutes?: number;
  /** Length of one practice test. Defaults to twice `sessionMinutes`. */
  practiceMinutes?: number;
  /** Length of the light review on the day before. Defaults to 30 or `sessionMinutes`. */
  restMinutes?: number;
  /** "bagrut" when the topics come from a Bagrut-style test block. */
  practiceStyle?: "standard" | "bagrut";
};

export type PlanSession = {
  date: LocalDate;
  kind: PlanSessionKind;
  /** The topic title, untouched. Absent for practice and rest. */
  topic?: string;
  /** Index into `topics`. Absent for practice and rest. */
  topicIndex?: number;
  /** Learn: which session of the topic (1-based). Practice: which test (1-based). */
  part?: number;
  /** Learn: how many learn sessions the topic has. Practice: how many tests there are. */
  parts?: number;
  /** Review: days after the learn session it follows (1, 3 or 7). */
  reviewOffset?: 1 | 3 | 7;
  /** Practice: "bagrut" for a Bagrut-style practice test. */
  style?: "standard" | "bagrut";
  minutes: number;
  /** English fallback title; translate from `kind` + `topic` in the UI. */
  title: string;
};

export type PlanBackResult = {
  sessions: PlanSession[];
  totalMinutes: number;
  /** Distinct dates with at least one session. */
  daysUsed: number;
  /** Learn minutes that didn't fit before the deadline; 0 when everything fits. */
  shortBy: number;
};

export const REVIEW_OFFSETS = [1, 3, 7] as const;

const KIND_ORDER: Record<PlanSessionKind, number> = { review: 0, learn: 1, practice: 2, rest: 3 };

function positive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError(`${name} must be a positive number`);
  return value;
}

/** English fallback titles. */
export function sessionTitle(
  kind: PlanSessionKind,
  topic?: string,
  style: "standard" | "bagrut" = "standard"
): string {
  switch (kind) {
    case "learn":
      return `Learn: ${topic ?? ""}`;
    case "review":
      return `Review: ${topic ?? ""}`;
    case "practice":
      return style === "bagrut" ? "Practice test (Bagrut style)" : "Practice test";
    case "rest":
      return "Light review and rest";
  }
}

/** How many practice days a plan with `studyDays` study days left (after the rest day) holds. */
export function practiceDayCount(studyDays: number): number {
  if (studyDays >= 12) return 3;
  if (studyDays >= 4) return 2;
  if (studyDays >= 2) return 1;
  return 0;
}

export function planBack(input: PlanBackInput): PlanBackResult {
  const { today, deadline, topics } = input;
  if (!isLocalDate(today)) throw new RangeError("today must be a YYYY-MM-DD date");
  if (!isLocalDate(deadline)) throw new RangeError("deadline must be a YYYY-MM-DD date");
  const minutesPerDay = positive("minutesPerDay", input.minutesPerDay);
  const sessionMinutes = positive("sessionMinutes", input.sessionMinutes);
  const reviewMinutes = positive(
    "reviewMinutes",
    input.reviewMinutes ?? Math.max(10, Math.round(sessionMinutes / 3))
  );
  const practiceMinutes = positive("practiceMinutes", input.practiceMinutes ?? sessionMinutes * 2);
  const restMinutes = positive("restMinutes", input.restMinutes ?? Math.min(30, sessionMinutes));
  const style = input.practiceStyle ?? "standard";
  const daysOff = new Set<number>(input.daysOff ?? []);
  for (const day of daysOff) {
    if (!Number.isInteger(day) || day < 0 || day > 6) {
      throw new RangeError("daysOff holds week days from 0 (Sunday) to 6 (Saturday)");
    }
  }

  const units: Array<{ topicIndex: number; part: number; parts: number }> = [];
  topics.forEach((topic, topicIndex) => {
    if (typeof topic.title !== "string" || topic.title.trim() === "") {
      throw new RangeError("every topic needs a title");
    }
    const weight = positive("topic weight", topic.weight ?? 1);
    const parts = Math.max(1, Math.round(weight));
    for (let part = 1; part <= parts; part += 1) units.push({ topicIndex, part, parts });
  });

  const lastDay = daysBetween(today, deadline) >= 1 ? addDays(deadline, -1) : null;
  const room = new Map<LocalDate, number>();
  const studyDays: LocalDate[] = [];
  for (const date of lastDay ? dateRange(today, lastDay) : []) {
    if (daysOff.has(weekday(date))) continue;
    const busyMinutes = input.busy?.[date] ?? 0;
    const free = minutesPerDay - (Number.isFinite(busyMinutes) ? Math.max(0, busyMinutes) : 0);
    if (free > 0) {
      room.set(date, free);
      studyDays.push(date);
    }
  }

  const sessions: PlanSession[] = [];
  const take = (date: LocalDate, minutes: number) => {
    room.set(date, (room.get(date) ?? 0) - minutes);
  };

  // 1. The day before the deadline: light review and rest.
  const pool = [...studyDays];
  if (lastDay !== null && pool.at(-1) === lastDay) {
    pool.pop();
    const minutes = Math.min(restMinutes, room.get(lastDay) ?? 0);
    take(lastDay, minutes);
    sessions.push({ date: lastDay, kind: "rest", minutes, title: sessionTitle("rest") });
  }

  // 2. Practice tests on the study days just before.
  const practiceCount = practiceDayCount(pool.length);
  const practiceDays = pool.slice(pool.length - practiceCount);
  const learnDays = pool.slice(0, pool.length - practiceCount);
  practiceDays.forEach((date, index) => {
    const minutes = Math.min(practiceMinutes, room.get(date) ?? 0);
    take(date, minutes);
    sessions.push({
      date,
      kind: "practice",
      part: index + 1,
      parts: practiceCount,
      style,
      minutes,
      title: sessionTitle("practice", undefined, style),
    });
  });

  // 3. Learn sessions, spread evenly over the learn days.
  const learned: PlanSession[] = [];
  let missingUnits = 0;
  units.forEach((unit, index) => {
    const target = Math.floor((index * learnDays.length) / units.length);
    const order = [...learnDays.slice(target), ...learnDays.slice(0, target), ...practiceDays];
    const date = order.find((day) => (room.get(day) ?? 0) >= sessionMinutes);
    if (date === undefined) {
      missingUnits += 1;
      return;
    }
    take(date, sessionMinutes);
    const topic = topics[unit.topicIndex]!.title;
    const session: PlanSession = {
      date,
      kind: "learn",
      topic,
      topicIndex: unit.topicIndex,
      part: unit.part,
      parts: unit.parts,
      minutes: sessionMinutes,
      title: sessionTitle("learn", topic),
    };
    sessions.push(session);
    learned.push(session);
  });

  // 4. Reviews at +1, +3 and +7 days, only on learn days with room left.
  const learnDaySet = new Set(learnDays);
  const topicDays = new Set(learned.map((s) => `${s.topicIndex}|${s.date}`));
  const learnedInOrder = [...learned].sort(
    (a, b) => daysBetween(b.date, a.date) || a.topicIndex! - b.topicIndex! || a.part! - b.part!
  );
  for (const session of learnedInOrder) {
    for (const offset of REVIEW_OFFSETS) {
      const date = addDays(session.date, offset);
      const key = `${session.topicIndex}|${date}`;
      if (!learnDaySet.has(date) || topicDays.has(key)) continue;
      if ((room.get(date) ?? 0) < reviewMinutes) continue;
      take(date, reviewMinutes);
      topicDays.add(key);
      sessions.push({
        date,
        kind: "review",
        topic: session.topic,
        topicIndex: session.topicIndex,
        reviewOffset: offset,
        minutes: reviewMinutes,
        title: sessionTitle("review", session.topic),
      });
    }
  }

  sessions.sort(
    (a, b) =>
      daysBetween(b.date, a.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.topicIndex ?? -1) - (b.topicIndex ?? -1) ||
      (a.part ?? a.reviewOffset ?? 0) - (b.part ?? b.reviewOffset ?? 0)
  );

  return {
    sessions,
    totalMinutes: sessions.reduce((sum, s) => sum + s.minutes, 0),
    daysUsed: new Set(sessions.map((s) => s.date)).size,
    shortBy: missingUnits * sessionMinutes,
  };
}
