/** Start/end of the local calendar day as Unix ms; `endMs` is exclusive. */
export function getLocalDayBoundsMs(d = new Date()): { startMs: number; endMs: number } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // The next calendar midnight, not start + 24h: a daylight-saving day is 23 or 25 hours long.
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return { startMs: start, endMs: end };
}

/**
 * Milliseconds from `now` until the moment a `useLocalDayBounds` recompute
 * should run. Always strictly positive (minimum 50ms) so the timer fires after
 * the new local day has actually begun, never before.
 *
 * Pure / dependency-free for unit testing.
 */
export function nextLocalDayRolloverDelayMs(now: number): number {
  const { endMs } = getLocalDayBoundsMs(new Date(now));
  return Math.max(50, endMs - now + 50);
}
