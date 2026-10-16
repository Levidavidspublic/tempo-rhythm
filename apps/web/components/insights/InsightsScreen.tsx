"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { PANELUI_TOKENS } from "@/components/notes/WeekGlanceView";
import { type DayCell, DayGrid } from "@/components/panelui/day-grid";
import { Kpi } from "@/components/panelui/kpi";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import {
  RetryRoot,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useLoadingTimeout,
} from "@/components/you/ScreenStates";
import { api } from "@/convex/_generated/api";
import type { MessageKey } from "@/lib/i18n";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { formatMinutes } from "@/lib/week-glance";
import {
  countInWindow,
  derivePatterns,
  INSIGHTS_RANGES,
  type InsightPattern,
  type InsightsRange,
  isInsightsRange,
  isoWeek,
  needsMoreTime,
  peakIndex,
  type RangeWindow,
  rangeWindow,
  summarizeWeekdays,
  type WeekdayBar,
  weekdayBars,
} from "@/lib/you/insights";
import { deriveScreenState, fill } from "@/lib/you/screenState";
import { type InsightsGlance, insightsGlance } from "./insightsState";

/**
 * Insights (docs/design/v3/screens/web/insights.html): gentle patterns, then the weeks at a
 * glance as PanelUI KPI cards and a Day Grid (like a weekly page's glance), from the person's
 * own tasks and focus sessions. Read only. Never streaks, scores or comparisons; a quiet week
 * is described, not judged.
 */

const DAY_KEYS = [
  "ins.d.0",
  "ins.d.1",
  "ins.d.2",
  "ins.d.3",
  "ins.d.4",
  "ins.d.5",
  "ins.d.6",
] as const;
const DAYS_PLURAL = [
  "ins.dp.0",
  "ins.dp.1",
  "ins.dp.2",
  "ins.dp.3",
  "ins.dp.4",
  "ins.dp.5",
  "ins.dp.6",
] as const;
const RANGE_LABEL: Record<InsightsRange, MessageKey> = {
  "2w": "ins.r2w",
  "4w": "ins.r4w",
  "3m": "ins.r3m",
};
/** Each range option's accessible name: its visible label, in full ("Last 2 weeks"). */
const RANGE_NAME: Record<InsightsRange, MessageKey> = {
  "2w": "ins.r2w.name",
  "4w": "ins.r4w.name",
  "3m": "ins.r3m.name",
};
/** Sparklines run with time: in Hebrew the oldest week is on the right, like the Day Grid. */
const RTL_FLIP = "rtl:-scale-x-100";
const RANGE_SUB: Record<InsightsRange, MessageKey> = {
  "2w": "ins.sub.2w",
  "4w": "ins.sub.4w",
  "3m": "ins.sub.3m",
};
const PATTERN_ICON: Record<InsightPattern["kind"], TpIconName> = {
  morning: "sun",
  later: "moon",
  short: "clock",
  sessions: "energy",
};

/** The range lives in `?range=`, read once on mount and replaced (not pushed) on change. */
function useRange(): [InsightsRange, (next: InsightsRange) => void] {
  const [range, setRange] = useState<InsightsRange>("4w");
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("range");
    if (isInsightsRange(param)) setRange(param);
  }, []);
  const choose = (next: InsightsRange) => {
    setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set("range", next);
    window.history.replaceState(window.history.state, "", url);
  };
  return [range, choose];
}

/**
 * The range choice: v3's Segmented radiogroup (components/you/Controls.tsx), with each option
 * named in full, so "Last 2 weeks" finds it by role or by label. Arrow keys move and choose,
 * wrapping, and swap direction in RTL.
 */
function RangePicker({
  value,
  onChange,
}: {
  value: InsightsRange;
  onChange: (next: InsightsRange) => void;
}) {
  const { t } = useLocale();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = INSIGHTS_RANGES[(index + step + INSIGHTS_RANGES.length) % INSIGHTS_RANGES.length];
    if (!next) return;
    onChange(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelector<HTMLButtonElement>(`[data-range="${next}"]`)?.focus()
    );
  };
  return (
    <div
      className="tp-segmented"
      role="radiogroup"
      aria-label={t("ins.range")}
      data-component="Segmented"
    >
      {INSIGHTS_RANGES.map((range, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={range}
          className="tp-seg__opt"
          type="button"
          role="radio"
          data-range={range}
          aria-checked={value === range}
          aria-label={t(RANGE_NAME[range])}
          tabIndex={value === range ? 0 : -1}
          onClick={() => onChange(range)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <span>{t(RANGE_LABEL[range])}</span>
        </button>
      ))}
    </div>
  );
}

export function InsightsScreen() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={(retry) => <InsightsContent onRetry={retry} />}
      fallback={(retry) => (
        <div className="tp-page tp-page--wide" data-component="PageLayout">
          <InsightsHead sub={t("ins.sub.4w")} />
          <StateError title={t("ins.error")} body={t("you.safe")} onRetry={retry} />
        </div>
      )}
    />
  );
}

function InsightsHead({ sub }: { sub: string }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("ins.title")}</h1>
        <p className="tp-pagehead__sub">{sub}</p>
      </div>
    </header>
  );
}

function InsightsContent({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  const [range, setRange] = useRange();
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // tasks.list and focusBlocks.listInRange call requireUser: wait for the users row.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const ready = isAuthenticated && profile != null;
  // One focus query for the longest range; switching ranges filters it locally.
  const widest = useMemo(() => rangeWindow("3m", new Date(bounds.startMs)), [bounds.startMs]);
  const tasks = useQuery(api.tasks.list, ready ? {} : "skip");
  const blocks = useQuery(
    api.focusBlocks.listInRange,
    ready ? { startMs: widest.startMs, endMs: widest.endMs } : "skip"
  );
  const data = tasks === undefined || blocks === undefined ? undefined : { tasks, blocks };
  const input = { isAuthLoading, isAuthenticated, profile, data };
  const timedOut = useLoadingTimeout(deriveScreenState({ ...input, failed: false }) === "loading");
  const state = deriveScreenState({ ...input, failed: timedOut });

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <InsightsHead sub={t(RANGE_SUB[range])} />
      {state === "ready" ? (
        <div className="tp-toolbar" data-component="Toolbar">
          <RangePicker value={range} onChange={setRange} />
        </div>
      ) : null}
      <StateOffline />
      {state === "loading" ? <StateLoading label={t("ins.loading")} /> : null}
      {state === "error" ? (
        <StateError title={t("ins.error")} body={t("you.safe")} onRetry={onRetry} />
      ) : null}
      {state === "signed-out" ? <StateSignedOut body={t("ins.signedOut")} /> : null}
      {state === "ready" && data ? (
        <InsightsBody
          range={range}
          dayStartMs={bounds.startMs}
          profileCreatedMs={profile?._creationTime}
          tasks={data.tasks}
          blocks={data.blocks}
        />
      ) : null}
    </div>
  );
}

type TaskRow = {
  status: "todo" | "in_progress" | "done" | "cancelled";
  completedAt?: number;
  timeEstimate?: number;
  createdAt: number;
};
type BlockRow = { startedAtMs: number; durationMs: number };

function InsightsBody({
  range,
  dayStartMs,
  profileCreatedMs,
  tasks,
  blocks,
}: {
  range: InsightsRange;
  dayStartMs: number;
  profileCreatedMs: number | undefined;
  tasks: readonly TaskRow[];
  blocks: readonly BlockRow[];
}) {
  const { t } = useLocale();
  const win = useMemo(() => rangeWindow(range, new Date(dayStartMs)), [range, dayStartMs]);
  const counts = countInWindow(tasks, blocks, win.startMs, win.endMs);

  if (needsMoreTime({ profileCreatedMs, nowMs: Date.now(), ...counts })) {
    return (
      <StateEmpty
        icon="chart"
        title={t("ins.empty.t")}
        body={t("ins.empty.b")}
        action={
          <Link className="tp-btn tp-btn--secondary" href="/today">
            <TpIcon name="today" size="sm" />
            <span>{t("ins.empty.a")}</span>
          </Link>
        }
      />
    );
  }

  const patterns = derivePatterns({ tasks, blocks, startMs: win.startMs, endMs: win.endMs });
  return (
    <>
      <section className="tp-section" data-component="Section" aria-labelledby="ins-pat-h">
        <div className="tp-section__head">
          <h2 className="tp-section__title" id="ins-pat-h">
            {t("ins.pat.h")}
          </h2>
          <span className="tp-section__count">
            <span className="tp-num">{patterns.length}</span> {t("ins.pat.n")}
          </span>
        </div>
        {patterns.length === 0 ? (
          <p className="tp-muted tp-small">{t("ins.pat.none")}</p>
        ) : (
          <div className="tp-cards" data-component="CardGrid">
            {patterns.map((pattern) => (
              <PatternCard key={pattern.kind} pattern={pattern} />
            ))}
          </div>
        )}
      </section>

      <WeeksGlance tasks={tasks} blocks={blocks} win={win} />
    </>
  );
}

function patternCopy(pattern: InsightPattern, t: (key: MessageKey) => string) {
  switch (pattern.kind) {
    case "morning":
      return {
        title: t("ins.p.morning.t"),
        body: fill(t("ins.p.morning.b"), { a: pattern.matched, b: pattern.total }),
        basis: fill(t("ins.p.finished.m"), { b: pattern.total }),
      };
    case "later":
      return {
        title: t("ins.p.later.t"),
        body: fill(t("ins.p.later.b"), { a: pattern.matched, b: pattern.total }),
        basis: fill(t("ins.p.finished.m"), { b: pattern.total }),
      };
    case "short":
      return { title: t("ins.p.short.t"), body: t("ins.p.short.b"), basis: t("ins.p.short.m") };
    case "sessions":
      return {
        title: fill(t("ins.p.sessions.t"), { m: pattern.averageMinutes }),
        body: t("ins.p.sessions.b"),
        basis: fill(t("ins.p.sessions.m"), { n: pattern.total }),
      };
  }
}

function PatternCard({ pattern }: { pattern: InsightPattern }) {
  const { t } = useLocale();
  const copy = patternCopy(pattern, t);
  return (
    <article className="tp-card ins-card" data-component="Card">
      <div className="tp-card__head">
        <TpIcon name={PATTERN_ICON[pattern.kind]} size="sm" />
        <h3 className="tp-card__title">{copy.title}</h3>
      </div>
      <p>{copy.body}</p>
      <p className="tp-small tp-muted">{copy.basis}</p>
    </article>
  );
}

/** The weekday sentence the old bar chart carried: which days were fullest (copy unchanged). */
function weekdaySentence(bars: readonly WeekdayBar[], t: (key: MessageKey) => string): string {
  const summary = summarizeWeekdays(bars);
  if (summary.kind === "none") return t("ins.bar.none");
  if (summary.kind === "even") return t("ins.bar.even");
  const [a = "", b] = summary.days.map((day) => t(DAYS_PLURAL[day] ?? "ins.dp.0"));
  const text = b ? fill(t("ins.bar.top2"), { a, b }) : fill(t("ins.bar.top1"), { a });
  return summary.weekendLight ? `${text} ${t("ins.bar.light")}` : text;
}

/** The focus sentence the old line chart carried: the fullest week, and a week still going. */
function focusSentence(
  minutes: readonly number[],
  weekStarts: readonly number[],
  t: (key: MessageKey) => string
): string {
  const weeks = weekStarts.map((start) => isoWeek(start));
  const last = minutes.length - 1;
  const peak = peakIndex(minutes);
  if (peak < 0) return t("ins.line.none");
  const text = fill(t("ins.line.peak"), { m: minutes[peak] ?? 0, w: weeks[peak] ?? "" });
  return peak === last ? text : `${text} ${fill(t("ins.line.now"), { w: weeks[last] ?? "" })}`;
}

/**
 * "Your weeks at a glance": PanelUI KPI cards for tasks finished and focus time, each with a
 * week-by-week sparkline, and a Day Grid of every day in the range, like a weekly page's
 * glance (components/notes/WeekGlanceView.tsx). The caption keeps the old charts' sentences.
 */
function WeeksGlance({
  tasks,
  blocks,
  win,
}: {
  tasks: readonly TaskRow[];
  blocks: readonly BlockRow[];
  win: RangeWindow;
}) {
  const { t } = useLocale();
  const glance = useMemo(() => insightsGlance(tasks, blocks, win), [tasks, blocks, win]);
  const minutes = { min: t("wk.min"), hmin: t("wk.hmin") };
  return (
    <section
      className="tp-section"
      data-component="InsightsGlance"
      aria-labelledby="ins-ch-h"
      style={PANELUI_TOKENS}
    >
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="ins-ch-h">
          {t("ins.ch.h")}
        </h2>
      </div>
      <figure className="tp-chart">
        {/* Phones: the two numbers side by side, the days below. Wide screens: one row. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi surface data-component="StatCard" data-stat="finished">
            <Kpi.Header>
              <Kpi.Title>{t("wk.done")}</Kpi.Title>
            </Kpi.Header>
            <Kpi.Content>
              <Kpi.Value className="tp-num">{glance.finished}</Kpi.Value>
            </Kpi.Content>
            <Kpi.Chart
              data={glance.finishedByWeek}
              filled
              aria-label={t("ins.doneTrend")}
              className={`mt-auto ${RTL_FLIP}`}
            />
          </Kpi>
          <Kpi surface data-component="StatCard" data-stat="focus">
            <Kpi.Header>
              <Kpi.Title>{t("wk.focus")}</Kpi.Title>
            </Kpi.Header>
            <Kpi.Content>
              <Kpi.Value className="tp-num">
                {formatMinutes(glance.focusMinutes, minutes)}
              </Kpi.Value>
            </Kpi.Content>
            <Kpi.Chart
              data={glance.focusByWeek}
              color="success"
              filled
              aria-label={t("ins.line.t")}
              className={`mt-auto ${RTL_FLIP}`}
            />
          </Kpi>
          <Kpi surface className="col-span-2" data-component="StatCard" data-stat="days">
            <Kpi.Header>
              <Kpi.Title>{t("wk.days")}</Kpi.Title>
            </Kpi.Header>
            <DaysGrid glance={glance} weeks={win.weekStarts.length} />
            <DayGrid.Legend less={t("wk.less")} more={t("wk.more")} />
          </Kpi>
        </div>
        <figcaption className="tp-chart__summary" data-component="ChartSummary">
          <span className="block">
            {weekdaySentence(weekdayBars(tasks, win.startMs, win.endMs), t)}
          </span>
          <span className="block">{focusSentence(glance.focusByWeek, win.weekStarts, t)}</span>
        </figcaption>
      </figure>
      <div className="tp-notice" data-tone="info" data-component="Notice">
        <span className="tp-notice__icon">
          <TpIcon name="heart" size="sm" />
        </span>
        <span className="tp-notice__text">
          <span className="tp-notice__title">{t("ins.nostreak.t")}</span>
          <span>{t("ins.nostreak.b")}</span>
        </span>
      </div>
    </section>
  );
}

/**
 * The Day Grid with the weekday names along it, Monday first. Up to seven weeks read like a
 * calendar, a row per week; three months get a column per week, so the grid stays short on a
 * phone. The grid and the names both run right to left in Hebrew.
 */
function DaysGrid({ glance, weeks }: { glance: InsightsGlance; weeks: number }) {
  const { t, lang } = useLocale();
  const dayName = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const cells: DayCell[] = glance.days.map((day) => ({
    level: day.level,
    label: fill(t("wk.day"), {
      day: dayName.format(new Date(day.startMs)),
      n: day.done,
      m: day.focusMinutes,
    }),
  }));
  const summary = fill(t("ins.grid.summary"), { a: glance.activeDays, n: glance.days.length });
  const names = DAY_KEYS.map((key) => t(key));
  if (weeks <= 7) {
    return (
      <div className="grid w-full max-w-sm gap-1" data-component="DayGrid">
        <div
          className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground"
          aria-hidden="true"
        >
          {names.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <DayGrid cells={cells} columns={7} label={t("wk.days")} summary={summary} />
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-sm gap-2" data-component="DayGrid">
      <div
        className="grid grid-rows-7 gap-1 text-xs leading-none text-muted-foreground"
        aria-hidden="true"
      >
        {names.map((name) => (
          <span key={name} className="flex items-center">
            {name}
          </span>
        ))}
      </div>
      <DayGrid
        className="min-w-0 flex-1"
        cells={cells}
        rows={7}
        label={t("wk.days")}
        summary={summary}
      />
    </div>
  );
}
