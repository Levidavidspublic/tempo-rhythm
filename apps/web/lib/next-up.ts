/**
 * Next up on Today (docs/design/v3/screens/web/today.html): ONE open task with a short reason.
 * Pure: the card keeps "Not now" and the timer in local state.
 */
import type { MessageKey } from "@/lib/i18n";

export type NextUpTask = {
  _id: string;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
  energy?: "low" | "medium" | "high";
  timeEstimate?: number;
  dueAt?: number;
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** The task to show, or null. Started first, then important, then the earliest due; skipped ones last. */
export function pickNextUp<T extends NextUpTask>(tasks: readonly T[], skipped: ReadonlySet<string>): T | null {
  const open = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  if (open.length === 0) return null;
  const rank = (task: T) => [
    skipped.has(task._id) ? 1 : 0,
    task.status === "in_progress" ? 0 : 1,
    PRIORITY_RANK[task.priority],
    task.dueAt ?? Number.MAX_SAFE_INTEGER,
  ];
  const sorted = [...open].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i += 1) if (ra[i] !== rb[i]) return (ra[i] as number) - (rb[i] as number);
    return 0;
  });
  return sorted[0] ?? null;
}

/** The short reason line under the title. */
export function nextUpReason(task: NextUpTask): MessageKey {
  if (task.status === "in_progress") return "next.why.started";
  if (task.priority === "high") return "next.why.high";
  return "next.why.due";
}

/** Minutes for the focus timer: the task's estimate when it has a sensible one, else 25. */
export function focusMinutes(task: NextUpTask): number {
  const estimate = task.timeEstimate;
  if (typeof estimate !== "number" || !Number.isFinite(estimate) || estimate <= 0) return 25;
  return Math.min(Math.max(Math.round(estimate), 5), 90);
}

/** "mm:ss" for a countdown. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
