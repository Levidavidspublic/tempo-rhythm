"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
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
import {
  ACTIVITY_FIRST_PAGE,
  ACTIVITY_STEP,
  type ActivityItemLike,
  type ActivityKind,
  activityActionKey,
  type DayGroup,
  firstRows,
  groupByDay,
} from "@/lib/you/feeds";
import { deriveScreenState, fill, intlLocale } from "@/lib/you/screenState";

/**
 * Recent activity (docs/design/v3/screens/web/activity.html): what changed in the last seven
 * days, newest first, grouped by day. Each row says what changed, when, and links to it.
 * The e2e specs read the "What did you actually do?" heading and the "Recent activity" region.
 */

const KIND_ICON: Record<ActivityKind, TpIconName> = {
  task: "check",
  note: "page",
  habit: "habit",
  focus: "clock",
  calendar: "timeblock",
  goal: "flag",
};

const KIND_OPEN: Record<ActivityKind, MessageKey> = {
  task: "act.open.task",
  note: "act.open.note",
  habit: "act.open.habit",
  focus: "act.open.focus",
  calendar: "act.open.calendar",
  goal: "act.open.goal",
};

function ActivityHead() {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <p className="tp-eyebrow">{t("act.title")}</p>
        <h1 className="tp-pagehead__title">{t("act.heading")}</h1>
        <p className="tp-pagehead__sub">{t("act.sub")}</p>
      </div>
    </header>
  );
}

export function ActivityScreen() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={(retry) => <ActivityContent onRetry={retry} />}
      fallback={(retry) => (
        <div className="tp-page" data-component="PageLayout">
          <ActivityHead />
          <StateError title={t("act.error")} body={t("you.safe")} onRetry={retry} />
        </div>
      )}
    />
  );
}

function ActivityContent({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // activity.list calls requireUser, which throws until the users row exists.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const activity = useQuery(api.activity.list, isAuthenticated && profile ? {} : "skip");
  const input = { isAuthLoading, isAuthenticated, profile, data: activity };
  const timedOut = useLoadingTimeout(deriveScreenState({ ...input, failed: false }) === "loading");
  const state = deriveScreenState({ ...input, failed: timedOut });
  const [limit, setLimit] = useState(ACTIVITY_FIRST_PAGE);

  const groups = groupByDay(activity ?? [], bounds.startMs);
  const page = firstRows(groups, limit);

  return (
    <div className="tp-page" data-component="PageLayout">
      <ActivityHead />
      <StateOffline title={t("act.offline")} />
      {state === "loading" ? <StateLoading label={t("act.loading")} rows={6} /> : null}
      {state === "error" ? (
        <StateError title={t("act.error")} body={t("you.safe")} onRetry={onRetry} />
      ) : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "ready" ? (
        <section
          className={groups.length > 0 ? "tp-surface" : undefined}
          aria-label={t("act.title")}
        >
          {groups.length === 0 ? (
            <StateEmpty
              icon="history"
              title={t("act.empty.t")}
              body={t("act.empty.b")}
              action={
                <Link className="tp-btn tp-btn--secondary" href="/today">
                  <TpIcon name="today" size="sm" />
                  <span>{t("you.goToday")}</span>
                </Link>
              }
            />
          ) : (
            <>
              {page.groups.map((group) => (
                <DaySection key={group.dayStartMs} group={group} />
              ))}
              {page.total > page.shown ? (
                <div className="tp-load-more" data-component="LoadMore">
                  <span className="tp-load-more__status">
                    {t("you.showing")} <span className="tp-num">{page.shown}</span> {t("you.of")}{" "}
                    <span className="tp-num">{page.total}</span>
                  </span>
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    onClick={() => setLimit((n) => n + ACTIVITY_STEP)}
                  >
                    {t("act.more")}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function DaySection({ group }: { group: DayGroup<ActivityItemLike> }) {
  const { t, lang } = useLocale();
  const date = new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(group.dayStartMs);
  const title =
    group.daysAgo === 0
      ? fill(t("act.dayToday"), { date })
      : group.daysAgo === 1
        ? fill(t("act.dayYesterday"), { date })
        : date;
  const id = `act-day-${group.dayStartMs}`;
  return (
    <section className="tp-section" data-component="Section" aria-labelledby={id}>
      <div className="tp-section__head">
        <h2 className="tp-section__title" id={id}>
          {title}
        </h2>
      </div>
      <ul className="tp-list" data-component="ListRow">
        {group.items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ item }: { item: ActivityItemLike }) {
  const { t, lang } = useLocale();
  const actionKey = activityActionKey(item.action);
  const time = new Intl.DateTimeFormat(intlLocale(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(item.occurredAt);
  return (
    <li>
      <div className="tp-list-row act-row">
        <span className="tp-list-row__icon">
          <TpIcon name={KIND_ICON[item.kind]} />
        </span>
        <span className="tp-list-row__body">
          <span className="tp-list-row__title" dir="auto">
            {item.title}
          </span>
          <span className="tp-list-row__meta act-meta">
            <span className="tp-badge">{actionKey ? t(actionKey) : item.action}</span>
            <time className="tp-num tp-mono" dateTime={new Date(item.occurredAt).toISOString()}>
              {time}
            </time>
          </span>
        </span>
        <span className="tp-list-row__end">
          <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={item.href}>
            {t(KIND_OPEN[item.kind])}
          </Link>
        </span>
      </div>
    </li>
  );
}
