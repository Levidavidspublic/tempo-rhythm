/**
 * The 5-minute Undo window every accepted change gets (DESIGN.md §13). Pure helpers for the toast.
 */
import { formatCountdown } from "./tasks";

export const UNDO_MS = 5 * 60_000;

/** Milliseconds left to undo a change made at `startedAt`, never below zero. */
export function undoLeftMs(startedAt: number, now: number, windowMs: number = UNDO_MS): number {
  return Math.max(0, startedAt + windowMs - now);
}

/** "4:59" while Undo is still possible, or null once the window has closed. */
export function undoCountdown(startedAt: number, now: number, windowMs: number = UNDO_MS): string | null {
  const left = undoLeftMs(startedAt, now, windowMs);
  return left > 0 ? formatCountdown(left) : null;
}
