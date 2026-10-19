"use client";

import "@/app/v3/kb-07.css";

import { useId, useRef, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { fill, goalStatus, linePoints, stepsByWeek, type WeekPoint, weeklySummary } from "@/lib/goals-projects";
import { translate, type Lang } from "@/lib/i18n";
import { translateKb07 } from "@/lib/i18n-groups/kb-07";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import {
  OfflineNotice,
  ScreenBoundary,
  Segmented,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  StatusBadge,
  useOnline,
  useQueryParam,
  useSignedIn,
} from "./shared";

const RANGES = ["4", "8"] as const;
type Range = (typeof RANGES)[number];
const isRange = (value: unknown): value is Range => value === "4" || value === "8";

/**
 * Goals · progress (docs/design/v3/screens/web/goals-progress.html): a quiet look back.
 * The weekly chart counts small steps (tasks) marked done each week. The design's "linked tasks
 * done, by goal" bar chart needs goals linked to tasks, which the schema doesn't have yet, so it
 * is left out; "In words" still lists every goal with its status.
 */
export function GoalsProgressScreen() {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--wide gp-stack" data-component="PageLayout">
          <ProgressHeader />
          <StateError title={t("gp.error")} onRetry={retry} />
        </div>
      )}
    >
      <ProgressContent />
    </ScreenBoundary>
  );
}

function ProgressHeader() {
  const { t } = useLocale();
  return (
    <>
      <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/goals">
        <TpIcon name="chevron" size="sm" className="tp-icon--back" />
        <span>{t("gd.back")}</span>
      </Link>
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("gp.title")}</h1>
          <p className="tp-pagehead__sub">{t("gp.sub")}</p>
        </div>
      </header>
    </>
  );
}

function ProgressContent() {
  const { t, lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const bounds = useLocalDayBounds();
  const [range, setRange] = useQueryParam<Range>("weeks", "4", isRange);
  const goals = useQuery(api.goals.list, signedIn === "ready" ? {} : "skip");
  const doneTasks = useQuery(api.tasks.list, signedIn === "ready" ? { status: "done" } : "skip");

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page tp-page--wide gp-stack" data-component="PageLayout">
        <ProgressHeader />
        <SignedOutState />
      </div>
    );
  }

  const loading = goals === undefined || doneTasks === undefined;
  const live = (goals ?? []).filter((goal) => goal.deletedAt === undefined);
  const points = stepsByWeek(doneTasks ?? [], bounds.startMs, Number(range));

  return (
    <div className="tp-page tp-page--wide gp-stack" data-component="PageLayout">
      <ProgressHeader />
      {online ? null : <OfflineNotice text={t("gp.offline")} />}

      {loading ? (
        <StateLoading label={t("gp.loading")} lead="block" rows={2} />
      ) : live.length === 0 ? (
        <StateEmpty
          icon="chart"
          title={t("gp.empty.title")}
          body={t("gp.empty.body")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/goals">
              <TpIcon name="flag" size="sm" />
              <span>{t("gp.empty.go")}</span>
            </Link>
          }
        />
      ) : (
        <div className="gp-stack">
          <div className="tp-toolbar" data-component="Toolbar">
            <span className="tp-label" id="gp-range-label">
              {t("gp.range")}
            </span>
            <Segmented
              options={RANGES}
              value={range}
              onChange={setRange}
              labelledBy="gp-range-label"
              render={(option) => (
                <span>
                  <span className="tp-num">{option}</span> <span>{t("gp.weeks")}</span>
                </span>
              )}
            />
          </div>

          <GoalProgressView points={points} lang={lang} />

          <section className="tp-section" data-component="Section" aria-labelledby="words-h">
            <div className="tp-section__head">
              <h2 className="tp-section__title" id="words-h">
                {t("gp.words.h")}
              </h2>
              <span className="tp-section__count">
                <span className="tp-num">{live.length}</span>
              </span>
            </div>
            <ul className="tp-list">
              {live.map((goal) => {
                const status = goalStatus(goal.status);
                return (
                  <li key={goal._id}>
                    <Link className="tp-list-row" href={`/goals/${goal._id}`} data-component="ListRow">
                      <span className="tp-list-row__icon">
                        <TpIcon name="flag" />
                      </span>
                      <span className="tp-list-row__body">
                        <span className="tp-list-row__title" dir="auto">
                          {goal.title}
                        </span>
                        {status === "resting" ? <span className="tp-list-row__meta">{t("gp.resting")}</span> : null}
                      </span>
                      <span className="tp-list-row__end">
                        <StatusBadge kind="goal" status={status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

type ProgressValuesProps = { readonly points: readonly WeekPoint[]; readonly lang: Lang };

function dateLabel(ms: number, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function tableDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The same calendar window labels the chart and its accessible table. */
export function ProgressRangeCaption({ points, lang, id }: ProgressValuesProps & { readonly id?: string }) {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const end = new Date(last.startMs);
  end.setDate(end.getDate() + 6);
  return (
    <p className="kb07-range" id={id}>
      {translateKb07(lang, "kb07.range", { start: dateLabel(first.startMs, lang), end: dateLabel(end.getTime(), lang) })}
    </p>
  );
}

export function GoalProgressTable({ points, lang, captionId }: ProgressValuesProps & { readonly captionId?: string }) {
  return (
    <details className="kb07-disclosure">
      <summary className="kb07-disclosure__trigger">{translateKb07(lang, "kb07.table.show")}</summary>
      <div className="kb07-disclosure__body">
        <table className="kb07-table" aria-describedby={captionId}>
          <thead>
            <tr>
              <th scope="col">{translateKb07(lang, "kb07.table.week")}</th>
              <th scope="col">{translateKb07(lang, "kb07.table.steps")}</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 ? (
              <tr><td colSpan={2}>{translateKb07(lang, "kb07.table.empty")}</td></tr>
            ) : points.map((point) => (
              <tr key={point.startMs}>
                <th scope="row"><time className="tp-num" dateTime={tableDate(point.startMs)}>{tableDate(point.startMs)}</time></th>
                <td><span className="tp-num" data-kb07-count={point.count}>{point.count}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function GoalProgressView({ points, lang }: ProgressValuesProps) {
  const rangeId = useId();
  return (
    <div className="kb07-progress gp-charts">
      <ProgressRangeCaption points={points} lang={lang} id={rangeId} />
      <WeeklyChart points={points} lang={lang} captionId={rangeId} />
      <GoalProgressTable points={points} lang={lang} captionId={rangeId} />
    </div>
  );
}

function WeeklyChart({ points, lang, captionId }: ProgressValuesProps & { readonly captionId?: string }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  const coords = linePoints(points);
  const summary = weeklySummary(points);
  const sentence = fill(t(summary.key), summary.params);
  return (
    <figure className="tp-chart tp-surface kb07-chart" data-component="LineChart" aria-describedby={captionId}>
      <div className="tp-chart__title">
        {t("gp.line.t")}
      </div>
      <svg className="tp-chart__svg" viewBox="0 0 400 210" aria-hidden="true" focusable="false">
        <line className="tp-chart__grid" x1="30" y1="40" x2="390" y2="40" />
        <line className="tp-chart__grid" x1="30" y1="110" x2="390" y2="110" />
        <line className="tp-chart__axis" x1="30" y1="180" x2="390" y2="180" />
        <polyline className="tp-chart__line" points={coords.map((p) => `${p.x},${p.y}`).join(" ")} />
        {coords.map((p) => (
          <circle key={`pt-${p.week}`} className="tp-chart__point" cx={p.x} cy={p.y} r="5" />
        ))}
        {coords.map((p) => (
          <text key={`val-${p.week}`} x={p.x} y={p.y - 14} textAnchor="middle">
            {p.count}
          </text>
        ))}
        {coords.map((p) => (
          <text key={`wk-${p.week}`} x={p.x} y="202" textAnchor="middle">
            {fill(t("gp.wk"), { n: p.week })}
          </text>
        ))}
      </svg>
      <figcaption className="tp-chart__summary" data-component="ChartSummary">
        {sentence}
      </figcaption>
    </figure>
  );
}

const galleryPoints: readonly WeekPoint[] = [0, 2, 1, 4, 0, 3, 2, 5].map((count, index) => ({
  startMs: Date.UTC(2026, 7, 31 + index * 7),
  week: 36 + index,
  count,
}));
type GalleryState = "default" | "empty" | "loading" | "error" | "disabled" | "overflow";
const galleryStates: readonly GalleryState[] = ["default", "empty", "loading", "error", "disabled", "overflow"];

/** Isolated browser fixture: fictional values, real chart/table views and working controls. */
export function Kb07Gallery({ initialLang = "en" }: { readonly initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [state, setState] = useState<GalleryState>("default");
  const [weeks, setWeeks] = useState<4 | 8>(4);
  const defaultButton = useRef<HTMLButtonElement>(null);
  const copy = (key: Parameters<typeof translateKb07>[1]) => translateKb07(lang, key);
  const points = state === "empty" ? galleryPoints.slice(0, weeks).map((point) => ({ ...point, count: 0 }))
    : galleryPoints.slice(0, state === "overflow" ? 8 : weeks);

  return (
    <main className="kb07-gallery" dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
      <h1>{copy("kb07.gallery.title")}</h1>
      <nav className="kb07-gallery__controls" aria-label={copy("kb07.gallery.title")}>
        {galleryStates.map((name) => (
          <button key={name} ref={name === "default" ? defaultButton : undefined} type="button" aria-pressed={state === name} onClick={() => setState(name)}>
            {copy(`kb07.gallery.${name}`)}
          </button>
        ))}
      </nav>
      <div className="kb07-gallery__controls">
        <button type="button" onClick={() => setLang(lang === "en" ? "he" : "en")}>
          {copy("kb07.gallery.language")}: {copy("kb07.gallery.otherLanguage")}
        </button>
        <button type="button" aria-pressed={weeks === 4} onClick={() => setWeeks(4)}>{copy("kb07.gallery.range4")}</button>
        <button type="button" aria-pressed={weeks === 8} onClick={() => setWeeks(8)}>{copy("kb07.gallery.range8")}</button>
      </div>
      {state === "loading" ? <output className="kb07-gallery__message">{copy("kb07.gallery.loadingText")}</output>
        : state === "error" ? (
          <div role="alert" className="kb07-gallery__message">
            <p>{copy("kb07.gallery.errorText")}</p>
            <button type="button" onClick={() => { setState("default"); defaultButton.current?.focus(); }}>{copy("kb07.gallery.retry")}</button>
          </div>
        ) : state === "disabled" ? (
          <div className="kb07-gallery__message">
            <p>{copy("kb07.gallery.disabledText")}</p>
            <button type="button" disabled>{copy("kb07.table.show")}</button>
          </div>
        ) : <GoalProgressView points={points} lang={lang} />}
    </main>
  );
}
