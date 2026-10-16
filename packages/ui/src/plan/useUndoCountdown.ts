import { useEffect, useState } from "react";

/**
 * The 5-minute Undo countdown (HARD_RULES §1), the same `m:ss` the app's `useCountdown` and
 * `UndoToast` show. That hook lives in apps/web, so the card carries its own small copy here.
 */

/** Milliseconds left → "4:59". Never below "0:00". */
export function formatUndoLeft(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `m:ss` until `untilMs`, ticking each second; null when there is no deadline or it has passed. */
export function useUndoCountdown(untilMs: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  const live = untilMs !== undefined && now < untilMs;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);
  if (!live || untilMs === undefined) return null;
  return formatUndoLeft(untilMs - now);
}
