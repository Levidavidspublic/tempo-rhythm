"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { CarryOverStrip } from "@/components/carry-over-strip/CarryOverStrip";
import { DayPlanPanel } from "@/components/day-plan-panel/DayPlanPanel";
import { DayPlanSummary } from "@/components/day-plan-summary/DayPlanSummary";
import { HabitCheckInStrip } from "@/components/habit-checkin-strip/HabitCheckInStrip";
import { TaskViewsScreen } from "@/components/tasks/TaskViewsScreen";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading, StateSignedOut } from "@/components/you/ScreenStates";
import { api } from "@/convex/_generated/api";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { mapCalendarEventsToAgenda } from "@/lib/todayAgenda";
import { TodayAgenda } from "./TodayAgenda";
import { DailyPage } from "./DailyPage";
import { TodayChat } from "./TodayChat";
import { TodayBrainDumpPanel } from "./TodayBrainDumpPanel";
import { TodayEnergyRecommendations } from "./TodayEnergyRecommendations";
import { TodayGreeting } from "./TodayGreeting";
import { TodayQuickAdd } from "./TodayQuickAdd";
import { TodayTaskList } from "./TodayTaskList";

// HabitCheckInStrip replaces TodayHabitStrip. The page still subscribes to
// api.habits.list so the signed-in screen does not open before that read resolves.
function TodayWiredStrips() {
  return (
    <div className="today-strips">
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
  const { t } = useLocale();
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
      <div className="tp-page" data-component="PageLayout">
        <StateLoading label={t("today.loading")} rows={5} />
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
      <div className="tp-page" data-component="PageLayout">
        <StateSignedOut body={t("today.signInAgain")} />
      </div>
    );
  }

  return (
    <div className="tp-page today-page" data-component="PageLayout">
      <div className="today-stack">
        <TodayGreeting greetingName={profile.greetingName} />
        <TodayChat />
        <DailyPage dayStartMs={bounds.startMs} tasks={todayTasks} />
        <TodayWiredStrips />
        <TodayBrainDumpPanel dueAt={bounds.endMs - 1} />
        <TodayAgenda events={mapCalendarEventsToAgenda(calendarEvents)} />
        <div className="today-pair">
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
