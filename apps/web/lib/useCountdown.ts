"use client";

import { useEffect, useState } from "react";

/** m:ss until `untilMs`, counting down each second while it lasts; null once it has passed. */
export function useCountdown(untilMs: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  const live = untilMs !== undefined && now < untilMs;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);
  if (!live || untilMs === undefined) return null;
  const s = Math.ceil((untilMs - now) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
