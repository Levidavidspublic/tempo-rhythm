"use client";

import { type EnergySuggestion, resolveEnergySuggestion } from "@tempo/utils";
import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Template } from "./ScreenStates";

type HabitEnergySource = {
  _id: Id<"habits">;
  name: string;
  completedToday: boolean;
};

function suggestionsFromHabits(habits: readonly HabitEnergySource[]): EnergySuggestion[] {
  return habits
    .filter((habit) => !habit.completedToday)
    .slice(0, 3)
    .map((habit) => ({
      id: habit._id,
      habitName: habit.name,
      energy: "low",
      title: habit.name,
      body: "",
      status: "pending",
    }));
}

/**
 * Up to three habits not yet logged today, as gentle low-energy picks. Built by code, not the
 * coach. Accepting one is the person's own tap and logs today (source "suggestion"), so the
 * habit card and the Today check-in strip both show it; "Not for now" just sets it aside.
 */
export function HabitEnergySuggestions({
  habits,
  localDate,
}: {
  habits: readonly HabitEnergySource[];
  localDate: string;
}) {
  const { t } = useLocale();
  const checkIn = useMutation(api.habitCheckIns.check);
  const [suggestions, setSuggestions] = useState<EnergySuggestion[]>(() =>
    suggestionsFromHabits(habits)
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  const shown = useMemo(
    () => suggestions.filter((suggestion) => suggestion.status !== "rejected"),
    [suggestions]
  );

  if (shown.length === 0) return null;

  const accept = async (suggestionId: string) => {
    setPendingId(suggestionId);
    setSaveError(false);
    try {
      await checkIn({
        habitId: suggestionId as Id<"habits">,
        localDate,
        source: "suggestion",
        asOfLocalDate: localDate,
      });
      setSuggestions((current) => resolveEnergySuggestion(current, suggestionId, "accepted"));
    } catch {
      setSaveError(true);
    } finally {
      setPendingId(null);
    }
  };

  const reject = (suggestionId: string) => {
    setSuggestions((current) => resolveEnergySuggestion(current, suggestionId, "rejected"));
  };

  return (
    <section className="tp-section" data-component="Section" aria-labelledby="hb-energy">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="hb-energy">
          {t("hb.energy.title")}
        </h2>
      </div>
      <p className="tp-muted tp-small">{t("hb.energy.prompt")}</p>
      {saveError ? (
        <p className="tp-error-text" role="alert">
          {t("hr.saveError")}
        </p>
      ) : null}
      <ul className="hb-list">
        {shown.map((suggestion) => {
          const name = <bdi>{suggestion.habitName}</bdi>;
          return (
            <li key={suggestion.id} className="tp-surface hb-card">
              <p className="tp-h3">
                <Template template={t("hb.energy.item")} slots={{ name }} />
              </p>
              <p className="tp-muted">{t("hb.energy.body")}</p>
              {suggestion.status === "accepted" ? (
                <output className="tp-small">
                  <Template template={t("hb.energy.done")} slots={{ name }} />
                </output>
              ) : (
                <div className="hb-actions">
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    disabled={pendingId === suggestion.id}
                    onClick={() => void accept(suggestion.id)}
                  >
                    <TpIcon name="check" size="sm" />
                    <span>{t("hb.energy.accept")}</span>
                  </button>
                  <button
                    className="tp-btn tp-btn--ghost"
                    type="button"
                    disabled={pendingId === suggestion.id}
                    onClick={() => reject(suggestion.id)}
                  >
                    <span>{t("hb.energy.reject")}</span>
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
