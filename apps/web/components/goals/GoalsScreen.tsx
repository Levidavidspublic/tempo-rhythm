"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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

/** The inline name field, and the two buttons that open it (focus goes back to one on Cancel). */
const NAME_ID = "gl-name";
const NEW_ID = "gl-new";
const FIRST_ID = "gl-first";

/**
 * Puts `n` where the copy has `{n}`, in a .tp-num span so the digits stay LTR in Hebrew. The copy
 * is split, not passed to String.replace, so nothing in it is read as a `$` pattern.
 */
function withCount(template: string, n: number): ReactNode[] {
  return template.split("{n}").flatMap((text, index) =>
    index === 0
      ? [text]
      : [
          <span key={index} className="tp-num">
            {n}
          </span>,
          text,
        ]
  );
}

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
            id={NEW_ID}
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
  // "New goal" asks for a name first; nothing is created until it has one.
  const [naming, setNaming] = useState(false);
  // One create at a time: set before the first await, so a double press makes one goal.
  const creatingRef = useRef(false);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Focus follows the flow: into the name field when it opens, back to the button that opened it
  // on Cancel, and to the new card's title link once the goal exists (as in the design).
  useEffect(() => {
    if (!focusTarget) return;
    const target = document.getElementById(focusTarget);
    if (target) {
      target.focus();
      setFocusTarget(null);
    }
  });

  const openName = () => {
    setNaming(true);
    setFocusTarget(NAME_ID);
  };

  const addGoal = async (title: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError(false);
    try {
      const goalId = await createGoal({ title });
      setNaming(false);
      setFilter("all");
      setFocusTarget(`goal-${goalId}-link`);
      setToast(makeToast(t("gl.added"), () => removeGoal({ goalId: goalId as Id<"goals"> })));
    } catch {
      setCreateError(true);
    } finally {
      creatingRef.current = false;
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

  const closeName = () => {
    setNaming(false);
    setFocusTarget(empty ? FIRST_ID : NEW_ID);
  };
  const nameForm = naming ? (
    <GoalNameForm busy={creating} onSubmit={(title) => void addGoal(title)} onCancel={closeName} />
  ) : null;

  return (
    <div className="tp-page tp-page--wide gl-stack" data-component="PageLayout">
      <GoalsHeader onNew={loading || empty ? undefined : openName} busy={creating} />

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
            nameForm ?? (
              <button
                id={FIRST_ID}
                className="tp-btn tp-btn--secondary"
                type="button"
                disabled={creating}
                onClick={openName}
              >
                <TpIcon name="plus" size="sm" />
                <span>{t("gl.empty.add")}</span>
              </button>
            )
          }
        />
      ) : (
        <>
          {nameForm}

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
              <span>
                {withCount(t(shown.length === 1 ? "gl.count.one" : "gl.count.many"), shown.length)}
              </span>
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

/**
 * The name a new goal starts with. Enter or Add hands over the trimmed name; an empty one shows a
 * short hint instead. Escape or Cancel closes the field without creating anything.
 */
function GoalNameForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (title: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [empty, setEmpty] = useState(false);
  const hintId = `${NAME_ID}-hint`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = name.trim();
    if (!title) {
      setEmpty(true);
      document.getElementById(NAME_ID)?.focus();
      return;
    }
    setEmpty(false);
    onSubmit(title);
  };

  return (
    <form className="gx-add text-start" onSubmit={submit} data-component="InlineAdd">
      <label className="tp-field" htmlFor={NAME_ID}>
        <span className="tp-label">{t("gl.name.label")}</span>
        <input
          id={NAME_ID}
          className="tp-input"
          dir="auto"
          autoComplete="off"
          placeholder={t("gl.name.placeholder")}
          value={name}
          aria-invalid={empty || undefined}
          aria-describedby={empty ? hintId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (event.target.value.trim()) setEmpty(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </label>
      <button className="tp-btn tp-btn--primary" type="submit" disabled={busy} aria-busy={busy}>
        <TpIcon name="plus" size="sm" />
        <span>{t("gx.add")}</span>
      </button>
      <button className="tp-btn tp-btn--ghost" type="button" onClick={onCancel}>
        {t("gx.cancel")}
      </button>
      {empty ? (
        <p className="tp-help basis-full" id={hintId}>
          <output>{t("gl.name.empty")}</output>
        </p>
      ) : null}
    </form>
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
