import { useRef } from "react";

/**
 * The value to show while a query reloads: the new result once it is in, else the last one
 * that loaded. `active` false (signed out, query skipped) forgets it.
 */
export function lastLoaded<T>(
  previous: T | undefined,
  next: T | undefined,
  active: boolean
): T | undefined {
  if (!active) return undefined;
  return next !== undefined ? next : previous;
}

/**
 * Keeps a `useQuery` result on screen while its arguments change (the next month loading), so a
 * grid isn't swapped for a skeleton and keyboard focus stays on the day. Undefined only until
 * the first result arrives.
 */
export function useLastLoaded<T>(value: T | undefined, active = true): T | undefined {
  const last = useRef<T | undefined>(undefined);
  last.current = lastLoaded(last.current, value, active);
  return last.current;
}
