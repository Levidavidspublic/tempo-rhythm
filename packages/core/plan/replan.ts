/**
 * Re-plan the rest of a study plan, kitchen F-07 / P2: missed or clashing sessions move to new
 * times, fixed items stay put ("elastic items reflow around fixed ones").
 *
 * Pure and deterministic: no clock, no randomness. The caller passes `now` as a local date and
 * clock minute. Everything here is a local date plus a clock minute, the way the grids place
 * things, so a daylight-saving change never shifts a session: a moved session keeps its local
 * time of day, and the browser turns it into Unix ms for that date (the plan backend's DST rule).
 *
 * Which sessions move: a session still to do whose start is before `now` ("missed") or that now
 * overlaps busy time ("clash"). Done and in-progress sessions stay where they are, and so do the
 * other sessions still to do. Busy time (events and other tasks) never moves.
 *
 * Where they go, one at a time in their old order:
 * 1. The earliest day, from today up to the day before the deadline, that has a free start within
 *    `preferenceSlack` minutes of the session's own clock time; on that day, the free start
 *    nearest to it (the earlier one on a tie).
 * 2. Failing that, the earliest day with any free start; again the one nearest to its own time.
 * A start is free when the session fits inside the day window (which never runs past midnight),
 * starts at or after `now`, overlaps no busy time and no other session of the plan, and keeps the
 * day's plan minutes within `minutesPerDay`. Starts tried: the session's own clock minute and
 * every `stepMinutes` mark.
 *
 * Sessions with no free start before the deadline come back in `unplaced`, so the screen can
 * offer the planner's ways out: a later date or longer days (`replanWaysOut`), or fewer sessions.
 */

import { addDays, isLocalDate, type LocalDate, toDayNumber } from "./calendar-math";

const DAY_MINUTES = 1440;

export type ReplanSessionStatus = "todo" | "doing" | "done";

export type ReplanSession = {
  id: string;
  date: LocalDate;
  /** Local clock minute the session starts, 0–1439. */
  startMinute: number;
  minutes: number;
  /** Only sessions still to do move; done and in-progress ones stay where they are. */
  status: ReplanSessionStatus;
};

/** Busy time from events and other tasks (a grid item fits), never moved. */
export type BusySpan = { date: LocalDate; startMinute: number; durationMinutes: number };

/** A local date and clock minute, 0–1439. */
export type LocalMoment = { date: LocalDate; minute: number };

export type ReplanInput = {
  sessions: readonly ReplanSession[];
  now: LocalMoment;
  /** The exam or deadline day; nothing lands on it or after it. */
  deadline: LocalDate;
  busy: readonly BusySpan[];
  /** Clock minutes a session may use on any day: start ≥ `startMinute`, end ≤ `endMinute` (≤ 1440). */
  window: { startMinute: number; endMinute: number };
  /** Most plan minutes on one day, the sessions that stay included. No cap when absent. */
  minutesPerDay?: number;
  /** Starts tried besides the session's own minute. Default 15. */
  stepMinutes?: number;
  /** How far from its own clock time a session may move before a later day is tried. Default 120. */
  preferenceSlack?: number;
};

export type ReplanReason = "missed" | "clash";

export type ReplanSlot = { date: LocalDate; startMinute: number };

export type ReplanMove = {
  id: string;
  reason: ReplanReason;
  minutes: number;
  from: ReplanSlot;
  to: ReplanSlot;
};

export type ReplanUnplaced = {
  id: string;
  reason: ReplanReason;
  minutes: number;
  from: ReplanSlot;
};

export type ReplanResult = {
  /** In the sessions' old order. */
  moves: ReplanMove[];
  /** Sessions that needed a new time and found none before the deadline, in their old order. */
  unplaced: ReplanUnplaced[];
  /** How many sessions needed a new time, by reason. */
  missed: number;
  clashing: number;
};

export const DEFAULT_REPLAN_STEP = 15;
export const DEFAULT_PREFERENCE_SLACK = 120;

type Interval = readonly [start: number, end: number];

function checkWindow(window: ReplanInput["window"]): void {
  const { startMinute, endMinute } = window;
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > DAY_MINUTES ||
    endMinute <= startMinute
  ) {
    throw new RangeError(
      "the day window runs from a minute in the day to a later one, by midnight"
    );
  }
}

function validSession(session: ReplanSession): boolean {
  return (
    isLocalDate(session.date) &&
    Number.isInteger(session.startMinute) &&
    session.startMinute >= 0 &&
    session.startMinute < DAY_MINUTES &&
    Number.isFinite(session.minutes) &&
    session.minutes > 0
  );
}

function absolute(date: LocalDate, minute: number): number {
  return toDayNumber(date) * DAY_MINUTES + minute;
}

/** Interval lists keyed by day number; an interval is listed on every day it touches. */
class DayIntervals {
  private readonly days = new Map<number, Interval[]>();

  add(start: number, end: number): void {
    if (!(end > start)) return;
    const last = Math.floor((end - 1) / DAY_MINUTES);
    for (let day = Math.floor(start / DAY_MINUTES); day <= last; day += 1) {
      const list = this.days.get(day);
      if (list) list.push([start, end]);
      else this.days.set(day, [[start, end]]);
    }
  }

  overlaps(start: number, end: number): boolean {
    const last = Math.floor((end - 1) / DAY_MINUTES);
    for (let day = Math.floor(start / DAY_MINUTES); day <= last; day += 1) {
      for (const [a, b] of this.days.get(day) ?? []) if (a < end && start < b) return true;
    }
    return false;
  }
}

export function replanRest(input: ReplanInput): ReplanResult {
  const { now, deadline, window } = input;
  if (!isLocalDate(deadline)) throw new RangeError("deadline must be a YYYY-MM-DD date");
  if (!isLocalDate(now.date)) throw new RangeError("now.date must be a YYYY-MM-DD date");
  if (!Number.isFinite(now.minute) || now.minute < 0 || now.minute >= DAY_MINUTES) {
    throw new RangeError("now.minute must be a clock minute, 0 to 1439");
  }
  checkWindow(window);
  const step = input.stepMinutes ?? DEFAULT_REPLAN_STEP;
  if (!Number.isInteger(step) || step <= 0)
    throw new RangeError("stepMinutes must be a positive integer");
  const slack = input.preferenceSlack ?? DEFAULT_PREFERENCE_SLACK;
  if (!Number.isFinite(slack) || slack < 0)
    throw new RangeError("preferenceSlack can't be negative");
  const cap = input.minutesPerDay ?? Number.POSITIVE_INFINITY;
  if (!(cap > 0)) throw new RangeError("minutesPerDay must be a positive number");

  const nowAbs = absolute(now.date, now.minute);
  const busy = new DayIntervals();
  for (const span of input.busy) {
    if (!isLocalDate(span.date) || !Number.isFinite(span.startMinute)) continue;
    if (!Number.isFinite(span.durationMinutes) || span.durationMinutes <= 0) continue;
    const start = absolute(span.date, span.startMinute);
    busy.add(start, start + span.durationMinutes);
  }

  const ordered = input.sessions
    .filter(validSession)
    .map((session) => ({ session, start: absolute(session.date, session.startMinute) }))
    .sort(
      (x, y) =>
        x.start - y.start ||
        (x.session.id < y.session.id ? -1 : x.session.id > y.session.id ? 1 : 0)
    );

  // Sessions that stay take their time and count towards their day; the others look for a slot.
  const taken = new DayIntervals();
  const load = new Map<number, number>();
  const toMove: Array<{ session: ReplanSession; reason: ReplanReason }> = [];
  for (const { session, start } of ordered) {
    const end = start + session.minutes;
    if (session.status === "todo" && start < nowAbs) {
      toMove.push({ session, reason: "missed" });
    } else if (session.status === "todo" && busy.overlaps(start, end)) {
      toMove.push({ session, reason: "clash" });
    } else {
      taken.add(start, end);
      const day = toDayNumber(session.date);
      load.set(day, (load.get(day) ?? 0) + session.minutes);
    }
  }

  const firstDay = toDayNumber(now.date);
  const lastDay = toDayNumber(deadline) - 1;

  const findSlot = (
    session: ReplanSession,
    nearOnly: boolean
  ): { day: number; minute: number } | null => {
    const own = session.startMinute;
    const latest = window.endMinute - session.minutes;
    for (let day = firstDay; day <= lastDay; day += 1) {
      if ((load.get(day) ?? 0) + session.minutes > cap) continue;
      const starts = [own];
      for (let m = Math.ceil(window.startMinute / step) * step; m <= latest; m += step)
        starts.push(m);
      let best: number | null = null;
      for (const minute of starts) {
        if (minute < window.startMinute || minute > latest) continue;
        const distance = Math.abs(minute - own);
        if (nearOnly && distance > slack) continue;
        const start = day * DAY_MINUTES + minute;
        if (start < nowAbs) continue;
        if (best !== null) {
          const bestDistance = Math.abs(best - own);
          if (distance > bestDistance || (distance === bestDistance && minute >= best)) continue;
        }
        if (busy.overlaps(start, start + session.minutes)) continue;
        if (taken.overlaps(start, start + session.minutes)) continue;
        best = minute;
      }
      if (best !== null) return { day, minute: best };
    }
    return null;
  };

  const moves: ReplanMove[] = [];
  const unplaced: ReplanUnplaced[] = [];
  for (const { session, reason } of toMove) {
    const from = { date: session.date, startMinute: session.startMinute };
    const slot = findSlot(session, true) ?? findSlot(session, false);
    if (!slot) {
      unplaced.push({ id: session.id, reason, minutes: session.minutes, from });
      continue;
    }
    const start = slot.day * DAY_MINUTES + slot.minute;
    taken.add(start, start + session.minutes);
    load.set(slot.day, (load.get(slot.day) ?? 0) + session.minutes);
    moves.push({
      id: session.id,
      reason,
      minutes: session.minutes,
      from,
      to: { date: addDays("1970-01-01", slot.day), startMinute: slot.minute },
    });
  }

  return {
    moves,
    unplaced,
    missed: toMove.filter((m) => m.reason === "missed").length,
    clashing: toMove.filter((m) => m.reason === "clash").length,
  };
}

export type ReplanWaysOut = {
  /** The fewest minutes a day (in 15-minute steps) that hold every session, or null. */
  longerMinutes: number | null;
  /** The nearest later deadline that holds every session, or null. */
  laterDate: LocalDate | null;
};

export type ReplanWaysOutLimits = {
  /** Longest day offered. Default 600 (10 hours), like the planner. */
  maxMinutesPerDay?: number;
  /** Furthest later date tried, in days. Default 180, like the planner. */
  maxDays?: number;
};

/**
 * The two ways out the screen can apply for the person when `replanRest` leaves sessions
 * unplaced (the third, fewer sessions, is theirs to choose). Longer days only help when there is
 * a `minutesPerDay` cap. Both are null when everything already fits.
 */
export function replanWaysOut(input: ReplanInput, limits: ReplanWaysOutLimits = {}): ReplanWaysOut {
  const fits = (patch: Partial<ReplanInput>) =>
    replanRest({ ...input, ...patch }).unplaced.length === 0;
  if (fits({})) return { longerMinutes: null, laterDate: null };

  let longerMinutes: number | null = null;
  const cap = input.minutesPerDay;
  if (cap !== undefined) {
    const longest = limits.maxMinutesPerDay ?? 600;
    for (let m = Math.floor(cap / 15) * 15 + 15; m <= longest; m += 15) {
      if (fits({ minutesPerDay: m })) {
        longerMinutes = m;
        break;
      }
    }
  }

  // Each extra day can only add room, so the nearest date is found by halving the range; only a
  // date that was actually tried and fits is offered.
  let laterDate: LocalDate | null = null;
  let low = 1;
  let high = limits.maxDays ?? 180;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const deadline = addDays(input.deadline, mid);
    if (fits({ deadline })) {
      laterDate = deadline;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return { longerMinutes, laterDate };
}
