"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { fill, goalStatus, linePoints, stepsByWeek, type WeekPoint, weeklySummary } from "@/lib/goals-projects";
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
  const { t } = useLocale();
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

          <div className="gp-charts">
            <WeeklyChart points={points} />
          </div>

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

function WeeklyChart({ points }: { points: WeekPoint[] }) {
  const { t } = useLocale();
  const coords = linePoints(points);
  const summary = weeklySummary(points);
  const sentence = fill(t(summary.key), summary.params);
  return (
    <figure className="tp-chart tp-surface" data-component="LineChart" aria-labelledby="line-t">
      <div className="tp-chart__title" id="line-t">
        {t("gp.line.t")}
      </div>
      <svg className="tp-chart__svg" viewBox="0 0 400 210" role="img" aria-labelledby="line-s">
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
      <figcaption className="tp-chart__summary" id="line-s" data-component="ChartSummary">
        {sentence}
      </figcaption>
    </figure>
  );
}
