"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  type CalendarViewMode,
  getCalendarRangeMs,
  getEventsInRange,
  parseDateInputValue,
  toDateInputValue,
} from "@/lib/calendar/date-math";
import {
  createLocalCalendarEvent,
  loadCalendarEvents,
  type StoredCalendarEvent,
  saveCalendarEvents,
} from "@/lib/calendar/event-source";
import type { MessageKey } from "@/lib/i18n";
import { intlLocale } from "@/lib/you/screenState";
import { getAddEventAuthState } from "./addEventGuard";
import {
  EventRow,
  type EventRowActions,
  type EventRowEvent,
  UndoToast,
  type UndoToastState,
} from "./EventRow";

const viewOptions: Array<{ mode: CalendarViewMode; label: MessageKey }> = [
  { mode: "day", label: "cal.view.day" },
  { mode: "week", label: "cal.view.week" },
  { mode: "month", label: "cal.view.month" },
];

const modeTitles: Record<CalendarViewMode, MessageKey> = {
  day: "cal.events.day",
  week: "cal.events.week",
  month: "cal.events.month",
};

function formatRange(
  mode: CalendarViewMode,
  range: { startMs: number; endMs: number },
  locale: string
): string {
  const start = new Date(range.startMs);
  const endInclusive = new Date(range.endMs - 1);

  if (mode === "day") {
    return start.toLocaleDateString(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return `${start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })} - ${endInclusive.toLocaleDateString(locale, {
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
  const { lang, t } = useLocale();
  return (
    <section
      aria-label={t("cal.due")}
      className="tp-section"
      data-component="Section"
      data-testid="calendar-due-tasks"
    >
      <h2 className="tp-section__title">{t("cal.due")}</h2>
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
                  ? new Date(task.dueAt).toLocaleDateString(intlLocale(lang), {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : t("cal.due.noDate")}
                {task.status === "done" ? ` · ${t("cal.due.done")}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tp-empty tp-surface">{t("cal.due.empty")}</p>
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
  const { t } = useLocale();
  return (
    <section
      aria-label={t(modeTitles[mode])}
      className="tp-section"
      data-component="Section"
      data-testid={`${mode}-events`}
    >
      <h2 className="tp-section__title">{t(modeTitles[mode])}</h2>
      {events.length > 0 ? (
        <ul className="tp-list tp-surface cal-list">
          {events.map((event) => (
            <EventRow actions={actions} event={event} key={event.id} />
          ))}
        </ul>
      ) : (
        <div className="tp-empty tp-surface" data-component="Empty">
          <TpIcon name="calendar-grid" size="lg" />
          <p>{t("cal.events.empty")}</p>
        </div>
      )}
    </section>
  );
}

export function CalendarViews({ eventSourceMode }: { eventSourceMode: "convex" | "local" }) {
  const { lang, t } = useLocale();
  const [view, setView] = useState<CalendarViewMode>("day");
  const [selectedDateValue, setSelectedDateValue] = useState(() => toDateInputValue(new Date()));
  const [title, setTitle] = useState("");
  const [localEvents, setLocalEvents] = useState<StoredCalendarEvent[]>([]);
  // A key, not text, so a message already on screen follows a language switch.
  const [error, setError] = useState<MessageKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const createConvexEvent = useMutation(api.calendar_events.create);
  const updateConvexEvent = useMutation(api.calendar_events.update);
  const removeConvexEvent = useMutation(api.calendar_events.remove);
  const restoreConvexEvent = useMutation(api.calendar_events.restore);
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

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
  const convexEvents = useQuery(
    api.calendar_events.listInRange,
    hasConvexUser ? { startMs: range.startMs, endMs: range.endMs } : "skip"
  );
  const dueTasks = useQuery(
    api.tasks.listDueInRange,
    hasConvexUser ? { startMs: range.startMs, endMs: range.endMs } : "skip"
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
  const visibleEvents = useMemo(() => getEventsInRange(events, range), [events, range]);
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
      throw new Error(t("cal.err.undoGone"));
    }
    setUndoToast(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedDate) {
      setError("cal.err.date");
      return;
    }
    const startsAtMs = selectedDate.getTime();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("cal.err.needTitle");
      return;
    }

    try {
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
          if (authState === "signed-out") setError("cal.err.signedOut");
          return;
        }
        try {
          await createConvexEvent({ title: cleanTitle, startsAtMs });
        } catch {
          // Calm copy for a failed create; never raw Convex text (addEventGuard.ts).
          setError("cal.err.server");
          return;
        }
      }
      setTitle("");
      setError(null);
    } catch {
      setError("cal.err.add");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="tp-page tp-page--wide cal-screen" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("nav.calendar")}</h1>
          <p className="tp-pagehead__sub">{t("cal.sub")}</p>
        </div>
      </header>

      <form className="tp-surface cal-add" data-component="Form" onSubmit={handleSubmit}>
        <div className="cal-add__row">
          <label className="tp-field cal-add__title">
            <span className="tp-label">{t("cal.eventTitle")}</span>
            <input
              className="tp-input"
              dir="auto"
              name="title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("cal.eventTitlePh")}
              value={title}
            />
          </label>

          <label className="tp-field">
            <span className="tp-label">{t("cal.eventDate")}</span>
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
                ? t("cal.waiting")
                : isSubmitting
                  ? t("cal.adding")
                  : t("cal.add")}
            </span>
          </button>
        </div>

        {error ? (
          <p className="tp-error-text" role="alert">
            <span>
              {t(error)}
              {error === "cal.err.signedOut" ? (
                <>
                  {" "}
                  <a className="tp-btn--link" href="/sign-in?redirect=/calendar">
                    {t("cal.signIn")}
                  </a>
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </form>

      <div className="tp-toolbar cal-toolbar">
        <fieldset className="cal-views">
          <legend className="tp-sr-only">{t("cal.views")}</legend>
          <div className="tp-segmented">
            {viewOptions.map((option) => (
              <button
                aria-pressed={view === option.mode}
                className="tp-seg__opt"
                key={option.mode}
                onClick={() => setView(option.mode)}
                type="button"
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </fieldset>
        <p className="tp-muted tp-small tp-toolbar__end">
          {formatRange(view, range, intlLocale(lang))}
        </p>
      </div>

      {isLoading ? (
        <section className="tp-surface" aria-busy="true">
          <div className="tp-skeleton tp-skeleton--w40" />
          <div className="tp-skeleton tp-skeleton--block" />
        </section>
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
