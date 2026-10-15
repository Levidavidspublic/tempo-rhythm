"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { Segmented } from "@/components/you/Controls";
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
import {
  countInWindow,
  derivePatterns,
  focusMinutesByWeek,
  INSIGHTS_RANGES,
  type InsightPattern,
  type InsightsRange,
  isInsightsRange,
  isLabelled,
  isoWeek,
  linePoints,
  needsMoreTime,
  peakIndex,
  rangeWindow,
  summarizeWeekdays,
  weekdayBars,
} from "@/lib/you/insights";
import { deriveScreenState, fill } from "@/lib/you/screenState";

/**
 * Insights (docs/design/v3/screens/web/insights.html): gentle patterns and two simple charts
 * from the person's own tasks and focus sessions. Read only. Never streaks, scores or
 * comparisons; a quiet week is described, not judged.
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
          <Segmented
            label={t("ins.range")}
            value={range}
            onChange={setRange}
            options={INSIGHTS_RANGES.map((value) => ({ value, label: t(RANGE_LABEL[value]) }))}
          />
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

      <section className="tp-section" aria-labelledby="ins-ch-h">
        <div className="tp-section__head">
          <h2 className="tp-section__title" id="ins-ch-h">
            {t("ins.ch.h")}
          </h2>
        </div>
        <div className="ins-charts">
          <WeekdayChart tasks={tasks} startMs={win.startMs} endMs={win.endMs} />
          <FocusChart blocks={blocks} weekStarts={win.weekStarts} endMs={win.endMs} />
        </div>
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

function WeekdayChart({
  tasks,
  startMs,
  endMs,
}: {
  tasks: readonly TaskRow[];
  startMs: number;
  endMs: number;
}) {
  const { t } = useLocale();
  const bars = weekdayBars(tasks, startMs, endMs);
  const summary = summarizeWeekdays(bars);
  let text: string;
  if (summary.kind === "none") text = t("ins.bar.none");
  else if (summary.kind === "even") text = t("ins.bar.even");
  else {
    const [a = "", b] = summary.days.map((day) => t(DAYS_PLURAL[day] ?? "ins.dp.0"));
    text = b ? fill(t("ins.bar.top2"), { a, b }) : fill(t("ins.bar.top1"), { a });
    if (summary.weekendLight) text = `${text} ${t("ins.bar.light")}`;
  }
  return (
    <figure className="tp-chart tp-surface" data-component="BarChart" aria-labelledby="ins-bar-t">
      <div className="tp-chart__title" id="ins-bar-t">
        {t("ins.bar.t")}
      </div>
      <ol className="tp-chart__bars">
        {bars.map((bar) => (
          <li
            className="tp-chart__bar"
            key={bar.day}
            data-highlight={bar.highlight ? "true" : undefined}
          >
            <span className="tp-chart__value">{bar.value}</span>
            <span className="tp-chart__track">
              <span className="tp-chart__fill" style={{ "--pct": bar.pct } as CSSProperties} />
            </span>
            <span className="tp-chart__label">{t(DAY_KEYS[bar.day] ?? "ins.d.0")}</span>
          </li>
        ))}
      </ol>
      <figcaption className="tp-chart__summary" data-component="ChartSummary">
        {text}
      </figcaption>
    </figure>
  );
}

function FocusChart({
  blocks,
  weekStarts,
  endMs,
}: {
  blocks: readonly BlockRow[];
  weekStarts: readonly number[];
  endMs: number;
}) {
  const { t } = useLocale();
  const minutes = focusMinutesByWeek(blocks, weekStarts, endMs);
  const points = linePoints(minutes);
  const weeks = weekStarts.map((start) => isoWeek(start));
  const last = points.length - 1;
  const peak = peakIndex(minutes);
  let summary = t("ins.line.none");
  if (peak >= 0) {
    summary = fill(t("ins.line.peak"), { m: minutes[peak] ?? 0, w: weeks[peak] ?? "" });
    if (peak !== last) summary = `${summary} ${fill(t("ins.line.now"), { w: weeks[last] ?? "" })}`;
  }
  return (
    <figure className="tp-chart tp-surface" data-component="LineChart">
      <div className="tp-chart__title">{t("ins.line.t")}</div>
      <svg className="tp-chart__svg" viewBox="0 0 400 210" role="img" aria-labelledby="ins-line-s">
        <line className="tp-chart__grid" x1="30" y1="20" x2="390" y2="20" />
        <line className="tp-chart__grid" x1="30" y1="100" x2="390" y2="100" />
        <line className="tp-chart__axis" x1="30" y1="180" x2="390" y2="180" />
        <polyline
          className="tp-chart__line"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        />
        {points.map((point, i) => (
          <g key={weekStarts[i]}>
            <circle className="tp-chart__point" cx={point.x} cy={point.y} r="5">
              <title>{fill(t("ins.point"), { w: weeks[i] ?? "", m: point.value })}</title>
            </circle>
            {isLabelled(i, points.length) ? (
              <>
                <text x={point.x} y={point.y - 14} textAnchor="middle">
                  {point.value}
                </text>
                <text x={point.x} y="202" textAnchor="middle">
                  {fill(t(i === last ? "ins.wkNow" : "ins.wk"), { n: weeks[i] ?? "" })}
                </text>
              </>
            ) : null}
          </g>
        ))}
      </svg>
      <figcaption className="tp-chart__summary" id="ins-line-s" data-component="ChartSummary">
        {summary}
      </figcaption>
    </figure>
  );
}
