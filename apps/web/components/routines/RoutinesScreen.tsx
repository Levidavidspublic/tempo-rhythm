"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ScreenErrorBoundary,
  type SkeletonRow,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  Template,
  useOnline,
  useProfileState,
} from "@/components/habits/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import {
  isRoutinePage,
  newRoutineBody,
  parseRoutineSteps,
  ROUTINE_TAG,
  type RoutineStep,
  routineThatFitsNow,
  routineUsualTime,
  totalMinutes,
} from "@/lib/routines";

const LOADING_ROWS: readonly SkeletonRow[] = [
  ["w40", "w80"],
  ["w60", "w80"],
  ["w40", "w80"],
];
const FIRST_STEPS = 3;

type RoutineCardModel = {
  id: string;
  title: string;
  steps: RoutineStep[];
  minutes: number | null;
  usualTime: string | null;
};

/** Minutes since local midnight, refreshed every minute (for "Fits right now"). */
function useMinutesNow(): number {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Routines (docs/design/v3/screens/web/routines.html). A routine is a Markdown page tagged
 * #routine; its list items are the steps (lib/routines.ts). The one that fits the time of day
 * gets "Fits right now" and the one main Start. New routine makes a tagged page to write in.
 *
 * Left out until a routines backend exists (docs/BACKEND-SCHEMA.md: the owner decides):
 * "Last done" and "Paused at step N" / Resume, since runs are not stored anywhere.
 */
export function RoutinesScreen() {
  return (
    <ScreenErrorBoundary fallback={(retry) => <RoutinesFailed onRetry={retry} />}>
      <RoutinesContent />
    </ScreenErrorBoundary>
  );
}

function RoutinesHeader({ children }: { children?: ReactNode }) {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("rt.title")}</h1>
        <p className="tp-pagehead__sub">{t("rt.sub")}</p>
      </div>
      {children ? <div className="tp-pagehead__actions">{children}</div> : null}
    </header>
  );
}

function RoutinesFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <RoutinesHeader />
      <StateError title={t("rt.error")} onRetry={onRetry} />
    </div>
  );
}

function HowRoutinesWork() {
  const { t } = useLocale();
  return (
    <p className="tp-muted tp-small">
      <Template
        template={t("rt.how")}
        slots={{
          tag: (
            <span className="tp-tag" dir="ltr">
              {ROUTINE_TAG.slice(1)}
            </span>
          ),
          example: (
            <span className="tp-mono" dir="ltr">
              {`${ROUTINE_TAG} 07:30`}
            </span>
          ),
        }}
      />
    </p>
  );
}

function RoutinesContent() {
  const { t } = useLocale();
  const router = useRouter();
  const online = useOnline();
  const profile = useProfileState();
  const ready = profile === "ready";
  // notes.listRoutines returns recent pages that mention the tag (bounded); isRoutinePage checks
  // it is really the tag.
  const notes = useQuery(api.notes.listRoutines, ready ? {} : "skip");
  const create = useMutation(api.notes.create);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const nowMinutes = useMinutesNow();

  const routines = useMemo<RoutineCardModel[]>(
    () =>
      (notes ?? [])
        .filter((note) => isRoutinePage(note.body))
        .map((note) => {
          const steps = parseRoutineSteps(note.body);
          return {
            id: note._id,
            title: note.title.trim(),
            steps,
            minutes: totalMinutes(steps),
            usualTime: routineUsualTime(note.body),
          };
        }),
    [notes]
  );
  const fits = routineThatFitsNow(routines, nowMinutes);

  const newRoutine = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(false);
    try {
      const id = await create({ title: t("rt.new"), body: newRoutineBody() });
      router.push(`/notes/${id}`);
    } catch {
      setCreateError(true);
      setCreating(false);
    }
  };

  const state =
    profile === "loading" || (ready && notes === undefined)
      ? "loading"
      : profile === "signed-out"
        ? "signed-out"
        : routines.length === 0
          ? "empty"
          : "default";

  const newButton = (
    <button
      className="tp-btn tp-btn--secondary"
      type="button"
      disabled={creating}
      onClick={() => void newRoutine()}
    >
      <TpIcon name="plus" size="sm" />
      <span>{t("rt.new")}</span>
    </button>
  );

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <RoutinesHeader>{state === "default" ? newButton : null}</RoutinesHeader>

      {online ? null : <StateOffline />}
      {createError ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("hr.saveError")}</span>
        </p>
      ) : null}

      {state === "loading" ? <StateLoading label={t("rt.loading")} rows={LOADING_ROWS} /> : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "empty" ? (
        <>
          <StateEmpty icon="list" title={t("rt.empty.t")} body={t("rt.empty.b")}>
            {newButton}
          </StateEmpty>
          <HowRoutinesWork />
        </>
      ) : null}

      {state === "default" ? (
        <>
          <div className="tp-cards" data-component="CardGrid">
            {routines.map((routine) => (
              <RoutineCard key={routine.id} routine={routine} fitsNow={fits?.id === routine.id} />
            ))}
          </div>
          <p className="tp-muted tp-small">{t("rt.note")}</p>
          <HowRoutinesWork />
        </>
      ) : null}
    </div>
  );
}

function RoutineCard({ routine, fitsNow }: { routine: RoutineCardModel; fitsNow: boolean }) {
  const { t } = useLocale();
  const headingId = `rt-${routine.id}`;
  const href = `/routines/${routine.id}`;
  const title = routine.title || t("notes.untitled");
  const count = routine.steps.length;
  const more = count - FIRST_STEPS;
  return (
    <article className="tp-surface rt-card" data-component="Surface" aria-labelledby={headingId}>
      <div className="rt-card__head">
        <h2 className="tp-h3 rt-card__name" id={headingId}>
          <Link href={href} dir="auto">
            {title}
          </Link>
        </h2>
        {fitsNow ? (
          <span className="tp-badge" data-tone="info" data-component="Badge">
            <TpIcon name="sun" size="sm" />
            <span>{t("rt.fits")}</span>
          </span>
        ) : null}
      </div>
      <p className="rt-card__meta tp-small tp-muted">
        <span>
          <span className="tp-num">{count}</span>{" "}
          <span>{count === 1 ? t("rt.step") : t("rt.steps")}</span>
        </span>
        {routine.minutes === null ? null : (
          <span>
            <span>{t("rt.about")}</span> <span className="tp-num">{routine.minutes}</span>{" "}
            <span>{t("hr.min")}</span>
          </span>
        )}
        {routine.usualTime ? (
          <span>
            <span>{t("rt.usually")}</span>{" "}
            <span className="tp-num tp-mono">{routine.usualTime}</span>
          </span>
        ) : null}
      </p>
      {count > 0 ? (
        <ol className="rt-steps" aria-label={t("rt.first")}>
          {routine.steps.slice(0, FIRST_STEPS).map((step, index) => (
            <li key={index} dir="auto">
              {step.title}
            </li>
          ))}
        </ol>
      ) : null}
      {more > 0 ? (
        <p className="tp-small tp-muted">
          <Template
            template={t("rt.andMore")}
            slots={{ n: <span className="tp-num">{more}</span> }}
          />
        </p>
      ) : null}
      <div className="rt-card__actions">
        <Link
          className={`tp-btn ${fitsNow ? "tp-btn--primary" : "tp-btn--secondary"}`}
          href={href}
          data-component={fitsNow ? "Button" : undefined}
        >
          <TpIcon name="play" size="sm" flip />
          <span>{t("rt.start")}</span>
          <span className="tp-sr-only"> {title}</span>
        </Link>
      </div>
    </article>
  );
}
