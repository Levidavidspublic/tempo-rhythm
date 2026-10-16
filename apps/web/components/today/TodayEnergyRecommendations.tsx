"use client";

import { useMutation, useQuery } from "convex/react";
import { BatteryLow, BatteryMedium, Plus, Sparkles, X, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { toDateInputValue } from "@/lib/calendar/date-math";
import {
  type EnergyLevel,
  recommendTasksForEnergy,
} from "@/lib/energyRecommendations";
import { cn } from "@/lib/utils";

/**
 * T-007c — energy-aware suggestions with an explicit accept / reject step.
 *
 * Reads the user's open tasks and recommends up to three that fit the energy
 * level they pick. Accepting ("Add to Today") calls the existing
 * `tasks.update` mutation with today's dueAt; "Not now" dismisses locally.
 * Nothing is ever applied without the user's click (HARD_RULES §1).
 */

type TodayEnergyRecommendationsProps = {
  /** End-of-today dueAt to stamp on accepted tasks (bounds.endMs - 1). */
  dueAt: number;
  todayStartMs: number;
  todayEndMs: number;
};

const ENERGY_OPTIONS: Array<{ level: EnergyLevel; label: string; icon: ReactNode }> = [
  { level: "low", label: "Low", icon: <BatteryLow className="h-4 w-4" aria-hidden /> },
  { level: "medium", label: "Medium", icon: <BatteryMedium className="h-4 w-4" aria-hidden /> },
  { level: "high", label: "High", icon: <Zap className="h-4 w-4" aria-hidden /> },
];

export function TodayEnergyRecommendations({
  dueAt,
  todayStartMs,
  todayEndMs,
}: TodayEnergyRecommendationsProps) {
  const localDate = useMemo(() => toDateInputValue(new Date(todayStartMs)), [todayStartMs]);
  const plan = useQuery(api.dayPlans.getForDate, { localDate });
  const upsertPlan = useMutation(api.dayPlans.upsert);
  const energy = plan?.energy ?? null;
  const [isSavingEnergy, setIsSavingEnergy] = useState(false);
  const [energyError, setEnergyError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const updateTask = useMutation(api.tasks.update);

  // Only subscribe once the user has opted in by picking an energy level.
  const tasks = useQuery(api.tasks.list, energy !== null ? {} : "skip");

  const recommendations =
    energy !== null && tasks !== undefined
      ? recommendTasksForEnergy(
          tasks.map((t) => ({
            id: t._id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            energy: t.energy,
            dueAt: t.dueAt,
            updatedAt: t.updatedAt,
          })),
          { energy, todayStartMs, todayEndMs, dismissedIds },
        )
      : null;

  const acceptTask = async (taskId: string) => {
    setPendingId(taskId);
    try {
      await updateTask({ taskId: taskId as Id<"tasks">, dueAt });
    } finally {
      setPendingId(null);
    }
  };

  const dismissTask = (taskId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      return next;
    });
  };

  const pickEnergy = async (nextEnergy: EnergyLevel) => {
    setIsSavingEnergy(true);
    setEnergyError(null);
    try {
      await upsertPlan({ localDate, energy: nextEnergy });
    } catch {
      setEnergyError("We couldn't save that just now. Please try again.");
    } finally {
      setIsSavingEnergy(false);
    }
  };

  return (
    <section
      className="rounded-3xl border border-border/80 bg-card/90 p-6 shadow-[0_10px_30px_rgba(26,25,23,0.08)]"
      aria-labelledby="energy-recommendations-heading"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2
            id="energy-recommendations-heading"
            className="font-heading text-2xl font-semibold text-foreground"
          >
            Match your energy
          </h2>
          <p className="text-sm text-muted-foreground">
            How's your energy right now? We'll suggest tasks that fit — you decide.
          </p>
        </div>
      </div>

      <fieldset className="mt-4 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">Pick your current energy level</legend>
        {ENERGY_OPTIONS.map((option) => {
          const isActive = energy === option.level;
          return (
            <button
              key={option.level}
              type="button"
              aria-pressed={isActive}
              disabled={plan === undefined || isSavingEnergy}
              onClick={() => {
                void pickEnergy(option.level);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/70 text-foreground hover:border-primary hover:text-primary",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </fieldset>

      {energyError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {energyError}
        </p>
      ) : null}

      {energy === null ? null : recommendations === null ? (
        <div className="mt-4 space-y-3" aria-hidden>
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : recommendations.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-6 text-center">
          <p className="text-base text-foreground">
            Nothing outside today's plan fits that energy right now.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            That's a fine answer — today's list already has you covered.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {recommendations.map(({ task, reason }) => (
            <li
              key={task.id}
              className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{reason}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingId === task.id}
                    onClick={() => {
                      void acceptTask(task.id);
                    }}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                    aria-label={`Add ${task.title} to Today`}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add to Today
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissTask(task.id)}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label={`Not now: ${task.title}`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Not now
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
