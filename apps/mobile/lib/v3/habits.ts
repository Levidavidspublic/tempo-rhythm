/**
 * Habits (docs/design/v3/screens/mobile/habits.html): the last 7 days per habit, and when to offer
 * "Welcome back — start fresh?". There is no streak counter anywhere. Pure.
 */
import { addDays, daysBetween, localIsoDate, weekdayOf } from "./dates";

export type HabitDay = { date: string; weekday: number; day: number; done: boolean; today: boolean };

/** The 7 days ending today, oldest first, each marked logged or not. */
export function lastSevenDays(todayIso: string, loggedDates: ReadonlySet<string>): HabitDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayIso, i - 6);
    return {
      date,
      weekday: weekdayOf(date),
      day: Number(date.slice(8, 10)),
      done: loggedDates.has(date),
      today: i === 6,
    };
  });
}

/** Seven or more days without a log, for a habit that is at least seven days old. */
export function needsWelcomeBack(input: {
  todayIso: string;
  createdAt: number;
  lastLoggedIso: string | null;
}): boolean {
  const createdIso = localIsoDate(new Date(input.createdAt));
  if (daysBetween(createdIso, input.todayIso) < 7) return false;
  if (input.lastLoggedIso === null) return true;
  return daysBetween(input.lastLoggedIso, input.todayIso) >= 7;
}

export const WEEKDAY_KEYS = ["dow.sun", "dow.mon", "dow.tue", "dow.wed", "dow.thu", "dow.fri", "dow.sat"] as const;
