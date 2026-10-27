"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { GOAL_STATUSES, type GoalStatus, goalStatus, storedGoalStatus } from "@/lib/goals-projects";
import type { MessageKey } from "@/lib/i18n";
import {
  OfflineNotice,
  ScreenBoundary,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  StatusBadge,
  useOnline,
  useSignedIn,
} from "./shared";

const WHY_SAVE_DELAY_MS = 800;
/** A milestone moves progress by a quarter; stored on the goal itself (no new table). */
const MILESTONE_STEP = 25;

function dateInputValue(ms: number | undefined): string {
  return ms === undefined ? "" : new Date(ms).toISOString().slice(0, 10);
}

/**
 * Goal detail (docs/design/v3/screens/web/goal-detail.html): the goal in the person's words,
 * its status and why it matters, all editable. Goals are not linked to projects or tasks in the
 * schema yet, so "Next small step", "Linked projects" and "Open tasks" are left out and the
 * design's "no steps yet" state stands in for them.
 */
export function GoalDetailScreen({ goalId }: { goalId: string }) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page gd-stack" data-component="PageLayout">
          <BackLink />
          <StateError title={t("gd.error")} onRetry={retry} />
        </div>
      )}
    >
      <GoalDetailContent goalId={goalId} />
    </ScreenBoundary>
  );
}

function BackLink() {
  const { t } = useLocale();
  return (
    <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/goals">
      <TpIcon name="chevron" size="sm" className="tp-icon--back" />
      <span>{t("gd.back")}</span>
    </Link>
  );
}

function GoalDetailContent({ goalId }: { goalId: string }) {
  const { t } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  // goals.list, not a by-id read: an id from the URL that isn't a goal is "not found", not a
  // validator error.
  const goals = useQuery(api.goals.list, signedIn === "ready" ? {} : "skip");

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page gd-stack" data-component="PageLayout">
        <BackLink />
        <SignedOutState />
      </div>
    );
  }
  if (goals === undefined) {
    return (
      <div className="tp-page gd-stack" data-component="PageLayout">
        <BackLink />
        <StateLoading label={t("gd.loading")} lead="line" rows={2} />
      </div>
    );
  }
  const goal = goals.find((row) => row._id === goalId && row.deletedAt === undefined);
  if (!goal) {
    return (
      <div className="tp-page gd-stack" data-component="PageLayout">
        <BackLink />
        <StateError
          title={t("gd.error")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/goals">
              <span>{t("gd.back")}</span>
            </Link>
          }
        />
      </div>
    );
  }
  return <GoalPage key={goal._id} goal={goal} online={online} />;
}

function GoalPage({ goal, online }: { goal: Doc<"goals">; online: boolean }) {
  const { t } = useLocale();
  const update = useMutation(api.goals.update);
  const removeGoal = useMutation(api.goals.remove);
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const progress = goal.progressPercent ?? 0;
  const status = goalStatus(goal.status);
  const [title, setTitle] = useState(goal.title);
  const [why, setWhy] = useState(goal.description ?? "");
  const [saveError, setSaveError] = useState(false);
  const savedWhy = useRef(goal.description ?? "");
  const whyTimer = useRef<number | undefined>(undefined);

  // Follow changes made elsewhere while this field isn't being edited.
  const titleFocused = useRef(false);
  useEffect(() => {
    if (!titleFocused.current) setTitle(goal.title);
  }, [goal.title]);

  // The same for "why": the box and the last saved text both follow the stored text, so the
  // next edit starts from it instead of writing a stale copy back.
  const remoteWhy = goal.description ?? "";
  const whyFocused = useRef(false);
  useEffect(() => {
    if (whyFocused.current) return;
    savedWhy.current = remoteWhy;
    setWhy(remoteWhy);
  }, [remoteWhy]);

  const run = (patch: Parameters<typeof update>[0]) =>
    update(patch).then(
      () => setSaveError(false),
      () => setSaveError(true),
    );

  const saveTitle = () => {
    titleFocused.current = false;
    const next = title.trim();
    if (!next) {
      setTitle(goal.title);
      return;
    }
    if (next !== goal.title) void run({ goalId: goal._id, title: next });
  };

  const saveWhy = (value: string) => {
    window.clearTimeout(whyTimer.current);
    if (value === savedWhy.current) return;
    // The saved value moves only once the save lands, so a failed save is tried again on blur.
    update({ goalId: goal._id, description: value.trim() ? value : null }).then(
      () => {
        savedWhy.current = value;
        setSaveError(false);
      },
      () => setSaveError(true),
    );
  };

  const onWhyBlur = () => {
    whyFocused.current = false;
    if (why !== savedWhy.current) {
      saveWhy(why);
      return;
    }
    // Nothing typed: show what changed elsewhere while the box had focus.
    window.clearTimeout(whyTimer.current);
    savedWhy.current = remoteWhy;
    setWhy(remoteWhy);
  };

  useEffect(() => () => window.clearTimeout(whyTimer.current), []);

  const setStatus = (next: GoalStatus) => {
    if (next !== status) void run({ goalId: goal._id, status: storedGoalStatus(next) });
  };

  const setTargetDate = (value: string) => {
    void run({ goalId: goal._id, targetDate: value ? Date.parse(`${value}T00:00:00Z`) : null });
  };

  const markMilestone = () => {
    const next = Math.min(100, progress + MILESTONE_STEP);
    void run({
      goalId: goal._id,
      progressPercent: next,
      ...(next >= 100 ? { status: "completed" as const } : {}),
    });
  };

  const deleteGoal = () => {
    removeGoal({ goalId: goal._id }).then(
      () => router.push("/goals"),
      () => setSaveError(true),
    );
  };

  return (
    <div className="tp-page gd-stack" data-component="PageLayout">
      <BackLink />

      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">
            <input
              className="gx-title-input"
              aria-label={t("gd.titleLabel")}
              dir="auto"
              value={title}
              onFocus={() => {
                titleFocused.current = true;
              }}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </h1>
          <div className="tp-pagehead__sub gd-meta">
            <StatusBadge kind="goal" status={status} />
          </div>
        </div>
        <div className="tp-pagehead__actions gd-status">
          <label className="tp-field" htmlFor="gd-status">
            <span className="tp-label">{t("gd.status")}</span>
            <span className="tp-select" data-component="Select">
              <select
                id="gd-status"
                className="tp-select__input"
                value={status}
                onChange={(event) => setStatus(event.target.value as GoalStatus)}
              >
                {GOAL_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {t(`gl.status.${option}` as MessageKey)}
                  </option>
                ))}
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
        </div>
      </header>

      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {saveError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("gx.saveError")}</span>
        </p>
      ) : null}

      <div className="gd-stack">
        <section className="tp-section gd-why" data-component="Section" aria-labelledby="why-h">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="why-h">
              {t("gd.why.h")}
            </h2>
          </div>
          <div className="tp-surface" data-component="Surface">
            <textarea
              className="gd-why__input"
              aria-labelledby="why-h"
              dir="auto"
              spellCheck
              placeholder={t("gl.draftwhy")}
              value={why}
              onFocus={() => {
                whyFocused.current = true;
              }}
              onChange={(event) => {
                const value = event.target.value;
                setWhy(value);
                window.clearTimeout(whyTimer.current);
                whyTimer.current = window.setTimeout(() => saveWhy(value), WHY_SAVE_DELAY_MS);
              }}
              onBlur={onWhyBlur}
            />
          </div>
        </section>

        <section className="tp-section" data-component="Section" aria-labelledby="gd-progress-h">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="gd-progress-h">
              Progress
            </h2>
          </div>
          <div className="tp-surface" data-component="Surface">
            <label className="tp-field" htmlFor="gd-target">
              <span className="tp-label">Target date</span>
              <input
                id="gd-target"
                type="date"
                className="tp-input"
                value={dateInputValue(goal.targetDate)}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </label>
            <p>
              <progress max={100} value={progress} aria-label="Progress" /> {progress}%
            </p>
            <button
              type="button"
              className="tp-btn tp-btn--secondary"
              disabled={progress >= 100}
              onClick={markMilestone}
            >
              Mark milestone
            </button>
          </div>
        </section>

        <div>
          {confirmDelete ? (
            <>
              <button type="button" className="tp-btn tp-btn--secondary" onClick={deleteGoal}>
                Confirm delete
              </button>{" "}
              <button
                type="button"
                className="tp-btn tp-btn--ghost"
                onClick={() => setConfirmDelete(false)}
              >
                {t("gx.cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="tp-btn tp-btn--ghost"
              onClick={() => setConfirmDelete(true)}
            >
              Delete goal
            </button>
          )}
        </div>

        <StateEmpty icon="flag" title={t("gd.empty.title")} body={t("gd.empty.body")} />
      </div>
    </div>
  );
}
