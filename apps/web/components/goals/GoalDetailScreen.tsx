"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { GOAL_STATUSES, type GoalStatus, goalStatus, storedGoalStatus } from "@/lib/goals-projects";
import type { MessageKey } from "@/lib/i18n";
import { tKb06 } from "@/lib/i18n-groups/kb-06";
import "@/app/v3/kb-06.css";
import {
  ScreenBoundary,
  SignedOutState,
  StatusBadge,
  useOnline,
  useSignedIn,
} from "./shared";

const WHY_SAVE_DELAY_MS = 800;

/**
 * Goal detail (docs/design/v3/screens/web/goal-detail.html): the goal in the person's words,
 * its status and why it matters, all editable. Goals are not linked to projects or tasks in the
 * schema yet, so "Next small step", "Linked projects" and "Open tasks" are left out and the
 * design's "no steps yet" state stands in for them.
 */
export function GoalDetailScreen({ goalId }: { goalId: string }) {
  const { lang } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page gd-stack kb06-goal" data-component="PageLayout">
          <BackLink />
          <GoalDetailState kind="error" lang={lang} onRetry={retry} />
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
  const { lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  // goals.list, not a by-id read: an id from the URL that isn't a goal is "not found", not a
  // validator error.
  const goals = useQuery(api.goals.list, signedIn === "ready" ? {} : "skip");

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page gd-stack kb06-goal" data-component="PageLayout">
        <BackLink />
        <SignedOutState />
      </div>
    );
  }
  if (goals === undefined) {
    return (
      <div className="tp-page gd-stack kb06-goal" data-component="PageLayout">
        <BackLink />
        <GoalDetailState kind="loading" lang={lang} />
      </div>
    );
  }
  const goal = goals.find((row) => row._id === goalId && row.deletedAt === undefined);
  if (!goal) {
    return (
      <div className="tp-page gd-stack kb06-goal" data-component="PageLayout">
        <BackLink />
        <GoalDetailState kind="unavailable" lang={lang} />
      </div>
    );
  }
  return <GoalPage key={goal._id} goal={goal} online={online} />;
}

function GoalPage({ goal, online }: { goal: Doc<"goals">; online: boolean }) {
  const { t, lang } = useLocale();
  const update = useMutation(api.goals.update);
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

  return (
    <div className="tp-page gd-stack kb06-goal" data-component="PageLayout">
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

      {online ? null : <GoalDetailState kind="offline" lang={lang} />}
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

        <GoalProgressSummary progress={goal.progressPercent} lang={lang} />
        <section className="tp-section" aria-labelledby="kb06-milestones-h">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="kb06-milestones-h">
              {tKb06(lang, "kb06.milestones")}
            </h2>
          </div>
          <GoalDetailState kind="empty" lang={lang} />
        </section>
      </div>
    </div>
  );
}

export function GoalProgressSummary({ progress, lang }: { progress: number; lang: "en" | "he" }) {
  const percent = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  return (
    <section className="tp-section kb06-goal__progress" aria-labelledby="kb06-progress-h">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="kb06-progress-h">
          {tKb06(lang, "kb06.progress")}
        </h2>
      </div>
      <div className="kb06-goal__progress-line">
        <strong className="kb06-goal__progress-value tp-num">{percent}%</strong>
        <span>{tKb06(lang, "kb06.complete")}</span>
      </div>
      <div
        className="kb06-goal__progress-track"
        role="progressbar"
        aria-label={tKb06(lang, "kb06.progress")}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="kb06-goal__progress-fill" style={{ inlineSize: `${percent}%` }} />
      </div>
    </section>
  );
}

type GoalDetailStateKind = "loading" | "unavailable" | "offline" | "empty" | "error";

/** The same state panel is used by the live screen and the browser gallery. */
export function GoalDetailState({
  kind,
  lang,
  onRetry,
  retryDisabled = false,
  asSection = false,
}: {
  kind: GoalDetailStateKind;
  lang: "en" | "he";
  onRetry?: () => void;
  retryDisabled?: boolean;
  asSection?: boolean;
}) {
  if (kind === "offline" || kind === "empty") {
    return (
      <output className="kb06-goal__state" data-kind={kind}>
        {tKb06(lang, kind === "offline" ? "kb06.offline" : "kb06.empty")}
      </output>
    );
  }
  const title = tKb06(lang, `kb06.${kind}`);
  const Heading = asSection ? "h2" : "h1";
  return (
    <section className="kb06-goal__state" data-kind={kind} role={kind === "loading" ? "status" : undefined} aria-busy={kind === "loading" ? true : undefined}>
      <Heading>{title}</Heading>
      {kind === "unavailable" ? <p>{tKb06(lang, "kb06.unavailableHelp")}</p> : null}
      {kind === "error" && onRetry ? (
        <button type="button" className="tp-btn tp-btn--secondary" onClick={onRetry} disabled={retryDisabled}>
          {tKb06(lang, "kb06.retry")}
        </button>
      ) : null}
    </section>
  );
}

/** Fictional, controlled states for browser review; no goal is created or saved. */
export function Kb06Gallery() {
  const [lang, setLang] = useState<"en" | "he">("en");
  const [state, setState] = useState<"default" | "empty" | "loading" | "error" | "disabled" | "overflow">("default");
  const [retryCount, setRetryCount] = useState(0);
  const states = ["default", "empty", "loading", "error", "disabled", "overflow"] as const;
  const stateKeys = ["kb06.galleryDefault", "kb06.galleryEmpty", "kb06.galleryLoading", "kb06.galleryError", "kb06.galleryDisabled", "kb06.galleryOverflow"] as const;
  return (
    <main className="kb06-gallery" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <h1>{tKb06(lang, "kb06.gallery")}</h1>
      <fieldset className="kb06-gallery__controls">
        <legend className="tp-sr-only">{tKb06(lang, "kb06.gallery")}</legend>
        <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>{tKb06(lang, "kb06.galleryEn")}</button>
        <button type="button" aria-pressed={lang === "he"} onClick={() => setLang("he")}>{tKb06(lang, "kb06.galleryHe")}</button>
        {states.map((option, index) => (
          <button key={option} type="button" aria-pressed={state === option} onClick={() => setState(option)}>
            {tKb06(lang, stateKeys[index])}
          </button>
        ))}
      </fieldset>
      <div className="kb06-gallery__sample kb06-goal">
        {state === "loading" ? <GoalDetailState kind="loading" lang={lang} asSection /> :
          state === "error" || state === "disabled" ? (
            <GoalDetailState kind="error" lang={lang} asSection onRetry={() => setRetryCount((count) => count + 1)} retryDisabled={state === "disabled"} />
          ) : (
            <div className="tp-page gd-stack">
              <h2 dir="auto">{tKb06(lang, state === "overflow" ? "kb06.galleryLong" : "kb06.galleryGoal")}</h2>
              {state !== "empty" ? <GoalProgressSummary progress={35} lang={lang} /> : null}
              <section className="tp-section">
                <h2 className="tp-section__title">{tKb06(lang, "kb06.milestones")}</h2>
                <GoalDetailState kind="empty" lang={lang} />
              </section>
            </div>
          )}
      </div>
      <output aria-live="polite">{tKb06(lang, "kb06.galleryRetryCount", retryCount)}</output>
    </main>
  );
}
