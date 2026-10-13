"use client";

import { isHabitCompletedOnUtcDay } from "@/convex/lib/habitStreak";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { HABIT_NAME_MAX, habitHref } from "@/components/habits-library/habitForm";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { fillTemplate, type LocalDay, lastLocalDays, settlePending } from "@/lib/habits-view";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { HabitEnergySuggestions } from "./HabitEnergySuggestions";
import { type HabitDraft, HabitSheet } from "./HabitSheet";
import {
  ScreenErrorBoundary,
  type SkeletonRow,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useOnline,
  useProfileState,
} from "./ScreenStates";
import { UNDO_WINDOW_MS, UndoToast } from "./UndoToast";

const LOADING_ROWS: readonly SkeletonRow[] = [
  ["w60", "w100"],
  ["w40", "w100"],
  ["w80", "w100"],
  ["w60", "w100"],
];

const DOW = [
  "hr.dow.0",
  "hr.dow.1",
  "hr.dow.2",
  "hr.dow.3",
  "hr.dow.4",
  "hr.dow.5",
  "hr.dow.6",
] as const;

type HabitRow = Doc<"habits">;
type CheckInRow = { habitId: string; localDate: string };

/**
 * Habits (docs/design/v3/screens/web/habits.html): each habit with Log today and its last 7
 * local days, filled circle = logged, empty ring = not logged. No streak counter anywhere.
 *
 * Left out until habits can store them (convex/schema.ts has name + daily/weekly cadence only):
 * "when it usually happens" (the rhythm shows in its place), the Weekdays rhythm, and the
 * "Welcome back — start fresh?" notice with Start fresh / Pause it (no habits.startFresh or
 * habits.pause). See the v3 build report.
 */
export function HabitsScreen() {
  // A new local day starts the screen afresh (today's circle, the date line, suggestions).
  const bounds = useLocalDayBounds();
  return (
    <ScreenErrorBoundary fallback={(retry) => <HabitsFailed onRetry={retry} />}>
      <HabitsContent key={bounds.startMs} todayMs={bounds.startMs} />
    </ScreenErrorBoundary>
  );
}

function HabitsHeader({ children }: { children?: ReactNode }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("hb.title")}</h1>
        <p className="tp-pagehead__sub">{t("hb.sub")}</p>
      </div>
      {children ? <div className="tp-pagehead__actions">{children}</div> : null}
    </header>
  );
}

function HabitsFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <HabitsHeader />
      <StateError title={t("hb.error")} onRetry={onRetry} />
    </div>
  );
}

/** Check-ins for the last 7 local days: one subscription per day, shared with Today's strip. */
function useWeekCheckIns(days: readonly LocalDay[], ready: boolean): CheckInRow[] | undefined {
  const args = (index: number) => {
    const day = days[index];
    return ready && day ? { localDate: day.localDate } : ("skip" as const);
  };
  const d0 = useQuery(api.habitCheckIns.listForDate, args(0));
  const d1 = useQuery(api.habitCheckIns.listForDate, args(1));
  const d2 = useQuery(api.habitCheckIns.listForDate, args(2));
  const d3 = useQuery(api.habitCheckIns.listForDate, args(3));
  const d4 = useQuery(api.habitCheckIns.listForDate, args(4));
  const d5 = useQuery(api.habitCheckIns.listForDate, args(5));
  const d6 = useQuery(api.habitCheckIns.listForDate, args(6));
  return useMemo(() => {
    const week = [d0, d1, d2, d3, d4, d5, d6];
    if (week.some((day) => day === undefined)) return undefined;
    return week.flatMap((day) => day ?? []);
  }, [d0, d1, d2, d3, d4, d5, d6]);
}

function HabitsContent({ todayMs }: { todayMs: number }) {
  const { t, lang } = useLocale();
  const online = useOnline();
  const profile = useProfileState();
  const ready = profile === "ready";
  const today = useMemo(() => new Date(todayMs), [todayMs]);
  const days = useMemo(() => lastLocalDays(today, 7), [today]);
  const todayKey = days[days.length - 1]?.localDate ?? "";
  const habits = useQuery(api.habits.list, ready ? {} : "skip");
  const checkIns = useWeekCheckIns(days, ready);
  const create = useMutation(api.habits.create);
  const remove = useMutation(api.habits.remove);
  const check = useMutation(api.habitCheckIns.check);
  const undo = useMutation(api.habitCheckIns.undo);

  // Optimistic Log today: habitId -> wanted state, until the server agrees.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const busy = useRef(new Set<string>());
  const [saveError, setSaveError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<{ habitId: Id<"habits">; undoUntilMs: number } | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickInvalid, setQuickInvalid] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);

  const live = useMemo<HabitRow[]>(
    () =>
      (habits ?? [])
        .filter((habit) => habit.deletedAt === undefined)
        // Newest first and steady: logging a habit must not move its card.
        .sort((a, b) => b.createdAt - a.createdAt),
    [habits]
  );
  const loggedByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of checkIns ?? []) {
      const dates = map.get(row.habitId) ?? new Set<string>();
      dates.add(row.localDate);
      map.set(row.habitId, dates);
    }
    return map;
  }, [checkIns]);

  useEffect(() => {
    setPending((prev) =>
      settlePending(prev, (habitId) => loggedByHabit.get(habitId)?.has(todayKey) ?? false)
    );
  }, [loggedByHabit, todayKey]);

  const loggedToday = (habitId: string) =>
    pending.get(habitId) ?? loggedByHabit.get(habitId)?.has(todayKey) ?? false;

  const toggle = (habitId: Id<"habits">) => {
    if (busy.current.has(habitId)) return;
    const next = !loggedToday(habitId);
    busy.current.add(habitId);
    setSaveError(false);
    setPending((prev) => new Map(prev).set(habitId, next));
    const action = next
      ? check({ habitId, localDate: todayKey, source: "habits", asOfLocalDate: todayKey })
      : undo({ habitId, localDate: todayKey, asOfLocalDate: todayKey });
    // Convex resolves a mutation once the queries show its writes, so the optimistic entry can go
    // either way: on success the server now agrees, on failure the circle goes back.
    action
      .catch(() => setSaveError(true))
      .finally(() => {
        busy.current.delete(habitId);
        setPending((prev) => {
          if (!prev.has(habitId)) return prev;
          const map = new Map(prev);
          map.delete(habitId);
          return map;
        });
      });
  };

  const addHabit = async ({ name, cadence }: HabitDraft) => {
    const habitId = await create({ name, cadence });
    setToast({ habitId, undoUntilMs: Date.now() + UNDO_WINDOW_MS });
  };

  const undoAdd = async () => {
    if (!toast) return;
    try {
      await remove({ habitId: toast.habitId });
      setToast(null);
    } catch {
      setSaveError(true);
    }
  };

  const quickAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (quickBusy) return;
    const name = quickName.trim();
    if (!name) {
      setQuickInvalid(true);
      return;
    }
    setQuickInvalid(false);
    setSaveError(false);
    setQuickBusy(true);
    addHabit({ name, cadence: "daily" })
      .then(() => setQuickName(""))
      .catch(() => setSaveError(true))
      .finally(() => setQuickBusy(false));
  };

  const state =
    profile === "loading" || (ready && (habits === undefined || checkIns === undefined))
      ? "loading"
      : profile === "signed-out"
        ? "signed-out"
        : live.length === 0
          ? "empty"
          : "default";

  const locale = lang === "he" ? "he-IL" : "en-GB";
  const newHabitButton = (
    <button
      className="tp-btn tp-btn--secondary"
      type="button"
      aria-controls="new-habit"
      aria-expanded={sheetOpen}
      data-component="Button"
      onClick={() => setSheetOpen(true)}
    >
      <TpIcon name="plus" size="sm" />
      <span>{t("hb.new")}</span>
    </button>
  );
  const loggedCount = live.filter((habit) => loggedToday(habit._id)).length;
  const now = Date.now();

  return (
    <div className="tp-page" data-component="PageLayout">
      <HabitsHeader>{state === "default" ? newHabitButton : null}</HabitsHeader>

      {online ? null : <StateOffline />}
      {saveError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("hr.saveError")}</span>
        </p>
      ) : null}

      {state === "loading" ? <StateLoading label={t("hb.loading")} rows={LOADING_ROWS} /> : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "empty" ? (
        <StateEmpty icon="habit" title={t("hb.empty.t")} body={t("hb.empty.b")}>
          {newHabitButton}
        </StateEmpty>
      ) : null}

      {state === "default" ? (
        <section className="tp-section" data-component="Section" aria-labelledby="hb-today">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="hb-today">
              <span>{t("hb.today")}</span> ·{" "}
              <span>
                {today.toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </h2>
            <span className="tp-section__count">
              <span className="tp-num">{loggedCount}</span> <span>{t("hb.of")}</span>{" "}
              <span className="tp-num">{live.length}</span> <span>{t("hb.loggedtoday")}</span>
            </span>
          </div>
          <p className="tp-muted tp-small">
            {fillTemplate(t("hb.localday"), {
              day: today.toLocaleDateString(locale, { weekday: "long" }),
            })}
          </p>
          <div className="hb-list">
            {live.map((habit) => (
              <HabitCard
                key={habit._id}
                habit={habit}
                days={days}
                logged={loggedByHabit.get(habit._id)}
                loggedToday={loggedToday(habit._id)}
                onLog={() => toggle(habit._id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {state === "default" || state === "empty" ? (
        <form className="tp-toolbar" data-component="Toolbar" noValidate onSubmit={quickAdd}>
          <div className="tp-field tp-toolbar__grow">
            <label className="tp-sr-only" htmlFor="habits-library-name">
              {t("hb.quick.label")}
            </label>
            <input
              className="tp-input"
              id="habits-library-name"
              type="text"
              dir="auto"
              autoComplete="off"
              maxLength={HABIT_NAME_MAX}
              placeholder={t("hb.nh.ph")}
              value={quickName}
              aria-invalid={quickInvalid || undefined}
              aria-describedby={quickInvalid ? "hb-quick-error" : undefined}
              onChange={(event) => setQuickName(event.target.value)}
            />
            {quickInvalid ? (
              <p className="tp-error-text" id="hb-quick-error">
                {t("hb.nh.err")}
              </p>
            ) : null}
          </div>
          <button className="tp-btn tp-btn--secondary" type="submit" disabled={quickBusy}>
            <TpIcon name="plus" size="sm" />
            <span>{t("hb.quick.add")}</span>
          </button>
        </form>
      ) : null}

      {state === "default" ? (
        <HabitEnergySuggestions
          localDate={todayKey}
          habits={live.map((habit) => ({
            _id: habit._id,
            name: habit.name,
            completedToday:
              loggedToday(habit._id) || isHabitCompletedOnUtcDay(habit.lastCompletedAt, now),
          }))}
        />
      ) : null}

      {sheetOpen ? (
        <HabitSheet
          id="new-habit"
          title={t("hb.new")}
          initial={{ name: "", cadence: "daily" }}
          onSubmit={addHabit}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {toast ? (
        <UndoToast
          key={toast.habitId}
          title={t("hb.added")}
          undoUntilMs={toast.undoUntilMs}
          onUndo={undoAdd}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

function HabitCard({
  habit,
  days,
  logged,
  loggedToday,
  onLog,
}: {
  habit: HabitRow;
  days: readonly LocalDay[];
  logged: ReadonlySet<string> | undefined;
  loggedToday: boolean;
  onLog: () => void;
}) {
  const { t } = useLocale();
  const nameId = `hb-${habit._id}-name`;
  const isDone = (day: LocalDay) =>
    day.isToday ? loggedToday : (logged?.has(day.localDate) ?? false);
  const count = days.filter(isDone).length;
  const label = loggedToday ? t("hb.logged") : t("hb.log");
  return (
    <article className="tp-surface tp-block-habit hb-card" data-component="HabitBlock">
      <div className="tp-habit" data-habit={habit._id} data-logged={String(loggedToday)}>
        <div className="tp-habit__head">
          <Link className="tp-habit__name" id={nameId} href={habitHref(habit._id)} dir="auto">
            {habit.name}
          </Link>
          <span className="tp-habit__when">
            {habit.cadence === "weekly" ? t("hb.rh.few") : t("hb.rh.most")}
          </span>
          <button
            className="tp-btn tp-btn--secondary tp-habit__log"
            type="button"
            aria-pressed={loggedToday}
            aria-describedby={nameId}
            // Starts with the visible label and keeps the older "Check … for today" / "Undo today's
            // check for …" wording the e2e sweep looks for. An aria-label, not hidden text, so the
            // habit name appears only once as text on the card.
            aria-label={`${label}${fillTemplate(t(loggedToday ? "hb.unlog.sr" : "hb.log.sr"), { name: habit.name })}`}
            onClick={onLog}
          >
            <TpIcon name="check" size="sm" />
            <span>{label}</span>
          </button>
        </div>
        <ol className="tp-habit-days" aria-label={t("hb.last7")}>
          {days.map((day) => {
            const done = isDone(day);
            return (
              <li
                key={day.localDate}
                className="tp-habit-day"
                data-done={String(done)}
                data-today={day.isToday ? "true" : undefined}
              >
                <span className="tp-habit-day__dot" aria-hidden="true">
                  <TpIcon name="check" />
                </span>
                <span className="tp-habit-day__label">
                  <span>{t(DOW[day.weekday] ?? "hr.dow.0")}</span>{" "}
                  <span className="tp-num">{day.day}</span>
                </span>
                <span className="tp-sr-only">{done ? t("hb.dayDone") : t("hb.dayOpen")}</span>
              </li>
            );
          })}
        </ol>
        <p className="tp-habit__summary">
          <span>{t("hb.sum1")}</span> <span className="tp-num">{count}</span>{" "}
          <span>{t("hb.sum2")}</span>
        </p>
      </div>
    </article>
  );
}
