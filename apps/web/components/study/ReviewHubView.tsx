"use client";

import { fillNodes } from "@tempo/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { OfflineNotice, StateEmpty, StateLoading } from "@/components/goals/shared";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { IngestButton } from "@/components/ingest";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { groupSets, type HubData, type HubSet, hubFocus, reviewHref, setHref } from "./hub";
import { countKey, KIND_ICON, type StudyT } from "./labels";

/** The review hub's markup (S19), with no data access: ReviewHub.tsx passes the query result. */
export function HubHeader({ t }: { t: StudyT }) {
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("st.title")}</h1>
        <p className="tp-pagehead__sub">{t("st.sub")}</p>
      </div>
    </header>
  );
}

export type ReviewHubViewProps = {
  /** undefined while loading. */
  hub: HubData | undefined;
  online: boolean;
  signedOut?: boolean;
};

export function ReviewHubView({ hub, online, signedOut }: ReviewHubViewProps) {
  const { t } = useLocale();
  const focus = hub ? hubFocus(hub) : null;
  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack"
      data-component="PageLayout"
      data-screen="ReviewHub"
    >
      <HubHeader t={t} />
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {signedOut ? (
        <StateSignedOut />
      ) : !hub || !focus ? (
        <StateLoading label={t("st.loading")} lead="block" />
      ) : focus.kind === "empty" ? (
        <StateEmpty
          icon="card"
          title={t("st.empty.title")}
          body={t("st.empty.body")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/notes">
              <TpIcon name="page" size="sm" />
              <span>{t("st.empty.pages")}</span>
            </Link>
          }
        />
      ) : (
        <>
          <FocusCard hub={hub} t={t} />
          <SetGroups sets={hub.sets} truncated={hub.truncated === true} t={t} />
        </>
      )}
      {signedOut ? null : <MoreWays t={t} />}
    </div>
  );
}

function FocusCard({ hub, t }: { hub: HubData; t: StudyT }) {
  const focus = hubFocus(hub);
  const today =
    hub.reviewedToday === 0
      ? t("st.today.none")
      : fillNodes(t(countKey("st.today", hub.reviewedToday)), { n: hub.reviewedToday });
  let title: ReactNode;
  let detail: ReactNode = null;
  if (focus.kind === "due") {
    title = fillNodes(t(countKey("st.due", focus.due)), { n: focus.due });
    if (focus.fresh > 0) detail = fillNodes(t(countKey("st.new", focus.fresh)), { n: focus.fresh });
  } else if (focus.kind === "new") {
    title = fillNodes(t(countKey("st.due.newOnly", focus.fresh)), { n: focus.fresh });
  } else {
    title = t("st.due.clear");
    detail = t("st.due.clearBody");
  }
  const canStart = focus.kind === "due" || focus.kind === "new";
  return (
    <section
      className="tp-nextup tp-study-focus"
      data-component="NextUpCard"
      data-focus={focus.kind}
      aria-labelledby="tp-study-focus-title"
    >
      <h2 className="tp-nextup__title" id="tp-study-focus-title">
        {title}
      </h2>
      {detail ? <p className="tp-nextup__why">{detail}</p> : null}
      <p className="tp-nextup__meta tp-muted">
        <TpIcon name="clock" size="sm" />
        <span>{today}</span>
      </p>
      {canStart ? (
        <div className="tp-nextup__actions">
          <Link className="tp-btn tp-btn--primary" href={reviewHref()} data-action="start-review">
            <TpIcon name="play" size="sm" />
            <span>{t("st.due.start")}</span>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

const GROUP_KEY: Record<HubSet["kind"], MessageKey> = {
  flashcards: "st.group.flashcards",
  quiz: "st.group.quiz",
  test: "st.group.test",
};

function SetGroups({
  sets,
  truncated,
  t,
}: {
  sets: readonly HubSet[];
  /** Past the hub's read budget: say the list holds the most recent sets, not all of them. */
  truncated: boolean;
  t: StudyT;
}) {
  return (
    <section className="tp-section" data-component="Section" aria-labelledby="st-sets-title">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="st-sets-title">
          {t("st.sets")}
        </h2>
      </div>
      {truncated ? (
        <p className="tp-muted" data-truncated="">
          {t("st.truncated")}
        </p>
      ) : null}
      {groupSets(sets).map((group) => (
        <div className="tp-study-group" key={group.kind} data-kind={group.kind}>
          <h3 className="tp-h3 tp-study-group__title" id={`tp-study-group-${group.kind}`}>
            <TpIcon name={KIND_ICON[group.kind]} size="sm" />
            <span>{t(GROUP_KEY[group.kind])}</span>
          </h3>
          <ul
            className="tp-list tp-surface tp-study-list"
            aria-labelledby={`tp-study-group-${group.kind}`}
          >
            {group.sets.map((set) => (
              <li key={set.setId}>
                <SetRow set={set} t={t} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** The words under a set's title: its size, then what's due (decks) or the last score. */
export function SetMeta({ set, t }: { set: HubSet; t: StudyT }) {
  const size =
    set.kind === "flashcards"
      ? fillNodes(t(countKey("st.row.cards", set.itemCount)), { n: set.itemCount })
      : fillNodes(t(countKey("st.row.questions", set.itemCount)), { n: set.itemCount });
  let status: ReactNode;
  if (set.kind === "flashcards") {
    status =
      set.dueCount > 0 ? fillNodes(t("st.row.due"), { n: set.dueCount }) : t("st.row.dueNone");
  } else {
    status = set.lastAttempt
      ? fillNodes(t("st.row.lastScore"), { percent: set.lastAttempt.percent })
      : t("st.row.notTried");
  }
  return (
    <span className="tp-list-row__meta">
      <span>{size}</span>
      <span aria-hidden="true">·</span>
      <span data-due={set.kind === "flashcards" && set.dueCount > 0 ? "yes" : undefined}>
        {status}
      </span>
      {set.kind === "flashcards" && set.newCount > 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{fillNodes(t("st.row.newCards"), { n: set.newCount })}</span>
        </>
      ) : null}
    </span>
  );
}

function SetRow({ set, t }: { set: HubSet; t: StudyT }) {
  return (
    <Link className="tp-list-row" href={setHref(set.setId)} data-component="ListRow">
      <span className="tp-list-row__icon">
        <TpIcon name={KIND_ICON[set.kind]} />
      </span>
      <span className="tp-list-row__body">
        <span className="tp-list-row__title" dir="auto">
          {set.title}
        </span>
        <SetMeta set={set} t={t} />
      </span>
      <span className="tp-list-row__end">
        <TpIcon name="chevron" size="sm" flip />
      </span>
    </Link>
  );
}

function MoreWays({ t }: { t: StudyT }) {
  return (
    <section className="tp-section" data-component="Section" aria-labelledby="st-more-title">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="st-more-title">
          {t("st.more")}
        </h2>
      </div>
      <ul className="tp-list tp-surface tp-study-list">
        <li>
          <Link className="tp-list-row" href="/study/plan" data-component="ListRow">
            <span className="tp-list-row__icon">
              <TpIcon name="calendar-grid" />
            </span>
            <span className="tp-list-row__body">
              <span className="tp-list-row__title">{t("st.plan")}</span>
              <span className="tp-list-row__meta">{t("st.plan.sub")}</span>
            </span>
            <span className="tp-list-row__end">
              <TpIcon name="chevron" size="sm" flip />
            </span>
          </Link>
        </li>
        <li>
          <Link className="tp-list-row" href="/study/record" data-component="ListRow">
            <span className="tp-list-row__icon">
              <TpIcon name="mic" />
            </span>
            <span className="tp-list-row__body">
              <span className="tp-list-row__title">{t("st.record")}</span>
              <span className="tp-list-row__meta">{t("st.record.sub")}</span>
            </span>
            <span className="tp-list-row__end">
              <TpIcon name="chevron" size="sm" flip />
            </span>
          </Link>
        </li>
      </ul>
      <div className="tp-study-actions">
        <IngestButton label={t("st.ingest")} />
      </div>
    </section>
  );
}
