"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { HabitSheet } from "@/components/habits/HabitSheet";
import {
  ScreenErrorBoundary,
  type SkeletonRow,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  Template,
  useOnline,
  useProfileState,
} from "@/components/habits/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  detailSummary,
  fillTemplate,
  parseLocalDate,
  settlePending,
  toLocalDateKey,
  withPending,
} from "@/lib/habits-view";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { buildSixWeekGrid, type SixWeekCell } from "./sixWeekGrid";

const LOADING_ROWS: readonly SkeletonRow[] = [
  ["w100"],
  ["w100"],
  ["w100"],
  ["w100"],
  ["w100"],
  ["w60"],
];
const DOW_MONDAY_FIRST = [
  "hr.dow.1",
  "hr.dow.2",
  "hr.dow.3",
  "hr.dow.4",
  "hr.dow.5",
  "hr.dow.6",
  "hr.dow.0",
] as const;
const EASIEST = [
  "hd.easy.0",
  "hd.easy.1",
  "hd.easy.2",
  "hd.easy.3",
  "hd.easy.4",
  "hd.easy.5",
  "hd.easy.6",
] as const;

/**
 * Habit detail (docs/design/v3/screens/web/habit-detail.html): Log today as the one main action,
 * 6 Monday-first weeks of filled circles / empty rings, and one plain sentence. No streaks.
 * A past day's circle can be tapped too, to log or un-log that day.
 *
 * Left out until the backend has them: the reminder in your own words (nags are not linked to
 * habits and have no time: no nags.getForHabit), Start fresh and Pause (no habits.startFresh or
 * habits.pause), and so the paused state. "When it usually happens" is not stored either, so the
 * subtitle is the rhythm alone.
 */
export function HabitDetail({ habitId }: { habitId: string }) {
  const bounds = useLocalDayBounds();
  return (
    <ScreenErrorBoundary fallback={(retry) => <DetailFailed onRetry={retry} />}>
      <DetailContent key={bounds.startMs} habitId={habitId} todayMs={bounds.startMs} />
    </ScreenErrorBoundary>
  );
}

function BackLink() {
  const { t } = useLocale();
  return (
    <Link className="tp-btn tp-btn--ghost" href="/habits">
      <TpIcon name="chevron" size="sm" className="tp-icon--back" />
      <span>{t("hd.back")}</span>
    </Link>
  );
}

function DetailFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <BackLink />
      <StateError title={t("hd.error")} onRetry={onRetry} />
    </div>
  );
}

function DetailContent({ habitId, todayMs }: { habitId: string; todayMs: number }) {
  const { t } = useLocale();
  const online = useOnline();
  const profile = useProfileState();
  const ready = profile === "ready";
  const id = habitId as Id<"habits">;
  const today = useMemo(() => new Date(todayMs), [todayMs]);
  const range = useMemo(() => {
    const grid = buildSixWeekGrid(today, new Set());
    return { fromLocalDate: grid[0][0].localDate, toLocalDate: grid[5][6].localDate };
  }, [today]);
  const habit = useQuery(api.habits.get, ready ? { habitId: id } : "skip");
  const checkIns = useQuery(
    api.habitCheckIns.listForHabit,
    ready ? { habitId: id, ...range } : "skip"
  );
  const loading =
    profile === "loading" || (ready && (habit === undefined || checkIns === undefined));

  let body: ReactNode;
  if (loading) {
    body = (
      <>
        {online ? null : <StateOffline />}
        <StateLoading label={t("hd.loading")} rows={LOADING_ROWS} />
      </>
    );
  } else if (profile === "signed-out") {
    body = <StateSignedOut />;
  } else if (!habit) {
    body = <StateEmpty icon="habit" title={t("hd.gone")} />;
  } else {
    body = <DetailBody habit={habit} checkIns={checkIns ?? []} today={today} online={online} />;
  }

  return (
    <div className="tp-page" data-component="PageLayout">
      <BackLink />
      {body}
    </div>
  );
}

function DetailBody({
  habit,
  checkIns,
  today,
  online,
}: {
  habit: Doc<"habits">;
  checkIns: readonly { localDate: string }[];
  today: Date;
  online: boolean;
}) {
  const { t, lang } = useLocale();
  const check = useMutation(api.habitCheckIns.check);
  const undo = useMutation(api.habitCheckIns.undo);
  const update = useMutation(api.habits.update);
  // Optimistic toggles: localDate -> wanted state, until the server agrees.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const busy = useRef(new Set<string>());
  const [saveError, setSaveError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const server = useMemo(() => new Set(checkIns.map((row) => row.localDate)), [checkIns]);
  useEffect(() => {
    setPending((prev) => settlePending(prev, (localDate) => server.has(localDate)));
  }, [server]);
  const logged = useMemo(() => withPending(server, pending), [server, pending]);
  const grid = useMemo(() => buildSixWeekGrid(today, logged), [today, logged]);
  const todayKey = toLocalDateKey(today);
  const gridStartKey = grid[0][0].localDate;
  const summary = detailSummary({
    gridStartKey,
    todayKey,
    createdKey: toLocalDateKey(new Date(habit.createdAt)),
    logged,
  });
  const anyLogged = [...logged].some((key) => key >= gridStartKey && key <= todayKey);
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const toggle = (localDate: string) => {
    if (busy.current.has(localDate) || localDate > todayKey) return;
    const next = !logged.has(localDate);
    busy.current.add(localDate);
    setSaveError(false);
    setPending((prev) => new Map(prev).set(localDate, next));
    const action = next
      ? check({ habitId: habit._id, localDate, source: "habits", asOfLocalDate: todayKey })
      : undo({ habitId: habit._id, localDate, asOfLocalDate: todayKey });
    // Convex resolves a mutation once the queries show its writes, so the optimistic entry can go
    // either way: on success the server now agrees, on failure the circle goes back.
    action
      .catch(() => setSaveError(true))
      .finally(() => {
        busy.current.delete(localDate);
        setPending((prev) => {
          if (!prev.has(localDate)) return prev;
          const map = new Map(prev);
          map.delete(localDate);
          return map;
        });
      });
  };

  const longDate = (cell: SixWeekCell) =>
    parseLocalDate(cell.localDate)?.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }) ?? cell.localDate;

  return (
    <>
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title" dir="auto">
            {habit.name}
          </h1>
          <p className="tp-pagehead__sub">
            {habit.cadence === "weekly" ? t("hd.sub.weekly") : t("hd.sub.daily")}
          </p>
        </div>
        <div className="tp-pagehead__actions">
          <button
            className="tp-btn tp-btn--ghost"
            type="button"
            aria-controls="edit-habit"
            aria-expanded={editOpen}
            onClick={() => setEditOpen(true)}
          >
            <TpIcon name="edit" size="sm" />
            <span>{t("hb.edit")}</span>
          </button>
        </div>
      </header>

      {online ? null : <StateOffline />}
      {saveError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("hr.saveError")}</span>
        </p>
      ) : null}
      {anyLogged ? null : (
        <StateEmpty icon="habit" title={t("hd.empty.t")} body={t("hd.empty.b")} />
      )}

      <div className="hd-stack">
        <section
          className="tp-surface tp-block-habit"
          data-component="HabitBlock"
          aria-labelledby="hd-grid-title"
        >
          <div
            className="tp-habit hd-card"
            data-habit={habit._id}
            data-logged={String(summary.todayLogged)}
          >
            <div className="tp-habit__head">
              <h2 className="tp-habit__name tp-h3" id="hd-grid-title">
                {t("hd.grid")}
              </h2>
              <span className="tp-habit__when">
                <span>{t("hd.today")}</span>{" "}
                <span>
                  {today.toLocaleDateString(locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </span>
              <button
                className="tp-btn tp-btn--primary tp-habit__log"
                type="button"
                aria-pressed={summary.todayLogged}
                data-component="Button"
                onClick={() => toggle(todayKey)}
              >
                <TpIcon name="check" size="sm" />
                <span>{summary.todayLogged ? t("hb.logged") : t("hb.log")}</span>
              </button>
            </div>

            {/* biome-ignore lint/a11y/useSemanticElements: the design's labelled grid group; a fieldset would add a form box around it */}
            <div
              className="hd-grid"
              role="group"
              aria-labelledby="hd-grid-title"
              data-testid="habit-six-week-grid"
            >
              <div className="hd-row" aria-hidden="true">
                <span />
                <ol className="tp-habit-days">
                  {DOW_MONDAY_FIRST.map((key) => (
                    <li key={key} className="tp-habit-day">
                      <span className="tp-habit-day__label">{t(key)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {grid.map((week, index) => {
                const start = parseLocalDate(week[0].localDate) ?? today;
                const label =
                  index === grid.length - 1
                    ? t("hd.thisweek")
                    : fillTemplate(t("hd.week"), {
                        date: start.toLocaleDateString(locale, { day: "numeric", month: "long" }),
                      });
                return (
                  <div className="hd-row" key={week[0].localDate} data-week={week[0].localDate}>
                    <span className="tp-small tp-muted">
                      {dayMonth.formatToParts(start).map((part, k) =>
                        part.type === "day" ? (
                          <span key={k} className="tp-num">
                            {part.value}
                          </span>
                        ) : (
                          <Fragment key={k}>{part.value}</Fragment>
                        )
                      )}
                    </span>
                    <ol className="tp-habit-days" aria-label={label}>
                      {week.map((cell) => {
                        const day = Number(cell.localDate.slice(8));
                        if (cell.isFuture) {
                          return (
                            <li key={cell.localDate} className="tp-habit-day" aria-hidden="true">
                              <span className="tp-habit-day__label tp-num">{day}</span>
                            </li>
                          );
                        }
                        return (
                          <li
                            key={cell.localDate}
                            className="tp-habit-day"
                            data-done={String(cell.checked)}
                            data-today={cell.isToday ? "true" : undefined}
                          >
                            <button
                              type="button"
                              className="hd-day"
                              aria-pressed={cell.checked}
                              aria-current={cell.isToday ? "date" : undefined}
                              onClick={() => toggle(cell.localDate)}
                            >
                              <span className="tp-habit-day__dot" aria-hidden="true">
                                <TpIcon name="check" />
                              </span>
                              <span className="tp-habit-day__label tp-num" aria-hidden="true">
                                {day}
                              </span>
                              <span className="tp-sr-only">
                                {longDate(cell)}, {cell.checked ? t("hb.dayDone") : t("hb.dayOpen")}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                );
              })}
            </div>

            <output className="tp-habit__summary" id="hd-summary" data-component="ChartSummary">
              {summary.logged > 0 && summary.total > 1 ? (
                <>
                  <Template
                    template={t("hd.sum")}
                    slots={{
                      n: <span className="tp-num">{summary.logged}</span>,
                      total: <span className="tp-num">{summary.total}</span>,
                    }}
                  />{" "}
                </>
              ) : null}
              {summary.easiestWeekday === null ? null : (
                <>{t(EASIEST[summary.easiestWeekday] ?? "hd.easy.0")} </>
              )}
              {summary.todayLogged ? t("hd.todayDone") : t("hd.todayOpen")}
            </output>
          </div>
        </section>
      </div>

      {editOpen ? (
        <HabitSheet
          id="edit-habit"
          title={t("hb.edit")}
          initial={{ name: habit.name, cadence: habit.cadence }}
          submitVariant="secondary"
          onSubmit={async ({ name, cadence }) => {
            await update({ habitId: habit._id, name, cadence });
          }}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </>
  );
}
