"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { checkedHabitIds, localDateKey } from "./checkedState";

/**
 * Habits today, on Today (HabitBlock / TaskRow): one tick per habit for this calendar day, undo by
 * ticking again. v3 Section and TaskRow classes; long names wrap; a tick that doesn't save says so.
 */
export function HabitCheckInStrip() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const bounds = useLocalDayBounds();
  const localDate = localDateKey(new Date(bounds.startMs));
  const hasConvexUser = profile != null;
  const canQuery = isAuthenticated && hasConvexUser;
  const habits = useQuery(api.habits.list, canQuery ? {} : "skip");
  const checkIns = useQuery(api.habitCheckIns.listForDate, canQuery ? { localDate } : "skip");
  if (isAuthLoading || (isAuthenticated && profile === undefined)) {
    return <StripSkeleton />;
  }

  if (!isAuthenticated || profile === null) {
    return null;
  }

  if (habits === undefined || checkIns === undefined) {
    return <StripSkeleton />;
  }

  const liveHabits = habits.filter((habit) => habit.deletedAt === undefined);
  const serverChecked = checkedHabitIds(checkIns);

  return (
    <section className="tp-surface" aria-labelledby="habit-checkin-strip-heading" data-component="HabitsToday">
      <div className="tp-section__head">
        <h2 id="habit-checkin-strip-heading" className="tp-section__title">
          {t("hc.title")}
        </h2>
      </div>
      <p className="tp-help">{t("hc.sub")}</p>

      {liveHabits.length === 0 ? (
        <p className="tp-help">
          {t("hc.none")}{" "}
          <Link href="/habits" className="tp-btn tp-btn--link">
            {t("hc.openHabits")}
          </Link>
        </p>
      ) : (
        <HabitCheckInList
          key={localDate}
          localDate={localDate}
          habits={liveHabits}
          serverChecked={serverChecked}
        />
      )}
    </section>
  );
}

function HabitCheckInList({
  localDate,
  habits,
  serverChecked,
}: {
  localDate: string;
  habits: {
    _id: Id<"habits">;
    name: string;
    currentStreak: number;
  }[];
  serverChecked: Set<string>;
}) {
  const { t } = useLocale();
  const check = useMutation(api.habitCheckIns.check);
  const undo = useMutation(api.habitCheckIns.undo);
  const [optimistic, setOptimistic] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [streakOverride, setStreakOverride] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setOptimistic((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const [id, want] of prev) {
        if (serverChecked.has(id) === want) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [serverChecked]);

  useEffect(() => {
    setStreakOverride((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map(prev);
      let changed = false;
      for (const habit of habits) {
        const override = next.get(habit._id);
        if (override !== undefined && override === habit.currentStreak) {
          next.delete(habit._id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [habits]);

  const toggle = (habitId: Id<"habits">, pressed: boolean) => {
    if (busy.has(habitId)) return;
    setNotice(null);
    setBusy((prev) => {
      const next = new Set(prev);
      next.add(habitId);
      return next;
    });
    setOptimistic((prev) => {
      const next = new Map(prev);
      next.set(habitId, !pressed);
      return next;
    });

    const action = pressed
      ? undo({ habitId, localDate })
      : check({ habitId, localDate, source: "today" });

    void action
      .then((result) => {
        setStreakOverride((prev) => {
          const next = new Map(prev);
          next.set(habitId, result.currentStreak);
          return next;
        });
      })
      .catch(() => {
        setOptimistic((prev) => {
          const next = new Map(prev);
          next.delete(habitId);
          return next;
        });
        setNotice(t("hc.saveError"));
      })
      .finally(() => {
        setBusy((prev) => {
          const next = new Set(prev);
          next.delete(habitId);
          return next;
        });
      });
  };

  return (
    <>
      {notice ? (
        <p className="tp-error-text" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{notice}</span>
        </p>
      ) : null}
      <ul className="tp-list">
        {habits.map((habit) => {
          const pending = optimistic.get(habit._id);
          const pressed = pending ?? serverChecked.has(habit._id);
          const streak = streakOverride.get(habit._id) ?? habit.currentStreak;
          const isBusy = busy.has(habit._id);
          return (
            <li key={habit._id} className="tp-task-row hc-row" data-done={pressed ? "true" : undefined}>
              <button
                type="button"
                className="tp-check"
                aria-pressed={pressed}
                aria-label={pressed ? `Undo today's check for ${habit.name}` : `Check ${habit.name} for today`}
                disabled={isBusy}
                onClick={() => toggle(habit._id, pressed)}
              >
                <span className="tp-check__box">
                  <TpIcon name="check" />
                </span>
              </button>
              <div className="tp-task-row__body">
                <span className="tp-task-row__title" dir="auto">
                  {habit.name}
                </span>
                <span className="tp-task-row__meta">
                  <span>{pressed ? t("hc.checked") : t("hc.notYet")}</span>
                  {streak >= 2 ? <span>{t("hc.inARow").replace("{n}", String(streak))}</span> : null}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function StripSkeleton() {
  return (
    <div className="tp-surface" aria-hidden data-testid="habit-checkin-strip-loading">
      <span className="tp-skeleton tp-skeleton--w40" />
      <span className="tp-skeleton tp-skeleton--w80" />
      <span className="tp-skeleton tp-skeleton--w60" />
    </div>
  );
}
