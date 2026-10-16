"use client";

import { useMutation, useQuery } from "convex/react";
import { BatteryLow, BatteryMedium, Plus, Sparkles, X, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import {
  type EnergyLevel,
  type EnergyRecommendation,
  recommendTasksForEnergy,
} from "@/lib/energyRecommendations";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * T-007c — energy-aware suggestions with an explicit accept / reject step.
 *
 * Reads the user's open tasks and recommends up to three that fit the energy
 * level they pick. Accepting ("Add to Today") calls the existing
 * `tasks.update` mutation with today's dueAt; "Not now" dismisses locally.
 * Nothing is ever applied without the user's click (HARD_RULES §1).
 * Every string comes from the en/he copy (`today.energy.*` in i18n-groups/you.ts).
 */

type TodayEnergyRecommendationsProps = {
  /** End-of-today dueAt to stamp on accepted tasks (bounds.endMs - 1). */
  dueAt: number;
  todayStartMs: number;
  todayEndMs: number;
};

const ENERGY_OPTIONS: Array<{ level: EnergyLevel; label: MessageKey; icon: ReactNode }> = [
  { level: "low", label: "today.energy.low", icon: <BatteryLow className="h-4 w-4" aria-hidden /> },
  { level: "medium", label: "today.energy.medium", icon: <BatteryMedium className="h-4 w-4" aria-hidden /> },
  { level: "high", label: "today.energy.high", icon: <Zap className="h-4 w-4" aria-hidden /> },
];

/**
 * The helper writes its reason in English; the card shows the same reason from the copy,
 * chosen by the picked energy and whether the task is an exact fit or a neighbouring level.
 */
const EXACT_REASON: Record<EnergyLevel, MessageKey> = {
  low: "today.energy.why.low",
  medium: "today.energy.why.medium",
  high: "today.energy.why.high",
};

const NEAR_REASON: Record<EnergyLevel, MessageKey> = {
  low: "today.energy.near.low",
  medium: "today.energy.near.medium",
  high: "today.energy.near.high",
};

export function TodayEnergyRecommendations({
  dueAt,
  todayStartMs,
  todayEndMs,
}: TodayEnergyRecommendationsProps) {
  const { t } = useLocale();
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const updateTask = useMutation(api.tasks.update);

  // Only subscribe once the user has opted in by picking an energy level.
  const tasks = useQuery(api.tasks.list, energy !== null ? {} : "skip");

  const recommendations =
    energy !== null && tasks !== undefined
      ? recommendTasksForEnergy(
          tasks.map((task) => ({
            id: task._id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            energy: task.energy,
            dueAt: task.dueAt,
            updatedAt: task.updatedAt,
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
            {t("today.energy.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("today.energy.sub")}</p>
        </div>
      </div>

      <fieldset className="mt-4 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{t("today.energy.pick")}</legend>
        {ENERGY_OPTIONS.map((option) => {
          const isActive = energy === option.level;
          return (
            <button
              key={option.level}
              type="button"
              aria-pressed={isActive}
              onClick={() => setEnergy(isActive ? null : option.level)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/70 text-foreground hover:border-primary hover:text-primary",
              )}
            >
              {option.icon}
              {t(option.label)}
            </button>
          );
        })}
      </fieldset>

      {energy === null ? null : (
        <EnergySuggestions
          energy={energy}
          recommendations={recommendations}
          pendingId={pendingId}
          onAccept={(taskId) => {
            void acceptTask(taskId);
          }}
          onDismiss={dismissTask}
        />
      )}
    </section>
  );
}

/**
 * What shows under the level buttons once one is picked: loading, nothing fits, or the
 * suggestions. Exported so its copy can be rendered in each state without a live query.
 */
export function EnergySuggestions({
  energy,
  recommendations,
  pendingId,
  onAccept,
  onDismiss,
}: {
  energy: EnergyLevel;
  /** null while the task list loads. */
  recommendations: EnergyRecommendation[] | null;
  pendingId: string | null;
  onAccept: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
}) {
  const { t } = useLocale();

  if (recommendations === null) {
    return (
      <div className="mt-4 space-y-3">
        <div className="h-16 animate-pulse rounded-2xl bg-muted" aria-hidden />
        <div className="h-16 animate-pulse rounded-2xl bg-muted" aria-hidden />
        <output className="sr-only">{t("today.energy.loading")}</output>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-6 text-center">
        <p className="text-base text-foreground">{t("today.energy.empty.t")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("today.energy.empty.b")}</p>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {recommendations.map(({ task, exactMatch }) => (
        <li
          key={task.id}
          className="rounded-2xl border border-border/80 bg-background/70 px-4 py-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* At least 12rem for the words: on a phone the buttons wrap below them instead of squeezing them. */}
            <div className="min-w-48 flex-1">
              <p className="font-medium text-foreground wrap-anywhere" dir="auto">
                {task.title}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(exactMatch ? EXACT_REASON[energy] : NEAR_REASON[energy])}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pendingId === task.id}
                onClick={() => onAccept(task.id)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
                aria-label={t("today.energy.addLabel").replace("{title}", () => task.title)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t("today.energy.add")}
              </button>
              <button
                type="button"
                onClick={() => onDismiss(task.id)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={t("today.energy.skipLabel").replace("{title}", () => task.title)}
              >
                <X className="h-4 w-4" aria-hidden />
                {t("today.energy.skip")}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
