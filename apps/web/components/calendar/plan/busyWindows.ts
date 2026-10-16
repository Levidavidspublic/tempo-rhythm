/**
 * The plan screen's busy time comes from `calendar_events.listInRange`, which refuses a range over
 * 32 days (convex/calendar_events.ts), and a refused query takes the whole screen to the error
 * page. A plan, or a later date picked for it, can run for months, so events are asked for in
 * windows of whole local days: at most 31 days each, so a window that holds a 25-hour
 * daylight-saving day still stays under 32 × 24 hours, and at most `MAX_BUSY_WINDOWS` of them
 * (186 days). Events after that aren't checked yet, and the screen says so (`checkedUntil`).
 * `tasks.listDueInRange` has no such limit, so tasks are read over the whole range in one go.
 *
 * Pure: local dates in, Unix ms for local midnights out (in this browser's time zone).
 */
import {
  addDays,
  isLocalDate,
  type LocalDate,
  toDayNumber,
} from "../../../../../packages/core/plan/calendar-math";
import { localSlotToMs } from "../gridData";

/** Local days in one events window. */
export const BUSY_WINDOW_DAYS = 31;
/** Most events windows read at once; `useBusyTime` (planApi.ts) has one query per window. */
export const MAX_BUSY_WINDOWS = 6;

export type MsRange = { startMs: number; endMs: number };

export type BusyWindows = {
  /** The whole range: local midnight of `from` to local midnight of `to` (not included). */
  range: MsRange;
  /** Events windows in order, back to back, each at most 31 local days. */
  windows: MsRange[];
  /** When the windows stop before `to`: the last day whose events are read. Otherwise null. */
  checkedUntil: LocalDate | null;
};

/** Busy-time windows from `from` up to the day before `to`; null when that range is empty. */
export function busyWindows(from: LocalDate, to: LocalDate): BusyWindows | null {
  if (!isLocalDate(from) || !isLocalDate(to)) return null;
  const last = toDayNumber(to);
  if (last <= toDayNumber(from)) return null;
  const windows: MsRange[] = [];
  let start = from;
  while (toDayNumber(start) < last && windows.length < MAX_BUSY_WINDOWS) {
    const end =
      last - toDayNumber(start) > BUSY_WINDOW_DAYS ? addDays(start, BUSY_WINDOW_DAYS) : to;
    windows.push({ startMs: localSlotToMs(start, 0), endMs: localSlotToMs(end, 0) });
    start = end;
  }
  return {
    range: { startMs: localSlotToMs(from, 0), endMs: localSlotToMs(to, 0) },
    windows,
    checkedUntil: toDayNumber(start) < last ? addDays(start, -1) : null,
  };
}
