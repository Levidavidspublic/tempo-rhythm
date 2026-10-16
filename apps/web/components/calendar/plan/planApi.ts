"use client";

// A namespace import: test files swap convex/react module mocks, and a named import of a hook that
// another file's mock lacks would stop this module from linking.
import * as convexReact from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { BusyWindows } from "./busyWindows";

/**
 * The plan screen's reads of the person's calendar, as hooks in one place, so tests can replace
 * this one module instead of convex/react.
 */

/**
 * Events and dated tasks over `span` (busyWindows.ts): one `calendar_events.listInRange` per
 * window, never more than 31 days each, and one `tasks.listDueInRange` over the whole range.
 * `events` stays undefined until every window has answered. There are exactly MAX_BUSY_WINDOWS
 * (6) event queries; the ones past the span's windows are skipped.
 */
export function useBusyTime(span: BusyWindows | null) {
  const w = span?.windows ?? [];
  const e0 = convexReact.useQuery(api.calendar_events.listInRange, w[0] ?? "skip");
  const e1 = convexReact.useQuery(api.calendar_events.listInRange, w[1] ?? "skip");
  const e2 = convexReact.useQuery(api.calendar_events.listInRange, w[2] ?? "skip");
  const e3 = convexReact.useQuery(api.calendar_events.listInRange, w[3] ?? "skip");
  const e4 = convexReact.useQuery(api.calendar_events.listInRange, w[4] ?? "skip");
  const e5 = convexReact.useQuery(api.calendar_events.listInRange, w[5] ?? "skip");
  const tasks = convexReact.useQuery(api.tasks.listDueInRange, span ? span.range : "skip");
  const count = w.length;
  const events = useMemo(() => {
    const parts = [e0, e1, e2, e3, e4, e5].slice(0, count);
    if (count === 0 || parts.some((part) => part === undefined)) return undefined;
    return parts.flatMap((part) => part ?? []);
  }, [count, e0, e1, e2, e3, e4, e5]);
  return { events, tasks };
}
