"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { cn } from "@/lib/utils";
import { checkedHabitIds, localDateKey } from "./checkedState";

const SAVE_ERROR = "That didn't save. Try again when you want.";

export function HabitCheckInStrip() {
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
    <section
      className="rounded-3xl border border-border/80 bg-card/90 p-5"
      aria-labelledby="habit-checkin-strip-heading"
    >
      <h2
        id="habit-checkin-strip-heading"
        className="font-heading text-xl font-semibold text-foreground"
      >
        Habits today
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Check a habit for this calendar day. Undo it whenever you want.
      </p>

      {liveHabits.length === 0 ? (
        <p className="mt-5 text-sm font-medium text-foreground">
          No habits yet. Add one on the{" "}
          <Link
            href="/habits"
            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Habits page
          </Link>
          .
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
        setNotice(SAVE_ERROR);
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
        <output className="mt-3 block text-sm text-muted-foreground">{notice}</output>
      ) : null}
      <ul className="mt-5 flex flex-col gap-3">
        {habits.map((habit) => {
          const pending = optimistic.get(habit._id);
          const pressed = pending ?? serverChecked.has(habit._id);
          const streak = streakOverride.get(habit._id) ?? habit.currentStreak;
          const isBusy = busy.has(habit._id);
          return (
            <li key={habit._id}>
              <button
                type="button"
                aria-pressed={pressed}
                aria-label={
                  pressed
                    ? `Undo today's check for ${habit.name}`
                    : `Check ${habit.name} for today`
                }
                disabled={isBusy}
                onClick={() => toggle(habit._id, pressed)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between gap-3 rounded-full border px-4 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-70",
                  pressed
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary hover:text-primary",
                )}
              >
                <span className="font-medium text-foreground">{habit.name}</span>
                <span className="text-muted-foreground">{pressed ? "Checked" : "Check"}</span>
              </button>
              {streak >= 2 ? (
                <p className="mt-1 px-4 text-xs text-muted-foreground">{streak} days in a row</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function StripSkeleton() {
  return (
    <div
      className="h-32 animate-pulse rounded-3xl bg-muted"
      aria-hidden
      data-testid="habit-checkin-strip-loading"
    />
  );
}
