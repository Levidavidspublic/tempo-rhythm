"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { CarryOverStrip } from "@/components/carry-over-strip/CarryOverStrip";
import { DayPlanPanel } from "@/components/day-plan-panel/DayPlanPanel";
import { DayPlanSummary } from "@/components/day-plan-summary/DayPlanSummary";
import { HabitCheckInStrip } from "@/components/habit-checkin-strip/HabitCheckInStrip";
import { SoftCard } from "@/components/soft-editorial/SoftCard";
import { TaskViewsScreen } from "@/components/tasks/TaskViewsScreen";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { mapCalendarEventsToAgenda } from "@/lib/todayAgenda";
import { TodayAgenda } from "./TodayAgenda";
import { DailyPage } from "./DailyPage";
import { TodayBrainDumpPanel } from "./TodayBrainDumpPanel";
import { TodayEnergyRecommendations } from "./TodayEnergyRecommendations";
import { TodayGreeting } from "./TodayGreeting";
import { TodayQuickAdd } from "./TodayQuickAdd";
import { TodayTaskList } from "./TodayTaskList";

// HabitCheckInStrip replaces TodayHabitStrip. The page still subscribes to
// api.habits.list so the signed-in screen does not open before that read resolves.
function TodayWiredStrips() {
  return (
    <div className="space-y-6">
      <div className="empty:hidden" data-testid="today-day-plan-panel">
        <DayPlanPanel />
      </div>
      <div className="empty:hidden" data-testid="today-day-plan-summary">
        <DayPlanSummary />
      </div>
      <div className="empty:hidden" data-testid="today-carry-over">
        <CarryOverStrip />
      </div>
      <div className="empty:hidden" data-testid="today-habit-checkin">
        <HabitCheckInStrip />
      </div>
    </div>
  );
}

export function TodayScreen() {
  // Reactive bounds: refreshes across local midnight, on visibility change, and
  // on window focus, so quick-add and brain-dump-to-Today never tag tasks with
  // yesterday's `dueAt` after a tab is left open overnight.
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  // Only subscribe after we know the Convex app user exists (getProfile is non-throwing
  // and matches fetchCurrentUser). This avoids a race where useConvexAuth is true but
  // the task query runs before the auth token/identity is consistent for the backend.
  const hasConvexUser = profile != null;
  const todayTasks = useQuery(
    api.tasks.listToday,
    isAuthenticated && hasConvexUser ? { dueFrom: bounds.startMs, dueTo: bounds.endMs } : "skip"
  );
  const habits = useQuery(
    api.habits.list,
    isAuthenticated && hasConvexUser ? {} : "skip",
  );
  const calendarEvents = useQuery(
    api.calendar_events.listInRange,
    isAuthenticated && hasConvexUser
      ? { startMs: bounds.startMs, endMs: bounds.endMs }
      : "skip",
  );

  const isLoading =
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined ||
        (hasConvexUser &&
          (todayTasks === undefined ||
            habits === undefined ||
            calendarEvents === undefined))));

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-6 py-12">
        <div className="space-y-6">
          <div className="h-12 w-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-80 animate-pulse rounded-[2rem] bg-muted" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            <div className="h-64 animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <TaskViewsScreen view="today" />
        <TodayWiredStrips />
      </>
    );
  }

  if (!profile || !todayTasks || !habits || !calendarEvents) {
    return (
      <div className="container mx-auto max-w-5xl px-6 py-16 text-center">
        <SoftCard className="mx-auto max-w-xl">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Sign in required</h1>
          <p className="mt-3 text-muted-foreground">
            We could not load your session. Sign in again to pick up where you left off.
          </p>
          <Button asChild className="mt-6">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-6 py-12">
      <div className="space-y-8">
        <TodayGreeting greetingName={profile.greetingName} />
        <DailyPage dayStartMs={bounds.startMs} tasks={todayTasks} />
        <TodayWiredStrips />
        <TodayBrainDumpPanel dueAt={bounds.endMs - 1} />
        <TodayAgenda events={mapCalendarEventsToAgenda(calendarEvents)} />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
          <TodayQuickAdd dueAt={bounds.endMs - 1} />
          <TodayTaskList tasks={todayTasks} />
        </div>
        <TodayEnergyRecommendations
          dueAt={bounds.endMs - 1}
          todayStartMs={bounds.startMs}
          todayEndMs={bounds.endMs}
        />
      </div>
    </div>
  );
}
