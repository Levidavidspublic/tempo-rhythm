"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { filterGoals, GOAL_FILTERS, type GoalFilter, goalStatus, isGoalFilter } from "@/lib/goals-projects";
import {
  makeToast,
  OfflineNotice,
  ScreenBoundary,
  Segmented,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  StatusBadge,
  type ToastState,
  UndoToast,
  useOnline,
  useQueryParam,
  useSignedIn,
} from "./shared";

const FILTER_LABEL = {
  all: "gl.all",
  active: "gl.status.active",
  resting: "gl.status.resting",
  done: "gl.status.done",
} as const;

/**
 * Goals (docs/design/v3/screens/web/goals.html): every goal as a card with its status word and
 * its "why". Goals and projects are not linked in the schema yet, so the cards leave out the
 * design's "Linked projects" row and task counts rather than invent them.
 */
export function GoalsScreen() {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--wide gl-stack" data-component="PageLayout">
          <GoalsHeader />
          <StateError title={t("gl.error")} onRetry={retry} />
        </div>
      )}
    >
      <GoalsContent />
    </ScreenBoundary>
  );
}

function GoalsHeader({ onNew, busy }: { onNew?: () => void; busy?: boolean }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("gl.title")}</h1>
        <p className="tp-pagehead__sub">{t("gl.sub")}</p>
      </div>
      <div className="tp-pagehead__actions">
        <Link className="tp-btn tp-btn--secondary" href="/goals/progress">
          <TpIcon name="chart" size="sm" />
          <span>{t("gl.progress")}</span>
        </Link>
        {onNew ? (
          <button
            className="tp-btn tp-btn--primary"
            type="button"
            data-component="Button"
            disabled={busy}
            aria-busy={busy}
            onClick={onNew}
          >
            <TpIcon name="plus" size="sm" />
            <span>{t("gl.new")}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

function GoalsContent() {
  const { t } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const goals = useQuery(api.goals.list, signedIn === "ready" ? {} : "skip");
  const createGoal = useMutation(api.goals.create);
  const removeGoal = useMutation(api.goals.remove);
  const [filter, setFilter] = useQueryParam<GoalFilter>("status", "all", isGoalFilter);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // After "New goal", focus moves to the new card's title link (as in the design).
  useEffect(() => {
    if (!focusId) return;
    const link = document.getElementById(`goal-${focusId}-link`);
    if (link) {
      link.focus();
      setFocusId(null);
    }
  });

  const addGoal = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(false);
    try {
      const goalId = await createGoal({ title: t("gl.draft") });
      setFilter("all");
      setFocusId(goalId);
      setToast(makeToast(t("gl.added"), () => removeGoal({ goalId: goalId as Id<"goals"> })));
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  };

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page tp-page--wide gl-stack" data-component="PageLayout">
        <GoalsHeader />
        <SignedOutState />
      </div>
    );
  }

  const live = (goals ?? []).filter((goal) => goal.deletedAt === undefined);
  const shown = filterGoals(live, filter);
  const loading = goals === undefined;
  const empty = !loading && live.length === 0;

  return (
    <div className="tp-page tp-page--wide gl-stack" data-component="PageLayout">
      <GoalsHeader onNew={loading || empty ? undefined : () => void addGoal()} busy={creating} />

      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {createError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("gx.saveError")}</span>
        </p>
      ) : null}

      {loading ? (
        <StateLoading label={t("gl.loading")} />
      ) : empty ? (
        <StateEmpty
          icon="flag"
          title={t("gl.empty.title")}
          body={t("gl.empty.body")}
          action={
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              disabled={creating}
              onClick={() => void addGoal()}
            >
              <TpIcon name="plus" size="sm" />
              <span>{t("gl.empty.add")}</span>
            </button>
          }
        />
      ) : (
        <>
          <div className="tp-toolbar" data-component="Toolbar">
            <span className="tp-label" id="gl-filter-label">
              {t("gl.filter")}
            </span>
            <Segmented
              options={GOAL_FILTERS}
              value={filter}
              onChange={setFilter}
              labelledBy="gl-filter-label"
              render={(option) => <span>{t(FILTER_LABEL[option])}</span>}
            />
            <span className="tp-muted tp-small tp-toolbar__end" aria-live="polite">
              <span>{t("gl.showing")}</span> <span className="tp-num">{shown.length}</span>{" "}
              <span>{t("gl.goals")}</span>
            </span>
          </div>

          {shown.length > 0 ? (
            <div className="tp-cards gl-cards" data-component="CardGrid">
              {shown.map((goal) => (
                <GoalCard key={goal._id} goal={goal} />
              ))}
            </div>
          ) : (
            <StateEmpty
              icon="filter"
              title={t("gl.none.title")}
              body={t("gl.none.body")}
              action={
                <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setFilter("all")}>
                  <span>{t("gl.showall")}</span>
                </button>
              }
            />
          )}
        </>
      )}

      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </div>
  );
}

function GoalCard({ goal }: { goal: Doc<"goals"> }) {
  const { t } = useLocale();
  const status = goalStatus(goal.status);
  const titleId = `goal-${goal._id}-title`;
  const why = goal.description?.trim();
  return (
    <article className="tp-card gl-card" data-component="Card" data-status={status} aria-labelledby={titleId}>
      <div className="tp-card__head">
        <StatusBadge kind="goal" status={status} />
      </div>
      <h2 className="tp-h3" id={titleId}>
        <Link href={`/goals/${goal._id}`} id={`goal-${goal._id}-link`} dir="auto">
          {goal.title}
        </Link>
      </h2>
      <p className="tp-muted" dir="auto">
        {why || t("gl.draftwhy")}
      </p>
      {status === "resting" ? (
        <p className="tp-small gl-card__foot">
          <TpIcon name="pause" size="sm" />
          <span>{t("gl.resting")}</span>
        </p>
      ) : null}
    </article>
  );
}
