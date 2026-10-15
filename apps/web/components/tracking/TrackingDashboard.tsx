"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Flame } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SoftCard } from "@/components/soft-editorial/SoftCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildTrackingDashboard,
  completeTrackingSession,
  formatSessionMinutes,
  parseTrackingLogs,
  trackingLogsStorageKey,
} from "@/lib/trackingDashboard";
import {
  lastLocalDaysRange,
  lastSevenDaysSeries,
  localDayKey,
  minutesFromMs,
} from "./focusBlockStats";

type PendingUndo = { focusBlockId: Id<"focusBlocks">; undoUntilMs: number };

// Users whose legacy localStorage import is running in this tab (survives remounts of /tracking).
const importsInFlight = new Map<string, Promise<void>>();
// focusBlocks.create accepts at most 8 hours; the old local form allowed longer sessions.
const MAX_IMPORT_DURATION_MS = 8 * 60 * 60 * 1000;

export function TrackingDashboard() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const hasConvexUser = profile != null;
  const habitStreak = useQuery(
    api.streaks.getCurrent,
    isAuthenticated && hasConvexUser ? {} : "skip"
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Roll the 7-day window over at local midnight (and when a tab wakes up on a new day), so an open
  // tab never treats yesterday as today and new blocks stay inside listInRange.
  useEffect(() => {
    const nextMidnight = new Date(nowMs);
    nextMidnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setNowMs(Date.now()), Math.max(1000, nextMidnight.getTime() - Date.now()));
    const onVisible = () => {
      if (document.visibilityState === "visible" && new Date().toDateString() !== new Date(nowMs).toDateString()) {
        setNowMs(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [nowMs]);
  const range = useMemo(() => lastLocalDaysRange(nowMs), [nowMs]);
  const blocks = useQuery(
    api.focusBlocks.listInRange,
    isAuthenticated && hasConvexUser ? range : "skip"
  );
  const createBlock = useMutation(api.focusBlocks.create);
  const removeBlock = useMutation(api.focusBlocks.remove);
  const restoreBlock = useMutation(api.focusBlocks.restore);
  const [intention, setIntention] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("25");
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const migratedFor = useRef<string | null>(null);
  const [importRetry, setImportRetry] = useState(0);
  const [isUndoing, setIsUndoing] = useState(false);
  const undoingRef = useRef(false);
  const userId = profile?._id;

  // One-time import of logs the old localStorage version saved. Each log leaves the stored list
  // once its create succeeds, so a failed run can be retried without duplicates.
  // biome-ignore lint/correctness/useExhaustiveDependencies: importRetry re-runs the import after another mount's run settles.
  useEffect(() => {
    if (!userId || migratedFor.current === userId) {
      return;
    }
    migratedFor.current = userId;
    const key = trackingLogsStorageKey(userId);
    let remaining: ReturnType<typeof parseTrackingLogs>;
    try {
      remaining = parseTrackingLogs(localStorage.getItem(key));
    } catch {
      return;
    }
    // Normalize the old logs (trimmed labels, oldest first) with the session-log helper.
    remaining = remaining.reduce<typeof remaining>(
      (logs, log) => completeTrackingSession(logs, log).logs,
      []
    );
    if (buildTrackingDashboard(remaining).chart.points.length === 0) {
      return;
    }
    // One import at a time per user: across remounts in this tab (module-level set) and across tabs
    // (Web Locks, when the browser has them). A run that can't get the lock retries on the next visit.
    const inFlight = importsInFlight.get(userId);
    if (inFlight) {
      // Another mount's import is running. Not done yet: look again when it settles (it may fail).
      migratedFor.current = null;
      void inFlight.then(() => setImportRetry((n) => n + 1));
      return;
    }
    const runImport = async () => {
      // Re-read inside the lock: another tab may already have imported some or all logs.
      try {
        remaining = parseTrackingLogs(localStorage.getItem(key));
      } catch {
        return;
      }
      // One failing log never blocks the rest: it stays in localStorage and the next visit retries it.
      let failed = false;
      for (const log of [...remaining]) {
        const durationMs = Math.min(
          MAX_IMPORT_DURATION_MS,
          Math.max(1, Math.round(log.durationMinutes * 60_000))
        );
        try {
          await createBlock({
            startedAtMs: log.completedAt - durationMs,
            durationMs,
            label: log.intention,
          });
        } catch {
          failed = true;
          continue;
        }
        remaining = remaining.filter((item) => item.id !== log.id);
        localStorage.setItem(key, JSON.stringify(remaining));
      }
      if (failed) {
        migratedFor.current = null;
      } else {
        localStorage.removeItem(key);
      }
    };
    const run = (async () => {
      try {
        const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
        if (locks) {
          await locks.request(`tempo-tracking-import:${userId}`, { ifAvailable: true }, async (lock) => {
            if (!lock) {
              migratedFor.current = null;
              return;
            }
            await runImport();
          });
        } else {
          await runImport();
        }
      } finally {
        importsInFlight.delete(userId);
      }
    })();
    importsInFlight.set(userId, run);
  }, [userId, createBlock, importRetry]);

  useEffect(() => {
    if (!pendingUndo) {
      return;
    }
    const timer = setTimeout(
      () => setPendingUndo(null),
      Math.max(0, pendingUndo.undoUntilMs - Date.now())
    );
    return () => clearTimeout(timer);
  }, [pendingUndo]);

  const series = useMemo(() => lastSevenDaysSeries(blocks ?? [], nowMs), [blocks, nowMs]);
  const todayMinutes = series[series.length - 1]?.minutes ?? 0;

  const isLoading =
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined ||
        (hasConvexUser && (habitStreak === undefined || blocks === undefined))));

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-4xl p-8">
        <div className="space-y-4">
          <div className="h-12 w-56 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-3xl bg-muted" />
          <div className="h-24 animate-pulse rounded-3xl bg-muted" />
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !profile || !habitStreak || !blocks) {
    return (
      <main className="mx-auto w-full max-w-4xl p-8 text-center">
        <SoftCard className="mx-auto max-w-xl">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Session tracking</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in again to see habit streaks and log a focus block.
          </p>
          <Button asChild className="mt-6">
            <Link href="/sign-in?next=/tracking">Sign in</Link>
          </Button>
        </SoftCard>
      </main>
    );
  }

  const logSession = async () => {
    const minutes = Number.parseInt(durationMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0 || intention.trim().length === 0) {
      return;
    }
    const durationMs = minutes * 60_000;
    try {
      await createBlock({
        startedAtMs: Date.now() - durationMs,
        durationMs,
        label: intention.trim(),
      });
      setIntention("");
      setMessage(null);
    } catch {
      setMessage("That block did not save. Try once more.");
    }
  };

  const deleteBlock = async (focusBlockId: Id<"focusBlocks">) => {
    try {
      const result = await removeBlock({ focusBlockId });
      setPendingUndo({ focusBlockId, undoUntilMs: result.undoUntilMs });
      setMessage(null);
    } catch {
      setMessage("That block could not be removed.");
    }
  };

  const undoDelete = async () => {
    if (!pendingUndo || undoingRef.current) {
      return;
    }
    undoingRef.current = true;
    setIsUndoing(true);
    try {
      const result = await restoreBlock({ focusBlockId: pendingUndo.focusBlockId });
      setMessage(result.success ? null : "The undo window has passed.");
      setPendingUndo(null);
    } catch {
      // Keep the Undo action (until its window ends) so a network failure can be retried.
      setMessage("Could not restore that block. Try Undo again.");
    } finally {
      undoingRef.current = false;
      setIsUndoing(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Flame className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              You
            </p>
            <h1 className="font-heading text-4xl font-semibold text-foreground">
              Session tracking
            </h1>
          </div>
        </div>
        <p className="max-w-2xl text-muted-foreground">
          A quiet place to notice what you already did. Coming back later still counts — there is no
          falling behind here.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <SoftCard>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Habit streak
          </p>
          <p className="mt-3 font-heading text-3xl font-semibold text-foreground">
            {habitStreak.streakCount}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Longest among {habitStreak.habitCount}{" "}
            {habitStreak.habitCount === 1 ? "habit" : "habits"}: {habitStreak.longestAmongHabits}.
            Streaks are information, not pressure.{" "}
            <Link href="/habits" className="underline underline-offset-4">
              Open habits
            </Link>
          </p>
        </SoftCard>
        <SoftCard>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Focus blocks today
          </p>
          <p className="mt-3 font-heading text-3xl font-semibold text-foreground">
            {formatSessionMinutes(todayMinutes)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved to your account, so they are here after a reload or on another device.
          </p>
        </SoftCard>
      </section>

      <div aria-live="polite">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {pendingUndo ? (
          <p className="flex items-center gap-3 text-sm text-foreground">
            Focus block removed.
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUndoing}
              onClick={() => void undoDelete()}
            >
              Undo
            </Button>
          </p>
        ) : null}
      </div>

      <form
        className="rounded-3xl border border-dashed border-border bg-muted/30 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void logSession();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="session-intention">What this block was for</Label>
            <Input
              id="session-intention"
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              placeholder="A gentle first stretch, inbox, meds..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-minutes">Minutes</Label>
            <Input
              id="session-minutes"
              type="number"
              min={1}
              inputMode="numeric"
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={intention.trim().length === 0}>
            Log this block
          </Button>
        </div>
      </form>

      {blocks.length === 0 ? (
        <div className="rounded-3xl border border-border/80 bg-card/90 px-6 py-10 text-center">
          <p className="text-base font-medium text-foreground">No focus blocks logged yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            When you finish a short stretch, log it here. One block is enough.
          </p>
        </div>
      ) : (
        <section aria-label="Logged focus blocks">
          <ul className="space-y-3">
            {blocks.map((block) => (
              <li
                key={block._id}
                className="flex items-center justify-between gap-3 rounded-3xl border border-border/80 bg-card/90 p-5"
              >
                <div>
                  <p className="font-medium text-foreground">{block.label ?? "Focus block"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatSessionMinutes(minutesFromMs(block.durationMs))} ·{" "}
                    {localDayKey(block.startedAtMs)}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => void deleteBlock(block._id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <ol className="mt-6 grid gap-2 sm:grid-cols-2">
            {series.map((point) => (
              <li
                key={point.day}
                className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground"
              >
                <span className="font-medium text-foreground">{point.day}</span>
                {" · "}
                {point.blocks} {point.blocks === 1 ? "block" : "blocks"},{" "}
                {formatSessionMinutes(point.minutes)}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
