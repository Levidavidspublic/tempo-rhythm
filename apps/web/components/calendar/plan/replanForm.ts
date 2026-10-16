/**
 * The pure side of "Re-plan the rest" (PRD F-07) on the plan screen: a saved plan's tasks and the
 * person's calendar become `replanRest` input (packages/core/plan/replan.ts), and its result
 * becomes the notice's words and the toast's. No clock here: the screen passes now.
 *
 * EXTRAPOLATED (no doc sets these): the day window is the grids' 07:00–22:00, widened to hold the
 * plan's own session times and never past midnight; the most plan minutes on one day is the
 * plan's own busiest day, so a re-plan never makes a day heavier than the plan already had.
 */
import {
  isLocalDate,
  type LocalDate,
  toDayNumber,
} from "../../../../../packages/core/plan/calendar-math";
import type {
  BusySpan,
  LocalMoment,
  ReplanInput,
  ReplanResult,
  ReplanSession,
} from "../../../../../packages/core/plan/replan";
import { gridRange } from "../../../../../packages/core/plan/schedule";
import { type GridSource, msToLocalSlot, TASK_DEFAULT_MINUTES, toGridItems } from "../gridData";
import { countKey, type PlanKey, type PlanLang, pt } from "../planCopy";

const DAY_MINUTES = 1440;

/** A plan task as `plans.get` returns it. */
export type PlanTask = {
  _id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  dueAt?: number;
  timeEstimate?: number;
};

/** A task's length in minutes, the way the grids draw it. */
function taskMinutes(task: Pick<PlanTask, "timeEstimate">): number {
  return task.timeEstimate !== undefined && task.timeEstimate > 0
    ? Math.max(1, Math.round(task.timeEstimate / 60_000))
    : TASK_DEFAULT_MINUTES;
}

/**
 * The plan's tasks as re-plan sessions, in the browser's local time. Cancelled tasks and tasks
 * without a time are not part of it; a task in progress stays where it is, like a done one.
 */
export function planSessions(tasks: readonly PlanTask[]): ReplanSession[] {
  const out: ReplanSession[] = [];
  for (const task of tasks) {
    if (task.dueAt === undefined || task.status === "cancelled") continue;
    const slot = msToLocalSlot(task.dueAt);
    out.push({
      id: task._id,
      date: slot.date,
      startMinute: slot.startMinute,
      minutes: taskMinutes(task),
      status: task.status === "done" ? "done" : task.status === "in_progress" ? "doing" : "todo",
    });
  }
  return out;
}

/** The grids' visible day, widened to hold every session of the plan, never past midnight. */
export function replanWindow(sessions: readonly ReplanSession[]): ReplanInput["window"] {
  const grid = gridRange();
  let startMinute = grid.dayStartMinute;
  let endMinute = grid.dayEndMinute;
  for (const session of sessions) {
    startMinute = Math.min(startMinute, session.startMinute);
    endMinute = Math.max(endMinute, session.startMinute + session.minutes);
  }
  return { startMinute, endMinute: Math.min(DAY_MINUTES, endMinute) };
}

/** The plan's busiest day, in plan minutes; undefined for a plan with no sessions. */
export function planDayCap(sessions: readonly ReplanSession[]): number | undefined {
  const byDay = new Map<string, number>();
  for (const session of sessions) {
    byDay.set(session.date, (byDay.get(session.date) ?? 0) + session.minutes);
  }
  return byDay.size > 0 ? Math.max(...byDay.values()) : undefined;
}

/**
 * Busy time for a re-plan: the person's events and their other dated tasks, drawn as the grids
 * draw them (an event is an hour, a task its estimate). This plan's own sessions, done tasks and
 * all-day items are not busy time.
 */
export function replanBusy(source: GridSource, planTaskIds: ReadonlySet<string>): BusySpan[] {
  return toGridItems(source)
    .items.filter((item) => !item.done && !planTaskIds.has(item.id))
    .map((item) => ({
      date: item.date,
      startMinute: item.startMinute,
      durationMinutes: item.durationMinutes,
    }));
}

/** The ways out the person picked in the preview. */
export type ReplanOverrides = { minutesPerDay?: number; deadline?: LocalDate };

/**
 * `replanRest` input for a saved plan, or null when nothing can move: the deadline is today or
 * has passed (the exam is the deadline day itself), or its date is unreadable.
 */
export function replanInput({
  deadline,
  tasks,
  source,
  now,
  overrides = {},
}: {
  deadline: string;
  tasks: readonly PlanTask[];
  source: GridSource;
  now: LocalMoment;
  overrides?: ReplanOverrides;
}): ReplanInput | null {
  if (!isLocalDate(deadline) || toDayNumber(deadline) <= toDayNumber(now.date)) return null;
  const sessions = planSessions(tasks);
  const cap = overrides.minutesPerDay ?? planDayCap(sessions);
  return {
    sessions,
    now,
    deadline: overrides.deadline ?? deadline,
    busy: replanBusy(source, new Set(tasks.map((task) => task._id))),
    window: replanWindow(sessions),
    ...(cap !== undefined ? { minutesPerDay: cap } : {}),
  };
}

/** The notice's words: what needs a new time and why, or null when nothing does. */
export function replanNotice(
  result: Pick<ReplanResult, "missed" | "clashing">
): { key: PlanKey; n: number } | null {
  const { missed, clashing } = result;
  if (missed > 0 && clashing > 0) return { key: "rp.n.mixed", n: missed + clashing };
  if (missed > 0) return { key: countKey(missed, "rp.n.missed1", "rp.n.missedN"), n: missed };
  if (clashing > 0) return { key: countKey(clashing, "rp.n.clash1", "rp.n.clashN"), n: clashing };
  return null;
}

/** The Undo toast's title: how many sessions moved and how many were left out. */
export function replanToastTitle(lang: PlanLang, moved: number, removed: number): string {
  const parts: string[] = [];
  if (moved > 0) parts.push(pt(lang, countKey(moved, "rp.toast1", "rp.toastN"), { n: moved }));
  if (removed > 0) {
    parts.push(pt(lang, countKey(removed, "rp.toastOut1", "rp.toastOutN"), { n: removed }));
  }
  return parts.join(" ");
}
