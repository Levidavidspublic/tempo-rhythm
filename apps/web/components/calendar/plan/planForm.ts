/**
 * The pure side of "Plan back from a deadline" (S3): reading the form, the live preview from
 * `planBack`, grouping by week and the three ways out when the plan doesn't fit.
 */
import {
  addDays,
  isLocalDate,
  type LocalDate,
  startOfWeek,
  toDayNumber,
  type Weekday,
} from "../../../../../packages/core/plan/calendar-math";
import {
  type PlanBackResult,
  type PlanSession,
  type PlanTopic,
  planBack,
} from "../../../../../packages/core/plan/plan-path";
import { type GridSource, toGridItems } from "../gridData";
import { type PlanLang, parseClock, pt } from "../planCopy";

/** Minutes in a day: a day's study has to end by midnight. */
const DAY_MINUTES = 1440;

/** Minutes already taken on each local date, keyed `YYYY-MM-DD`. */
export type BusyMinutes = Readonly<Record<LocalDate, number>>;

/**
 * Busy minutes per date from the person's fixed calendar events and dated tasks, the way the
 * grids draw them (events an hour, tasks their estimate). All-day items and done or cancelled
 * tasks take no time.
 */
export function busyByDate(source: GridSource): BusyMinutes {
  const busy: Record<LocalDate, number> = {};
  for (const item of toGridItems(source).items) {
    if (item.done) continue;
    busy[item.date] = (busy[item.date] ?? 0) + Math.max(0, item.durationMinutes);
  }
  return busy;
}

export type PlanFormValues = {
  title: string;
  deadline: string;
  topicsText: string;
  minutesPerDay: number;
  sessionMinutes: number;
  /** "HH:MM", when the first session of a day starts. */
  startTime: string;
  daysOff: Weekday[];
};

export const DEFAULT_FORM: PlanFormValues = {
  title: "",
  deadline: "",
  topicsText: "",
  minutesPerDay: 90,
  sessionMinutes: 45,
  startTime: "17:00",
  daysOff: [],
};

/** One topic per line; "Geometry | 2" gives a topic twice the time. Blank lines are skipped. */
export function parseTopics(text: string): PlanTopic[] {
  const topics: PlanTopic[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const match = /^(.*?)\s*\|\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
    if (match?.[1] && match[1].trim() !== "") {
      const weight = Number(match[2]);
      topics.push(weight > 0 ? { title: match[1].trim(), weight } : { title: match[1].trim() });
    } else {
      topics.push({ title: line });
    }
  }
  return topics;
}

export type TimedSession = PlanSession & { startMinute: number; label: string };

export type PreviewState =
  | { status: "empty" }
  | { status: "error"; message: "pp.err.date" | "pp.err.number" | "pp.err.late" }
  | { status: "ok"; result: PlanBackResult; sessions: TimedSession[] };

/** The session title in the person's language, from its kind and topic. */
export function sessionLabel(lang: PlanLang, session: PlanSession): string {
  switch (session.kind) {
    case "learn":
      return pt(lang, "pp.s.learn", { topic: session.topic ?? "" });
    case "review":
      return pt(lang, "pp.s.review", { topic: session.topic ?? "" });
    case "practice":
      return pt(lang, session.style === "bagrut" ? "pp.s.practiceBagrut" : "pp.s.practice");
    case "rest":
      return pt(lang, "pp.s.rest");
  }
}

/** Sessions on a day follow each other from the start time, in plan order. */
export function stackSessions(
  sessions: readonly PlanSession[],
  startMinute: number,
  lang: PlanLang
): TimedSession[] {
  const next = new Map<LocalDate, number>();
  return sessions.map((session) => {
    const at = next.get(session.date) ?? startMinute;
    next.set(session.date, at + session.minutes);
    return {
      ...session,
      startMinute: Math.min(at, 1439),
      label: sessionLabel(lang, session),
    };
  });
}

function planInput(
  values: PlanFormValues,
  today: LocalDate,
  overrides: Partial<PlanFormValues> = {},
  busy?: BusyMinutes
) {
  const v = { ...values, ...overrides };
  return {
    today,
    deadline: v.deadline,
    topics: parseTopics(v.topicsText),
    minutesPerDay: v.minutesPerDay,
    sessionMinutes: v.sessionMinutes,
    daysOff: v.daysOff,
    ...(busy ? { busy } : {}),
  };
}

function startMinuteOf(values: PlanFormValues): number {
  return parseClock(values.startTime) ?? parseClock(DEFAULT_FORM.startTime) ?? 0;
}

export function buildPreview(
  values: PlanFormValues,
  today: LocalDate,
  lang: PlanLang,
  busy?: BusyMinutes
): PreviewState {
  const topics = parseTopics(values.topicsText);
  if (!isLocalDate(values.deadline) || topics.length === 0) return { status: "empty" };
  if (toDayNumber(values.deadline) <= toDayNumber(today))
    return { status: "error", message: "pp.err.date" };
  if (
    !(Number.isFinite(values.minutesPerDay) && values.minutesPerDay > 0) ||
    !(Number.isFinite(values.sessionMinutes) && values.sessionMinutes > 0)
  ) {
    return { status: "error", message: "pp.err.number" };
  }
  const start = startMinuteOf(values);
  // A day's sessions follow each other from the start time, so they have to end by midnight.
  if (start + values.minutesPerDay > DAY_MINUTES)
    return { status: "error", message: "pp.err.late" };
  const result = planBack(planInput(values, today, {}, busy));
  return { status: "ok", result, sessions: stackSessions(result.sessions, start, lang) };
}

export type WeekGroup = {
  weekStart: LocalDate;
  days: Array<{ date: LocalDate; sessions: TimedSession[] }>;
};

/** Sessions grouped by week, then by day, in date order. */
export function groupByWeek(sessions: readonly TimedSession[], weekStartsOn: Weekday): WeekGroup[] {
  const weeks: WeekGroup[] = [];
  const sorted = [...sessions].sort(
    (a, b) => toDayNumber(a.date) - toDayNumber(b.date) || a.startMinute - b.startMinute
  );
  for (const session of sorted) {
    const weekStart = startOfWeek(session.date, { weekStartsOn });
    let week = weeks.at(-1);
    if (!week || week.weekStart !== weekStart) {
      week = { weekStart, days: [] };
      weeks.push(week);
    }
    let day = week.days.at(-1);
    if (!day || day.date !== session.date) {
      day = { date: session.date, sessions: [] };
      week.days.push(day);
    }
    day.sessions.push(session);
  }
  return weeks;
}

export type WaysOut = {
  /** Minutes a day that would hold the plan, or null when no day length up to 10 hours does. */
  longerMinutes: number | null;
  /** The nearest later date that would hold it, or null within the next 180 days. */
  laterDate: LocalDate | null;
};

/** The two ways out the form can apply for you (the third, fewer topics, is yours to choose). */
export function waysOut(values: PlanFormValues, today: LocalDate, busy?: BusyMinutes): WaysOut {
  let longerMinutes: number | null = null;
  // Never offer a day that would run past midnight from the start time.
  const longest = Math.min(600, DAY_MINUTES - startMinuteOf(values));
  for (let m = Math.ceil(values.minutesPerDay / 15) * 15 + 15; m <= longest; m += 15) {
    if (planBack(planInput(values, today, { minutesPerDay: m }, busy)).shortBy === 0) {
      longerMinutes = m;
      break;
    }
  }
  let laterDate: LocalDate | null = null;
  if (isLocalDate(values.deadline)) {
    for (let d = 1; d <= 180; d += 1) {
      const deadline = addDays(values.deadline, d);
      if (planBack(planInput(values, today, { deadline }, busy)).shortBy === 0) {
        laterDate = deadline;
        break;
      }
    }
  }
  return { longerMinutes, laterDate };
}

/** Whole hours and the minutes left over, for "3 h 45 min". */
export function hoursAndMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
