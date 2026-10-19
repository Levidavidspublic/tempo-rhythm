"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LocaleProvider, useLocale } from "@/components/providers/LocaleProvider";
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
import type { Lang, MessageKey } from "@/lib/i18n";
import { activityCopy } from "@/lib/i18n-groups/kb-66";
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
import "@/app/v3/kb-66.css";

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

  const groups = groupByDay(activity ?? [], bounds.startMs);

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
          ) : <ActivityFeed groups={groups} />}
        </section>
      ) : null}
    </div>
  );
}

/** A visible count with a single, ordinary button while more snapshot rows remain. */
export function ActivityLoadMore({
  shown, total, lang, onLoad,
}: { shown: number; total: number; lang: Lang; onLoad: (button: HTMLButtonElement) => void }) {
  const copy = activityCopy[lang];
  return (
    <div className="tp-load-more kb66-load-more" data-component="ActivityLoadMore">
      <span className="tp-load-more__status">
        {copy.showing} <bdi dir="ltr" className="tp-num">{shown}</bdi> {copy.of}{" "}
        <bdi dir="ltr" className="tp-num">{total}</bdi>
      </span>
      <button className="tp-btn tp-btn--secondary" type="button" onClick={(event) => onLoad(event.currentTarget)}>
        {copy.more}
      </button>
    </div>
  );
}

/** End means this query snapshot is fully visible, not all historical activity. */
export function ActivityEndStatus({ shown, total, lang }: { shown: number; total: number; lang: Lang }) {
  const copy = activityCopy[lang];
  return (
    <p className="kb66-end" data-component="ActivityEndStatus">
      <span>{copy.showing} <bdi dir="ltr" className="tp-num">{shown}</bdi> {copy.of}{" "}
        <bdi dir="ltr" className="tp-num">{total}</bdi>. </span>
      {copy.end}
    </p>
  );
}

type PendingFocus = {
  source: HTMLButtonElement;
  anchorId: string | null;
  visibleIds: Set<string>;
  previousShown: number;
};

function ActivityFeed({ groups }: { groups: DayGroup<ActivityItemLike>[] }) {
  const { lang } = useLocale();
  const [limit, setLimit] = useState(ACTIVITY_FIRST_PAGE);
  const [announced, setAnnounced] = useState<{ shown: number; total: number } | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingFocus | null>(null);
  const frameRef = useRef<number | null>(null);
  const page = firstRows(groups, limit);
  const visibleItems = page.groups.flatMap((group) => group.items);

  // Claim the pending click before scheduling a frame. StrictMode replays this effect,
  // and a reactive insertion can re-render the feed without a Load more click.
  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending || page.shown <= pending.previousShown) return;
    pendingRef.current = null;
    const anchorIndex = visibleItems.findIndex((item) => item.id === pending.anchorId);
    const nextItem = anchorIndex >= 0
      ? visibleItems.slice(anchorIndex + 1).find((item) => !pending.visibleIds.has(item.id))
      : visibleItems.find((item) => !pending.visibleIds.has(item.id));
    setAnnounced({ shown: page.shown, total: page.total });
    if (!nextItem) return;
    frameRef.current = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active !== pending.source && !(active === document.body && !pending.source.isConnected)) return;
      const row = [...(feedRef.current?.querySelectorAll<HTMLElement>("[data-kb66-row-id]") ?? [])]
        .find((element) => element.dataset.kb66RowId === nextItem.id);
      row?.focus({ preventScroll: false });
      frameRef.current = null;
    });
  }, [page.shown, page.total, visibleItems]);

  // Keep any queued focus from leaking into a different gallery scenario or route.
  useLayoutEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const load = (button: HTMLButtonElement) => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    pendingRef.current = {
      source: button,
      anchorId: visibleItems.at(-1)?.id ?? null,
      visibleIds,
      previousShown: page.shown,
    };
    setLimit((current) => current + ACTIVITY_STEP);
  };

  return (
    <div className="kb66-feed" ref={feedRef} data-component="ActivityFeed">
      {page.groups.map((group) => <DaySection key={group.dayStartMs} group={group} />)}
      {page.total > page.shown
        ? <ActivityLoadMore shown={page.shown} total={page.total} lang={lang} onLoad={load} />
        : <ActivityEndStatus shown={page.shown} total={page.total} lang={lang} />}
      <output className="tp-sr-only" aria-live="polite" aria-atomic="true">
        {announced ? <>{activityCopy[lang].showing} <bdi dir="ltr">{announced.shown}</bdi>{" "}
          {activityCopy[lang].of} <bdi dir="ltr">{announced.total}</bdi></> : null}
      </output>
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
    <li className="kb66-row" tabIndex={-1} data-kb66-row-id={item.id}>
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

const galleryNames = ["Maya", "Dana", "Yoni"];
function galleryItems(count: number): ActivityItemLike[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    id: `gallery-${index + 1}`,
    kind: index % 3 === 0 ? "task" : index % 3 === 1 ? "note" : "habit",
    action: index % 3 === 0 ? "Completed task" : index % 3 === 1 ? "Created note" : "Logged habit",
    title: `${galleryNames[index % 3]}'s activity ${index + 1}`,
    href: `/tasks/gallery-${index + 1}`,
    occurredAt: now - index * 60_000,
  }));
}

function GalleryBody({ initialLang }: { initialLang: Lang }) {
  const { lang, setLang } = useLocale();
  const [count, setCount] = useState(31);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const [inserted, setInserted] = useState(false);
  useEffect(() => { setLang(initialLang); }, [initialLang, setLang]);
  const bounds = useLocalDayBounds();
  const items = galleryItems(count + (inserted ? 1 : 0));
  if (inserted) {
    items.unshift({ ...items[0], id: "new-activity", title: "Dana's new activity", occurredAt: Date.now() });
    items.pop();
  }
  const groups = groupByDay(items, bounds.startMs);
  const copy = activityCopy[lang];
  const choose = (next: number) => { setCount(next); setInserted(false); setRevision((value) => value + 1); setError(false); };
  return (
    <main className="tp-page kb66-gallery" dir={lang === "he" ? "rtl" : "ltr"}>
      <ActivityHead />
      <fieldset className="kb66-gallery__controls">
        <legend className="tp-sr-only">{copy.galleryControls}</legend>
        {[0, 20, 21, 30, 31].map((value) => (
          <button className="tp-btn tp-btn--secondary" type="button" key={value} onClick={() => choose(value)}>
            <bdi dir="ltr">{value}</bdi> {copy.galleryItems}
          </button>
        ))}
        <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setInserted(true)}>{copy.galleryInsert}</button>
        <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setError(true)}>{copy.galleryError}</button>
        <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setLang(lang === "en" ? "he" : "en")}>{copy.galleryLanguage}</button>
      </fieldset>
      {error ? <StateError title={copy.galleryError} body={copy.galleryErrorBody} onRetry={() => setError(false)} />
        : groups.length === 0 ? <StateEmpty icon="history" title={copy.galleryEmpty} body={copy.galleryEmptyBody} />
        : <section className="tp-surface" aria-label={copy.galleryRegion}><ActivityFeed key={revision} groups={groups} /></section>}
    </main>
  );
}

/** Fictional data, with the same row/load-more views mounted by the activity route. */
export function Kb66Gallery({ initialLang = "en" }: { initialLang?: Lang }) {
  return <LocaleProvider><GalleryBody initialLang={initialLang} /></LocaleProvider>;
}
