"use client";

/**
 * SessionScheduler (S4): a plan's sessions next to the person's events and dated tasks, in a
 * week grid or a month grid. Fixed events stay put; moving a session calls `tasks.update`
 * with the new `dueAt`. Data: plans.get, calendar_events.listInRange, tasks.listDueInRange.
 */
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Segmented, StateLoading } from "@/components/goals/shared";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  addDays,
  formatLocalDate,
  type LocalDate,
  parseLocalDate,
  startOfWeek,
} from "../../../../../packages/core/plan/calendar-math";
import { type GridItem, localSlotToMs, msToLocalSlot, toGridItems } from "../gridData";
import { MonthGrid, shiftMonth, todayLocal } from "../MonthGrid";
import { formatClock, longDate, type PlanLang, pt, weekStartFor } from "../planCopy";
import { WeekGrid } from "../WeekGrid";

type View = "week" | "month";
const VIEWS = ["week", "month"] as const;

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

export function SessionScheduler({ planId, lang }: { planId: Id<"studyPlans">; lang: PlanLang }) {
  const plan = useQuery(api.plans.get, { planId });
  const updateTask = useMutation(api.tasks.update);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<LocalDate | null>(null);
  const [picked, setPicked] = useState<LocalDate | null>(null);
  const nowMinute = useNowMinute();
  const today = useMemo(() => todayLocal(), []);

  // Open on the week of the first session.
  useEffect(() => {
    if (anchor !== null || plan === undefined) return;
    const first = plan?.tasks
      .map((task) => task.dueAt)
      .filter((dueAt): dueAt is number => dueAt !== undefined)
      .sort((a, b) => a - b)[0];
    setAnchor(first !== undefined ? msToLocalSlot(first).date : today);
  }, [anchor, plan, today]);

  const shown = anchor ?? today;
  const weekStart = startOfWeek(shown, { weekStartsOn: weekStartFor(lang) });
  const { year, month } = parseLocalDate(shown);
  const rangeStart = view === "week" ? weekStart : formatLocalDate(year, month, 1);
  const rangeEnd =
    view === "week"
      ? addDays(weekStart, 7)
      : formatLocalDate(shiftMonth(year, month, 1).year, shiftMonth(year, month, 1).month, 1);
  const range = { startMs: localSlotToMs(rangeStart, 0), endMs: localSlotToMs(rangeEnd, 0) };
  const events = useQuery(api.calendar_events.listInRange, range);
  const tasks = useQuery(api.tasks.listDueInRange, range);

  const grid = useMemo(
    () =>
      toGridItems({
        events: (events ?? []).map((e) => ({
          id: e._id,
          title: e.title,
          startsAtMs: e.startsAtMs,
        })),
        tasks: tasks ?? [],
      }),
    [events, tasks]
  );
  const counted = useMemo(
    () => [
      ...grid.items,
      ...grid.allDay.map((entry) => ({
        id: entry.id,
        date: entry.date,
        startMinute: 0,
        durationMinutes: 0,
        kind: entry.kind,
      })),
    ],
    [grid]
  );

  const move = async (item: GridItem, to: { date: LocalDate; startMinute: number }) => {
    if (item.source !== "task") return;
    await updateTask({
      taskId: item.id as Id<"tasks">,
      dueAt: localSlotToMs(to.date, to.startMinute),
    });
  };

  const headingId = "sch-h";
  const viewLabelId = "sch-view";

  if (plan === null) {
    return (
      <section className="tp-section" aria-labelledby={headingId}>
        <h2 className="tp-section__title" id={headingId}>
          {pt(lang, "sch.h")}
        </h2>
        <p className="tp-muted">{pt(lang, "sch.gone")}</p>
      </section>
    );
  }

  const loading = plan === undefined || events === undefined || tasks === undefined;
  const dayItems = picked ? grid.items.filter((item) => item.date === picked) : [];
  const dayAllDay = picked ? grid.allDay.filter((entry) => entry.date === picked) : [];

  return (
    <section className="tp-section" aria-labelledby={headingId} data-component="SessionScheduler">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id={headingId}>
          {pt(lang, "sch.h")}
        </h2>
      </div>
      <p className="tp-muted">{pt(lang, "sch.sub")}</p>
      <div className="tp-toolbar">
        <span className="tp-sr-only" id={viewLabelId}>
          {pt(lang, "sch.view")}
        </span>
        <Segmented
          labelledBy={viewLabelId}
          onChange={(next: View) => setView(next)}
          options={VIEWS}
          render={(option) => pt(lang, option === "week" ? "sch.week" : "sch.month")}
          value={view}
        />
        {view === "week" ? (
          <div className="tp-toolbar__end">
            <button
              className="tp-btn tp-btn--ghost tp-btn--icon"
              type="button"
              aria-label={pt(lang, "sch.prevWeek")}
              onClick={() => setAnchor(addDays(weekStart, -7))}
            >
              <TpIcon name="chevron" size="sm" className="tp-icon--back" />
            </button>
            <button
              className="tp-btn tp-btn--ghost tp-btn--icon"
              type="button"
              aria-label={pt(lang, "sch.nextWeek")}
              onClick={() => setAnchor(addDays(weekStart, 7))}
            >
              <TpIcon name="chevron" size="sm" flip />
            </button>
          </div>
        ) : null}
      </div>
      {loading ? (
        <StateLoading label={pt(lang, "sch.loading")} rows={4} />
      ) : view === "week" ? (
        <WeekGrid
          allDay={grid.allDay}
          idPrefix="sch-week"
          items={grid.items}
          lang={lang}
          nowMinute={nowMinute}
          onMove={move}
          today={today}
          weekStart={weekStart}
        />
      ) : (
        <>
          <MonthGrid
            idPrefix="sch-month"
            items={counted}
            lang={lang}
            month={month}
            onMonthChange={(y, m) => setAnchor(formatLocalDate(y, m, 1))}
            onSelectDay={setPicked}
            selected={picked}
            today={today}
            year={year}
          />
          {picked ? (
            <div className="tp-surface tp-sched__mover">
              <h3 className="tp-sched__mover-title">
                {pt(lang, "sch.dayItems", { date: longDate(lang, picked) })}
              </h3>
              {dayItems.length + dayAllDay.length > 0 ? (
                <ul className="tp-sched__agenda">
                  {dayAllDay.map((entry) => (
                    <li className="tp-sched__agenda-row" key={entry.id}>
                      <span className="tp-muted">{pt(lang, "cal.g.allDay")}</span>
                      <span dir="auto">{entry.title}</span>
                      <span
                        className={`tp-chip ${entry.kind === "fixed" ? "tp-chip--fixed" : "tp-chip--flex"}`}
                      >
                        {pt(lang, entry.kind === "fixed" ? "cal.g.fixed" : "cal.g.flex")}
                      </span>
                    </li>
                  ))}
                  {dayItems.map((item) => (
                    <li className="tp-sched__agenda-row" key={item.id}>
                      <span className="tp-num tp-mono tp-ltr">{formatClock(item.startMinute)}</span>
                      <span dir="auto">{item.title}</span>
                      <span
                        className={`tp-chip ${item.kind === "fixed" ? "tp-chip--fixed" : "tp-chip--flex"}`}
                      >
                        {pt(lang, item.kind === "fixed" ? "cal.g.fixed" : "cal.g.flex")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tp-muted">{pt(lang, "sch.none")}</p>
              )}
              <div>
                <button
                  className="tp-btn tp-btn--secondary tp-btn--sm"
                  type="button"
                  onClick={() => {
                    setAnchor(picked);
                    setView("week");
                  }}
                >
                  {pt(lang, "sch.showWeek")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
