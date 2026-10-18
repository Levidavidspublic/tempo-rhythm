/**
 * Turns calendar events and dated tasks into grid items (packages/core/plan/schedule.ts), in the
 * browser's local time. Events are fixed; tasks are flexible and can be moved.
 *
 * EXTRAPOLATED: calendar events carry only a start, so they are drawn one hour long. Anything
 * that starts exactly at local midnight was picked as a date (the add-event form sets midnight),
 * so it goes in the day's "All day" row instead of the hour grid.
 */
import {
  formatLocalDate,
  type LocalDate,
  parseLocalDate,
} from "../../../../packages/core/plan/calendar-math";
import type { ScheduleItem } from "../../../../packages/core/plan/schedule";

export const EVENT_MINUTES = 60;
export const TASK_DEFAULT_MINUTES = 30;

export type GridItem = ScheduleItem & {
  title: string;
  /** Where the item came from, so a move knows what to update. */
  source: "event" | "task";
  /** False for items that can't move (fixed events). */
  movable: boolean;
  done?: boolean;
};

export type AllDayItem = {
  id: string;
  date: LocalDate;
  title: string;
  kind: "fixed" | "flexible";
};

/** Unix ms → local date and clock minute. */
export function msToLocalSlot(ms: number): { date: LocalDate; startMinute: number } {
  const d = new Date(ms);
  return {
    date: formatLocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate()),
    startMinute: d.getHours() * 60 + d.getMinutes(),
  };
}

/** Local date and clock minute → Unix ms. */
export function localSlotToMs(date: LocalDate, startMinute: number): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, 0, startMinute).getTime();
}

/** "YYYY-MM-DD" of a local Date. */
export function localDateOf(d: Date): LocalDate {
  return formatLocalDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export type GridSource = {
  events: ReadonlyArray<{ id: string; title: string; startsAtMs: number }>;
  tasks: ReadonlyArray<{
    _id: string;
    title: string;
    dueAt?: number;
    timeEstimate?: number;
    status: string;
  }>;
};

export function toGridItems({ events, tasks }: GridSource): {
  items: GridItem[];
  allDay: AllDayItem[];
} {
  const items: GridItem[] = [];
  const allDay: AllDayItem[] = [];
  for (const event of events) {
    const slot = msToLocalSlot(event.startsAtMs);
    if (slot.startMinute === 0) {
      allDay.push({ id: event.id, date: slot.date, title: event.title, kind: "fixed" });
      continue;
    }
    items.push({
      id: event.id,
      date: slot.date,
      startMinute: slot.startMinute,
      durationMinutes: EVENT_MINUTES,
      kind: "fixed",
      title: event.title,
      source: "event",
      movable: false,
    });
  }
  for (const task of tasks) {
    if (task.dueAt === undefined || task.status === "cancelled") continue;
    const slot = msToLocalSlot(task.dueAt);
    if (slot.startMinute === 0 && task.timeEstimate === undefined) {
      allDay.push({ id: task._id, date: slot.date, title: task.title, kind: "flexible" });
      continue;
    }
    const minutes =
      task.timeEstimate !== undefined && task.timeEstimate > 0
        ? Math.max(1, Math.round(task.timeEstimate / 60_000))
        : TASK_DEFAULT_MINUTES;
    items.push({
      id: task._id,
      date: slot.date,
      startMinute: slot.startMinute,
      durationMinutes: minutes,
      kind: "flexible",
      title: task.title,
      source: "task",
      movable: true,
      done: task.status === "done",
    });
  }
  return { items, allDay };
}
