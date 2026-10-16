"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ScreenErrorBoundary,
  type SkeletonRow,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useOnline,
  useProfileState,
} from "@/components/habits/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  finishStep,
  isRunFinished,
  parseRoutineSteps,
  type RoutineRun,
  reopenStep,
  runTally,
  type StepStatus,
  startRun,
  togglePause,
  totalMinutes,
} from "@/lib/routines";

const LOADING_ROWS: readonly SkeletonRow[] = [
  ["w80", "w60"],
  ["w60", "w40"],
  ["w40", "w40"],
];

const DOT: Record<StepStatus, string> = {
  done: "done",
  now: "fixed",
  skipped: "flex",
  next: "habit",
};
const ICON: Record<StepStatus, TpIconName> = {
  done: "check",
  now: "play",
  skipped: "arrow",
  next: "clock",
};
const WORD = {
  done: "rd.s.done",
  now: "rd.s.now",
  skipped: "rd.s.skipped",
  next: "rd.s.next",
} as const;
const NOTE = {
  done: "rd.donenote",
  skipped: "rd.skipped",
  reopened: "rd.reopened",
  resumed: "rd.resumed",
} as const;

/* ---------- The run's place, kept for this tab ---------- */

/** sessionStorage keys: this prefix, the format version, then the routine id. */
export const RUN_KEY_PREFIX = "tempo:routine-run:";
const RUN_VERSION = 1;
/** A place older than this is dropped: this morning's run is not tonight's. */
export const RUN_TTL_MS = 12 * 60 * 60 * 1000;

export type RunStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function runStorageKey(routineId: string): string {
  return `${RUN_KEY_PREFIX}v${RUN_VERSION}:${routineId}`;
}

/** This tab's sessionStorage, or null when the browser blocks it. */
export function sessionRunStorage(): RunStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A saved place, only when it is fresh and still fits the routine's steps. */
function parseSavedRun(raw: string, stepCount: number, now: number): RoutineRun | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { v, savedAt, index, statuses, paused } = value as Record<string, unknown>;
  if (v !== RUN_VERSION || typeof savedAt !== "number" || typeof paused !== "boolean") return null;
  const age = now - savedAt;
  if (!(age >= 0 && age <= RUN_TTL_MS)) return null;
  if (!Array.isArray(statuses) || statuses.length !== stepCount) return null;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= stepCount)
    return null;
  // Steps before the current one are done or skipped, the current one is Now, the rest wait.
  const fits = statuses.every((status: unknown, k) =>
    k < index
      ? status === "done" || status === "skipped"
      : status === (k === index ? "now" : "next")
  );
  return fits ? { index, statuses: statuses as StepStatus[], paused } : null;
}

/**
 * The run saved for this routine in this tab, or null. A place that is too old, unreadable or
 * from a different list of steps is dropped. Never throws: blocked storage reads as nothing saved.
 */
export function readSavedRun(
  storage: RunStorage | null,
  routineId: string,
  stepCount: number,
  now: number
): RoutineRun | null {
  if (!storage || stepCount === 0) return null;
  const key = runStorageKey(routineId);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const run = parseSavedRun(raw, stepCount, now);
    if (!run) storage.removeItem(key);
    return run;
  } catch {
    return null;
  }
}

/**
 * Keeps the run's place (step and statuses only, no step text). A finished run is cleared, so
 * the next visit starts fresh. Never throws: without storage the run just doesn't survive a reload.
 */
export function saveRun(
  storage: RunStorage | null,
  routineId: string,
  run: RoutineRun,
  now: number
): void {
  if (!storage) return;
  const key = runStorageKey(routineId);
  try {
    if (run.statuses.length === 0 || isRunFinished(run)) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(
      key,
      JSON.stringify({
        v: RUN_VERSION,
        savedAt: now,
        index: run.index,
        statuses: run.statuses,
        paused: run.paused,
      })
    );
  } catch {
    // Blocked or full: nothing to do.
  }
}

/**
 * Routine, guided (docs/design/v3/screens/web/routine-detail.html): one step at a time, Skip
 * without guilt, Pause keeps the place, Back a step, and a calm finish. The routine is a page
 * tagged #routine (lib/routines.ts); "Edit the steps" opens that page.
 *
 * There is no routines backend to store runs, so the place (current step, done and skipped steps,
 * paused) is kept in this tab's sessionStorage: a reload, or leaving and coming back, picks it up
 * while the number of steps is the same. It is cleared when the run ends and dropped after 12 hours.
 */
export function RoutineGuide({ routineId }: { routineId: string }) {
  return (
    <ScreenErrorBoundary fallback={(retry) => <GuideFailed onRetry={retry} />}>
      <GuideContent routineId={routineId} />
    </ScreenErrorBoundary>
  );
}

function BackLink() {
  const { t } = useLocale();
  return (
    <Link className="tp-btn tp-btn--ghost" href="/routines">
      <TpIcon name="chevron" size="sm" className="tp-icon--back" />
      <span>{t("rd.back")}</span>
    </Link>
  );
}

function GuideFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <BackLink />
      <StateError title={t("rd.error")} onRetry={onRetry} />
    </div>
  );
}

function GuideContent({ routineId }: { routineId: string }) {
  const { t } = useLocale();
  const online = useOnline();
  const profile = useProfileState();
  const ready = profile === "ready";
  // getSafe returns null for an id that is not one of this person's pages.
  const note = useQuery(api.notes.getSafe, ready ? { noteId: routineId } : "skip");

  let body: ReactNode;
  if (profile === "loading" || (ready && note === undefined)) {
    body = (
      <>
        {online ? null : <StateOffline />}
        <StateLoading label={t("rd.loading")} rows={LOADING_ROWS} />
      </>
    );
  } else if (profile === "signed-out") {
    body = <StateSignedOut />;
  } else if (!note) {
    body = <StateEmpty icon="list" title={t("rd.gone")} />;
  } else {
    body = <GuideBody key={note._id} note={note} online={online} />;
  }

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <BackLink />
      {body}
    </div>
  );
}

function GuideBody({ note, online }: { note: Doc<"notes">; online: boolean }) {
  const { t } = useLocale();
  const steps = useMemo(() => parseRoutineSteps(note.body), [note.body]);
  const minutes = totalMinutes(steps);
  // Opening the screen starts the run, or picks up the place this tab saved for it.
  const [resumed] = useState(() =>
    readSavedRun(sessionRunStorage(), note._id, steps.length, Date.now())
  );
  const [stored, setRun] = useState<RoutineRun | null>(resumed);
  // If the steps change while it is open, it starts again.
  const run = stored && stored.statuses.length === steps.length ? stored : startRun(steps.length);
  const [said, setSaid] = useState<keyof typeof NOTE | null>(resumed ? "resumed" : null);
  const focusNext = useRef(false);
  const stepTitle = useRef<HTMLHeadingElement | null>(null);
  const finishTitle = useRef<HTMLHeadingElement | null>(null);
  const finished = isRunFinished(run);
  const editHref = `/notes/${note._id}`;

  // After Done, Skip or Back, focus moves to the new step (or the finish panel), like the design.
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    (finished ? finishTitle : stepTitle).current?.focus();
  });

  const keep = (next: RoutineRun) => {
    setRun(next);
    saveRun(sessionRunStorage(), note._id, next, Date.now());
  };

  const move = (next: RoutineRun, kind: keyof typeof NOTE) => {
    if (next === run) return;
    focusNext.current = true;
    setSaid(kind);
    keep(next);
  };

  const header = (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title" dir="auto">
          {note.title.trim() || t("notes.untitled")}
        </h1>
        <p className="tp-pagehead__sub">{t("rd.sub")}</p>
      </div>
    </header>
  );

  if (steps.length === 0) {
    return (
      <>
        {header}
        {online ? null : <StateOffline />}
        <StateEmpty icon="list" title={t("rd.empty.t")} body={t("rd.empty.b")}>
          <Link className="tp-btn tp-btn--secondary" href={editHref}>
            <TpIcon name="edit" size="sm" />
            <span>{t("rd.edit")}</span>
          </Link>
        </StateEmpty>
      </>
    );
  }

  const step = steps[Math.min(run.index, steps.length - 1)];
  const tally = runTally(run);

  return (
    <>
      {header}
      {online ? null : <StateOffline />}

      <div className="tp-split" data-component="Split">
        {finished ? (
          <section
            className="tp-status-panel"
            data-tone="done"
            data-component="StatusPanel"
            aria-labelledby="rd-finish-title"
          >
            <span className="tp-status-panel__icon">
              <TpIcon name="leaf" size="lg" />
            </span>
            <h2
              className="tp-status-panel__title"
              id="rd-finish-title"
              tabIndex={-1}
              ref={finishTitle}
            >
              {t("rd.fin.t")}
            </h2>
            <p className="tp-status-panel__body">
              <span>{t("rd.fin.done")}</span> <span className="tp-num">{tally.done}</span> ·{" "}
              <span>{t("rd.fin.skipped")}</span> <span className="tp-num">{tally.skipped}</span>.{" "}
              <span>{t("rd.fin.b")}</span>
            </p>
            <div className="tp-status-panel__actions">
              <Link className="tp-btn tp-btn--secondary" href="/today">
                <TpIcon name="today" size="sm" />
                <span>{t("rd.fin.today")}</span>
              </Link>
              <Link className="tp-btn tp-btn--ghost" href="/routines">
                <span>{t("rd.back")}</span>
              </Link>
            </div>
          </section>
        ) : (
          <section
            className="tp-surface rd-guide"
            data-component="Surface"
            aria-labelledby="rd-step-title"
            id="rd-guide"
          >
            <output className="tp-eyebrow block" aria-live="polite" id="rd-progress">
              <span>{t("rd.step")}</span> <span className="tp-num">{run.index + 1}</span>{" "}
              <span>{t("rd.of")}</span> <span className="tp-num">{steps.length}</span>
            </output>
            <ol className="rd-dots" aria-hidden="true">
              {run.statuses.map((status, index) => (
                <li key={index}>
                  <span className={`tp-dot tp-dot--${DOT[status]}`} />
                </li>
              ))}
            </ol>

            <div className="rd-step">
              <h2
                className="tp-page-title"
                id="rd-step-title"
                tabIndex={-1}
                dir="auto"
                ref={stepTitle}
              >
                {step?.title}
              </h2>
              {step?.note ? (
                <p className="tp-muted" dir="auto">
                  {step.note}
                </p>
              ) : null}
              {step?.minutes ? (
                <p className="tp-small tp-muted">
                  <TpIcon name="clock" size="sm" /> <span>{t("rt.about")}</span>{" "}
                  <span className="tp-num">{step.minutes}</span> <span>{t("hr.min")}</span>
                </p>
              ) : null}
            </div>

            {run.paused ? (
              <output className="tp-notice" data-tone="info" data-component="Notice">
                <span className="tp-notice__icon">
                  <TpIcon name="pause" size="sm" />
                </span>
                <span className="tp-notice__text">
                  <span className="tp-notice__title">{t("rd.paused.t")}</span>
                  <span>{t("rd.paused.b")}</span>
                </span>
              </output>
            ) : null}
            <output className="tp-muted tp-small block" aria-live="polite">
              {said ? t(NOTE[said]) : ""}
            </output>

            <div className="rd-actions">
              <button
                className="tp-btn tp-btn--primary"
                type="button"
                disabled={run.paused}
                data-component="Button"
                onClick={() => move(finishStep(run, "done"), "done")}
              >
                <TpIcon name="check" size="sm" />
                <span>{t("rd.done")}</span>
              </button>
              <button
                className="tp-btn tp-btn--secondary"
                type="button"
                disabled={run.paused}
                onClick={() => move(finishStep(run, "skipped"), "skipped")}
              >
                <TpIcon name="arrow" size="sm" flip />
                <span>{t("rd.skip")}</span>
              </button>
              <button
                className="tp-btn tp-btn--ghost"
                type="button"
                aria-pressed={run.paused}
                onClick={() => {
                  setSaid(null);
                  keep(togglePause(run));
                }}
              >
                <TpIcon name={run.paused ? "play" : "pause"} size="sm" />
                <span>{run.paused ? t("rd.resume") : t("rd.pause")}</span>
              </button>
              {run.index > 0 ? (
                <button
                  className="tp-btn tp-btn--ghost"
                  type="button"
                  disabled={run.paused}
                  onClick={() => move(reopenStep(run), "reopened")}
                >
                  <TpIcon name="undo" size="sm" />
                  <span>{t("rd.backstep")}</span>
                </button>
              ) : null}
            </div>
          </section>
        )}

        <section className="tp-section rd-aside" data-component="Section" aria-labelledby="rd-all">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="rd-all">
              {t("rd.all")}
            </h2>
            {minutes === null ? null : (
              <span className="tp-section__count">
                <span>{t("rt.about")}</span> <span className="tp-num">{minutes}</span>{" "}
                <span>{t("hr.min")}</span>
              </span>
            )}
          </div>
          <ol className="tp-list tp-surface" data-component="ListRow">
            {steps.map((item, index) => {
              const status = run.statuses[index] ?? "next";
              return (
                <li key={index}>
                  <div className="tp-list-row" aria-current={status === "now" ? "step" : undefined}>
                    <span className="tp-list-row__icon">
                      <TpIcon
                        name={ICON[status]}
                        size="sm"
                        flip={status === "now" || status === "skipped"}
                      />
                    </span>
                    <span className="tp-list-row__body">
                      <span className="tp-list-row__title" dir="auto">
                        {item.title}
                      </span>
                    </span>
                    <span className="tp-list-row__end">{t(WORD[status])}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <Link className="tp-btn tp-btn--ghost" href={editHref}>
            <TpIcon name="edit" size="sm" />
            <span>{t("rd.edit")}</span>
          </Link>
        </section>
      </div>
    </>
  );
}
