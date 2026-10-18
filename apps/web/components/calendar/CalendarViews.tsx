"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type CalendarViewMode,
  fromDateInputValue,
  getCalendarRangeMs,
  getEventsInRange,
  getMonthGridRangeMs,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/calendar/date-math";
import {
  createLocalCalendarEvent,
  loadCalendarEvents,
  type StoredCalendarEvent,
  saveCalendarEvents,
} from "@/lib/calendar/event-source";
import { useLastLoaded } from "@/lib/calendar/last-loaded";
import { getAddEventAuthState, SIGNED_OUT_MESSAGE, toAddEventErrorMessage } from "./addEventGuard";
import { startOfWeek } from "../../../../packages/core/plan/calendar-math";
import { type GridItem, localDateOf, localSlotToMs, toGridItems } from "./gridData";
import { MonthGrid, todayLocal } from "./MonthGrid";
import { formatClock, pt, weekStartFor } from "./planCopy";
import { WeekGrid } from "./WeekGrid";
import {
  EventRow,
  type EventRowActions,
  type EventRowEvent,
  UndoToast,
  type UndoToastState,
} from "./EventRow";

const viewOptions: Array<{ mode: CalendarViewMode; label: string }> = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
];

const modeTitles: Record<CalendarViewMode, string> = {
  day: "Day events",
  week: "Week events",
  month: "Month events",
};

function formatRange(mode: CalendarViewMode, range: { startMs: number; endMs: number }): string {
  const start = new Date(range.startMs);
  const endInclusive = new Date(range.endMs - 1);

  if (mode === "day") {
    return start.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return `${start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} - ${endInclusive.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

type DisplayCalendarEvent = {
  id: string;
  title: string;
  startsAtMs: number;
};

function DueTaskList({
  tasks,
}: {
  tasks: Array<{ _id: string; title: string; dueAt?: number; status: string }>;
}) {
  return (
    <section
      aria-label="Due tasks"
      className="tp-section"
      data-component="Section"
      data-testid="calendar-due-tasks"
    >
      <h2 className="tp-section__title">Due tasks</h2>
      {tasks.length > 0 ? (
        <ul className="tp-list tp-surface cal-list">
          {tasks.map((task) => (
            <li className="tp-list-row" key={task._id}>
              <span className="tp-list-row__icon">
                <TpIcon name="checklist" size="sm" />
              </span>
              <span className="tp-list-row__body">
                <span className="tp-list-row__title" dir="auto">
                  {task.title}
                </span>
                <span className="tp-list-row__meta">
                  {task.dueAt !== undefined
                    ? new Date(task.dueAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "No due date"}
                  {task.status === "done" ? " · Done" : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tp-empty tp-surface">
          No tasks are due in this window. Today still holds anything without a date.
        </p>
      )}
    </section>
  );
}

function EventList({
  events,
  mode,
  actions,
}: {
  events: DisplayCalendarEvent[];
  mode: CalendarViewMode;
  actions?: EventRowActions;
}) {
  return (
    <section
      aria-label={`${mode} events`}
      className="tp-section"
      data-component="Section"
      data-testid={`${mode}-events`}
    >
      <h2 className="tp-section__title">{modeTitles[mode]}</h2>
      {events.length > 0 ? (
        <ul className="tp-list tp-surface cal-list">
          {events.map((event) => (
            <EventRow actions={actions} event={event} key={event.id} />
          ))}
        </ul>
      ) : (
        <div className="tp-empty tp-surface" data-component="Empty">
          <TpIcon name="calendar-grid" size="lg" />
          <p>No events in this window yet. Add one when you know where it belongs.</p>
        </div>
      )}
    </section>
  );
}

/** Week mode: the real week grid (fixed events, flexible dated tasks). */
function WeekEvents({
  weekStart,
  items,
  allDay,
  onMove,
}: {
  weekStart: string;
  items: GridItem[];
  allDay: ReturnType<typeof toGridItems>["allDay"];
  onMove?: (item: GridItem, to: { date: string; startMinute: number }) => Promise<void>;
}) {
  const { lang } = useLocale();
  const nowMinute = useNowMinute();
  return (
    <section
      aria-label="week events"
      className="tp-section"
      data-component="Section"
      data-testid="week-events"
    >
      <h2 className="tp-section__title">{modeTitles.week}</h2>
      <WeekGrid
        allDay={allDay}
        idPrefix="cal-week"
        items={items}
        lang={lang}
        nowMinute={nowMinute}
        onMove={onMove}
        today={todayLocal()}
        weekStart={weekStart}
      />
    </section>
  );
}

/** Month mode: the month grid, and what is on the chosen day under it. */
function MonthEvents({
  selectedDate,
  onSelectDate,
  items,
  allDay,
  events,
  actions,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  items: GridItem[];
  allDay: ReturnType<typeof toGridItems>["allDay"];
  events: DisplayCalendarEvent[];
  actions?: EventRowActions;
}) {
  const { lang } = useLocale();
  const [year, month] = selectedDate.split("-").map(Number) as [number, number];
  const counted = useMemo(
    () => [
      ...items,
      ...allDay.map((entry) => ({
        id: entry.id,
        date: entry.date,
        startMinute: 0,
        durationMinutes: 0,
        kind: entry.kind,
      })),
    ],
    [items, allDay]
  );
  const dayEvents = events.filter(
    (event) => localDateOf(new Date(event.startsAtMs)) === selectedDate
  );
  const dayTasks = items.filter((item) => item.source === "task" && item.date === selectedDate);
  const dayTaskRows = [
    ...allDay
      .filter((entry) => entry.kind === "flexible" && entry.date === selectedDate)
      .map((entry) => ({ id: entry.id, title: entry.title, startMinute: null as number | null })),
    ...dayTasks.map((task) => ({ id: task.id, title: task.title, startMinute: task.startMinute })),
  ];
  return (
    <section
      aria-label="month events"
      className="tp-section"
      data-component="Section"
      data-testid="month-events"
    >
      <h2 className="tp-section__title">{modeTitles.month}</h2>
      <MonthGrid
        idPrefix="cal-month"
        items={counted}
        lang={lang}
        month={month}
        onMonthChange={(nextYear, nextMonth) =>
          onSelectDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`)
        }
        onSelectDay={onSelectDate}
        selected={selectedDate}
        today={todayLocal()}
        year={year}
      />
      {dayEvents.length > 0 || dayTaskRows.length > 0 ? (
        <ul className="tp-list tp-surface cal-list">
          {dayEvents.map((event) => (
            <EventRow actions={actions} event={event} key={event.id} />
          ))}
          {dayTaskRows.map((task) => (
            <li className="tp-list-row" key={task.id}>
              <span className="tp-list-row__icon">
                <TpIcon name="checklist" size="sm" />
              </span>
              <span className="tp-list-row__body">
                <span className="tp-list-row__title" dir="auto">
                  {task.title}
                </span>
                <span className="tp-list-row__meta">
                  {task.startMinute !== null ? (
                    <span className="tp-num tp-mono tp-ltr">{formatClock(task.startMinute)}</span>
                  ) : (
                    pt(lang, "cal.g.allDay")
                  )}
                  {` · ${pt(lang, "cal.g.flex")}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tp-empty tp-surface">{pt(lang, "sch.none")}</p>
      )}
    </section>
  );
}

/** The local clock minute, refreshed every minute. Null until mounted (no clock on the server). */
function useNowMinute(): number | null {
  const [minute, setMinute] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setMinute(now.getHours() * 60 + now.getMinutes());
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return minute;
}

export function CalendarViews({ eventSourceMode }: { eventSourceMode: "convex" | "local" }) {
  const [view, setView] = useState<CalendarViewMode>("day");
  const [selectedDateValue, setSelectedDateValue] = useState(() => toDateInputValue(new Date()));
  const [title, setTitle] = useState("");
  const [localEvents, setLocalEvents] = useState<StoredCalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const createConvexEvent = useMutation(api.calendar_events.create);
  const updateConvexEvent = useMutation(api.calendar_events.update);
  const removeConvexEvent = useMutation(api.calendar_events.remove);
  const updateTask = useMutation(api.tasks.update);
  const restoreConvexEvent = useMutation(api.calendar_events.restore);
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { lang } = useLocale();

  useEffect(() => {
    if (eventSourceMode === "local") {
      setLocalEvents(loadCalendarEvents());
    }
  }, [eventSourceMode]);

  const selectedDate = useMemo(() => parseDateInputValue(selectedDateValue), [selectedDateValue]);
  const range = useMemo(
    () => getCalendarRangeMs(view, selectedDate ?? new Date()),
    [selectedDate, view]
  );
  // The month grid draws 6 whole weeks, so fetch from its first cell to the day after its last,
  // not just the 1st to the 1st: leading and trailing days show their items too.
  const queryRange = useMemo(
    () =>
      view === "month"
        ? getMonthGridRangeMs(selectedDate ?? new Date(), weekStartFor(lang))
        : range,
    [lang, range, selectedDate, view]
  );
  // listInRange / listDueInRange call requireUser, which THROWS while the backend identity or the
  // user row isn't ready (e.g. during sign-in). getProfile returns null instead, so subscribe to the
  // lists only once it has resolved a user; until then the page shows its loading state, not an error.
  const profile = useQuery(
    api.users.getProfile,
    eventSourceMode === "convex" && isAuthenticated ? {} : "skip"
  );
  const authState = getAddEventAuthState({
    isAuthenticated,
    isLoading: isAuthLoading,
    profile,
  });
  const isAuthWaiting = eventSourceMode === "convex" && authState === "wait";
  const hasConvexUser = eventSourceMode === "convex" && isAuthenticated && profile != null;
  // While the next window loads, keep the last results on screen (the skeleton is for the first
  // load only), so the grid stays put and keyboard focus stays on the day.
  const convexEvents = useLastLoaded(
    useQuery(
      api.calendar_events.listInRange,
      hasConvexUser ? { startMs: queryRange.startMs, endMs: queryRange.endMs } : "skip"
    ),
    hasConvexUser
  );
  const dueTasks = useLastLoaded(
    useQuery(
      api.tasks.listDueInRange,
      hasConvexUser ? { startMs: queryRange.startMs, endMs: queryRange.endMs } : "skip"
    ),
    hasConvexUser
  );
  const events = useMemo<DisplayCalendarEvent[]>(() => {
    if (eventSourceMode === "local") {
      return localEvents;
    }

    return (convexEvents ?? []).map((event) => ({
      id: event._id,
      title: event.title,
      startsAtMs: event.startsAtMs,
    }));
  }, [convexEvents, eventSourceMode, localEvents]);
  const visibleEvents = useMemo(() => getEventsInRange(events, queryRange), [events, queryRange]);
  const grid = useMemo(
    () => toGridItems({ events: visibleEvents, tasks: hasConvexUser ? (dueTasks ?? []) : [] }),
    [visibleEvents, dueTasks, hasConvexUser]
  );
  const weekStart = useMemo(
    () => startOfWeek(localDateOf(selectedDate ?? new Date()), { weekStartsOn: 1 }),
    [selectedDate]
  );
  const moveTask = useCallback(
    async (item: GridItem, to: { date: string; startMinute: number }) => {
      if (item.source !== "task") return;
      await updateTask({
        taskId: item.id as Id<"tasks">,
        dueAt: localSlotToMs(to.date, to.startMinute),
      });
    },
    [updateTask]
  );
  const isLoading =
    eventSourceMode === "convex" &&
    (isAuthLoading ||
      (isAuthenticated && profile === undefined) ||
      (hasConvexUser && (convexEvents === undefined || dueTasks === undefined)));

  const handleExpireToast = useCallback(() => setUndoToast(null), []);
  const rowActions = useMemo<EventRowActions | undefined>(() => {
    if (eventSourceMode !== "convex") return undefined;
    return {
      onUpdate: async (event: EventRowEvent, patch) => {
        await updateConvexEvent({
          eventId: event.id as Id<"calendarEvents">,
          title: patch.title,
          startsAtMs: patch.startsAtMs,
        });
      },
      onDelete: async (event: EventRowEvent) => {
        const result = await removeConvexEvent({ eventId: event.id as Id<"calendarEvents"> });
        setUndoToast({ eventId: event.id, title: event.title, undoUntilMs: result.undoUntilMs });
      },
    };
  }, [eventSourceMode, removeConvexEvent, updateConvexEvent]);

  async function handleUndo() {
    if (!undoToast) return;
    const result = await restoreConvexEvent({ eventId: undoToast.eventId as Id<"calendarEvents"> });
    if (!result.success) {
      throw new Error("That event can no longer be restored.");
    }
    setUndoToast(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const startsAtMs = fromDateInputValue(selectedDateValue).getTime();
      const cleanTitle = title.trim();
      if (!cleanTitle) {
        throw new Error("Give the event a gentle label first.");
      }

      setIsSubmitting(true);
      if (eventSourceMode === "local") {
        const created = createLocalCalendarEvent({
          title: cleanTitle,
          startsAtMs,
        });
        const nextEvents = [...localEvents, created].toSorted(
          (a, b) => a.startsAtMs - b.startsAtMs
        );
        saveCalendarEvents(nextEvents);
        setLocalEvents(nextEvents);
      } else {
        if (authState !== "ready") {
          setIsSubmitting(false);
          if (authState === "signed-out") setError(SIGNED_OUT_MESSAGE);
          return;
        }
        try {
          await createConvexEvent({ title: cleanTitle, startsAtMs });
        } catch (createErr) {
          setError(toAddEventErrorMessage(createErr));
          return;
        }
      }
      setTitle("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not add that event yet.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="tp-page tp-page--wide cal-screen" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-eyebrow">Calendar</p>
          <h1 className="tp-pagehead__title">One source for every calendar view</h1>
          <p className="tp-pagehead__sub">
            Add an event once, then switch between Day, Week, and Month without losing the thread.
          </p>
        </div>
      </header>

      <form className="tp-surface cal-add" data-component="Form" onSubmit={handleSubmit}>
        <div className="cal-add__row">
          <label className="tp-field cal-add__title">
            <span className="tp-label">Event title</span>
            <input
              className="tp-input"
              dir="auto"
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Planning call"
              value={title}
            />
          </label>

          <label className="tp-field">
            <span className="tp-label">Event date</span>
            <input
              className="tp-input tp-num"
              name="date"
              onChange={(event) => setSelectedDateValue(event.target.value)}
              type="date"
              value={selectedDateValue}
            />
          </label>

          <button
            className="tp-btn tp-btn--primary"
            disabled={isSubmitting || isAuthWaiting}
            type="submit"
          >
            <TpIcon name="plus" size="sm" />
            <span>
              {isAuthWaiting
                ? "Getting your calendar ready…"
                : isSubmitting
                  ? "Adding..."
                  : "Add event"}
            </span>
          </button>
        </div>

        {error ? (
          <p className="tp-error-text" role="alert">
            <span>
              {error}
              {error === SIGNED_OUT_MESSAGE ? (
                <>
                  {" "}
                  <a className="tp-btn--link" href="/sign-in?redirect=/calendar">
                    Sign in
                  </a>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </form>

      <div className="tp-toolbar cal-toolbar">
        <fieldset className="cal-views">
          <legend className="tp-sr-only">Calendar views</legend>
          <div className="tp-segmented">
            {viewOptions.map((option) => (
              <button
                aria-pressed={view === option.mode}
                className="tp-seg__opt"
                key={option.mode}
                onClick={() => setView(option.mode)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="tp-muted tp-small tp-toolbar__end">{formatRange(view, range)}</p>
      </div>

      {isLoading ? (
        <section className="tp-surface" aria-busy="true">
          <div className="tp-skeleton tp-skeleton--w40" />
          <div className="tp-skeleton tp-skeleton--block" />
        </section>
      ) : view === "week" ? (
        <WeekEvents
          allDay={grid.allDay}
          items={grid.items}
          onMove={hasConvexUser ? moveTask : undefined}
          weekStart={weekStart}
        />
      ) : view === "month" ? (
        <MonthEvents
          actions={rowActions}
          allDay={grid.allDay}
          events={visibleEvents}
          items={grid.items}
          onSelectDate={setSelectedDateValue}
          selectedDate={localDateOf(selectedDate ?? new Date())}
        />
      ) : (
        <>
          <EventList actions={rowActions} events={visibleEvents} mode={view} />
          {hasConvexUser ? <DueTaskList tasks={dueTasks ?? []} /> : null}
        </>
      )}
      {undoToast ? (
        <UndoToast onExpire={handleExpireToast} onUndo={handleUndo} toast={undoToast} />
      ) : null}
    </div>
  );
}
