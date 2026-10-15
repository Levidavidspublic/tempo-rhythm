"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Circle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toLocalDateKey } from "@/components/day-plan-panel/dayPlanDraft";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { cn } from "@/lib/utils";
import { pickNextBlocks, planProgress } from "./nextBlocks";

const SAVE_ERROR = "That didn't save. Try again when you want.";
const ENERGY_LABEL = { low: "Low energy", medium: "Medium energy", high: "High energy" } as const;

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function formatMinute(minute: number): string {
  const wrapped = ((minute % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = String(wrapped % 60).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${mins} ${suffix}`;
}

export function DayPlanSummary() {
  const bounds = useLocalDayBounds();
  const localDate = useMemo(() => toLocalDateKey(new Date(bounds.startMs)), [bounds.startMs]);
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const ready = isAuthenticated && profile != null;

  const plan = useQuery(api.dayPlans.getForDate, ready ? { localDate } : "skip");
  const blocks = useQuery(api.timeBlocks.listForDate, ready ? { localDate } : "skip");
  const tasks = useQuery(
    api.tasks.listToday,
    ready ? { dueFrom: bounds.startMs, dueTo: bounds.endMs } : "skip"
  );
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const setStatus = useMutation(api.timeBlocks.setStatus);

  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState(false);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const topTasks = useMemo(() => {
    const byId = new Map((tasks ?? []).map((task) => [task._id as string, task]));
    return (plan?.topTaskIds ?? []).flatMap((id) => {
      const task = byId.get(id);
      return task ? [task] : [];
    });
  }, [plan, tasks]);

  // Nothing until the plan is committed (and while loading, signed out, or no plan).
  if (!ready || !plan || plan.status !== "committed") {
    return null;
  }

  const progress = planProgress(topTasks);
  const upNext = pickNextBlocks(blocks ?? [], minuteOfDay(now));

  const run = async (action: () => Promise<unknown>) => {
    setError(false);
    try {
      await action();
    } catch {
      setError(true);
    }
  };

  return (
    <section
      className="rounded-3xl border border-border/80 bg-card/90 p-6 shadow-[0_10px_30px_rgba(26,25,23,0.08)]"
      aria-labelledby="day-plan-summary-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id="day-plan-summary-heading"
            className="font-heading text-2xl font-semibold text-foreground"
          >
            Your day
          </h2>
          {plan.intention ? (
            <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-base italic text-foreground">
              {plan.intention}
            </blockquote>
          ) : null}
        </div>
        {plan.energy ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {ENERGY_LABEL[plan.energy]}
          </span>
        ) : null}
      </div>

      {topTasks.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">
            {progress.done} of {progress.total} done
          </p>
          <ul className="mt-2 space-y-2">
            {topTasks.map((task) => {
              const isDone = task.status === "done";
              return (
                <li key={task._id} className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-pressed={isDone}
                    aria-label={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} done`}
                    onClick={() => void run(() => toggleCompletion({ taskId: task._id as Id<"tasks"> }))}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <Circle className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <span
                    className={cn(
                      "font-medium text-foreground",
                      isDone && "text-muted-foreground line-through"
                    )}
                  >
                    {task.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Up next
        </h3>
        {blocks === undefined ? (
          <div aria-busy="true" className="mt-2 h-12 animate-pulse rounded-2xl bg-muted" />
        ) : upNext.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing else is planned for today.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {upNext.map((block) => (
              <li
                key={block._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/80 bg-background/70 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{block.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMinute(block.startMinute)} – {formatMinute(block.startMinute + block.durationMinutes)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void run(() => setStatus({ timeBlockId: block._id, status: "done" }))}
                    aria-label={`Mark ${block.title} done`}
                  >
                    Done
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => setStatus({ timeBlockId: block._id, status: "skipped" }))}
                    aria-label={`Let ${block.title} go`}
                  >
                    Let it go
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <output className="mt-4 block text-sm text-muted-foreground">{SAVE_ERROR}</output>
      ) : null}
    </section>
  );
}
