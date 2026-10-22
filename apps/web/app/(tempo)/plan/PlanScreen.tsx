"use client";

import { useState } from "react";
import { CalendarViews } from "@/components/calendar/CalendarViews";
import { DayTimeline, type DayTimelineBlock } from "@/components/day-timeline/DayTimeline";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TaskKanbanBoard } from "@/components/tasks/TaskKanbanBoard";
import { TimeBlockDialog } from "@/components/time-block-dialog/TimeBlockDialog";
import { type CalendarViewMode, toDateInputValue } from "@/lib/calendar/date-math";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

type PlanDialog =
  | { kind: "closed" }
  | { kind: "create"; startMinute: number }
  | { kind: "edit"; block: DayTimelineBlock };

export function PlanScreen() {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const today = toDateInputValue(new Date(bounds.startMs));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const localDate = selectedDate ?? today;
  const setLocalDate = (date: string) => setSelectedDate(date === today ? null : date);
  const [view, setView] = useState<CalendarViewMode | "board">("day");
  const [dialog, setDialog] = useState<PlanDialog>({ kind: "closed" });

  return (
    <div className="tp-page tp-page--wide" data-testid="plan-day">
      <header className="tp-pagehead">
        <h1 className="tp-sr-only">{t("nav.plan")}</h1>
      </header>
      <fieldset className="tp-toolbar cal-views">
        <legend className="tp-sr-only">{t("nav.plan")}</legend>
        <div className="tp-segmented">
          {(["day", "week", "month", "board"] as const).map((option) => (
            <button
              key={option}
              className="tp-seg__opt"
              style={{ minHeight: "var(--tp-touch)" }}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {t(option === "board" ? "tasks.board" : `cal.view.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>
      {view === "board" ? (
        <TaskKanbanBoard scope="all" embedded />
      ) : (
        <CalendarViews
          eventSourceMode="convex"
          embedded
          unified
          viewMode={view}
          dateValue={localDate}
          onDateChange={setLocalDate}
        />
      )}
      {view === "day" ? (
        <details className="tp-section" open>
          <summary className="tp-btn tp-btn--ghost">{t("timeline.title")}</summary>
          <DayTimeline
            localDate={localDate}
            onCreateAt={(startMinute) => setDialog({ kind: "create", startMinute })}
            onSelectBlock={(block) => setDialog({ kind: "edit", block })}
          />
        </details>
      ) : null}
      <TimeBlockDialog
        block={dialog.kind === "edit" ? dialog.block : undefined}
        initialStartMinute={dialog.kind === "create" ? dialog.startMinute : undefined}
        localDate={localDate}
        onOpenChange={(open) => {
          if (!open) setDialog({ kind: "closed" });
        }}
        open={dialog.kind !== "closed"}
      />
    </div>
  );
}
