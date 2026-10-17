"use client";

import {
  FlashcardReviewView,
  fillNodes,
  initReview,
  type ReviewAction,
  reviewKeyDown,
  reviewReducer,
} from "@tempo/ui";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { OfflineNotice, StateEmpty, StateLoading } from "@/components/goals/shared";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { ReviewButton } from "../../../../packages/core/srs/sm2";
import { setHref } from "./hub";
import { countKey, reviewLabels, type StudyT } from "./labels";
import { useReadAloudSlot } from "./recap/useReadAloud";
import {
  cardKey,
  type GradedStates,
  type OtherKindSet,
  type QueueCard,
  type SavedGrade,
  sessionItems,
} from "./session";
import { TypeAnswersToggle } from "./TypeAnswersToggle";
import { useTypedAnswers } from "./useTypedAnswers";

/** The review session's markup and session state, with no data access (ReviewSession.tsx saves). */
export function SessionHeader({ t, count }: { t: StudyT; count: number | null }) {
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("st.review.title")}</h1>
        {count !== null && count > 0 ? (
          <p className="tp-pagehead__sub">
            {fillNodes(t(countKey("st.review.sub", count)), { n: count })}
          </p>
        ) : null}
      </div>
      <div className="tp-pagehead__actions">
        <Link className="tp-btn tp-btn--ghost" href="/study">
          <TpIcon name="chevron" size="sm" className="tp-icon--back" />
          <span>{t("st.review.back")}</span>
        </Link>
      </div>
    </header>
  );
}

export type ReviewSessionViewProps = {
  /** null while loading. */
  cards: readonly QueueCard[] | null;
  now: number;
  online: boolean;
  signedOut?: boolean;
  /** `?set=` names no set this person can open (made up, someone else's, or removed). */
  setGone?: boolean;
  /** `?set=` names a live quiz or practice test: Review is for flashcards, so it links there. */
  otherKind?: OtherKindSet;
  onSave: (key: string, button: ReviewButton) => Promise<SavedGrade>;
  onUndo: (grade: SavedGrade) => Promise<void>;
};

export function ReviewSessionView({
  cards,
  now,
  online,
  signedOut,
  setGone = false,
  otherKind,
  onSave,
  onUndo,
}: ReviewSessionViewProps) {
  const { t } = useLocale();
  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack"
      data-component="PageLayout"
      data-screen="ReviewSession"
    >
      <SessionHeader t={t} count={setGone || otherKind ? null : (cards?.length ?? null)} />
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {signedOut ? (
        <StateSignedOut />
      ) : setGone ? (
        <StateEmpty
          icon="card"
          title={t("st.set.gone.title")}
          body={t("st.set.gone.body")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/study">
              <span>{t("st.review.back")}</span>
            </Link>
          }
        />
      ) : otherKind ? (
        <StateEmpty
          icon="card"
          title={t("st.review.otherKind.title")}
          body={t(`st.review.otherKind.${otherKind.kind}`)}
          action={
            <div className="tp-study-actions">
              <Link className="tp-btn tp-btn--primary" href={setHref(otherKind.setId)}>
                <span>{t(`st.review.otherKind.open.${otherKind.kind}`)}</span>
              </Link>
              <Link className="tp-btn tp-btn--secondary" href="/study">
                <span>{t("st.review.back")}</span>
              </Link>
            </div>
          }
        />
      ) : cards === null ? (
        <StateLoading label={t("st.review.loading")} lead="block" rows={1} />
      ) : cards.length === 0 ? (
        <StateEmpty
          icon="check"
          title={t("st.review.empty.title")}
          body={t("st.review.empty.body")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/study">
              <span>{t("st.review.back")}</span>
            </Link>
          }
        />
      ) : (
        <SessionRunner cards={cards} now={now} t={t} onSave={onSave} onUndo={onUndo} />
      )}
    </div>
  );
}

function SessionRunner({
  cards,
  now,
  t,
  onSave,
  onUndo,
}: {
  cards: readonly QueueCard[];
  now: number;
  t: StudyT;
  onSave: ReviewSessionViewProps["onSave"];
  onUndo: ReviewSessionViewProps["onUndo"];
}) {
  // Each card's state after its grades in this session; one snapshot per saved grade for Undo.
  const [graded, setGraded] = useState<GradedStates>({});
  const gradedBefore = useRef<GradedStates[]>([]);
  const items = useMemo(() => sessionItems(cards, graded), [cards, graded]);
  const labels = useMemo(() => reviewLabels(t), [t]);
  const [state, dispatch] = useReducer(
    reviewReducer,
    cards.map((card) => cardKey(card.setId, card.cardId)),
    initReview
  );
  const readAloud = useReadAloudSlot(state.queue[0]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<"save" | "undo" | null>(null);
  // One saved grade per entry in the session's history, in the same order.
  const saved = useRef<SavedGrade[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const last = saved.current.at(-1);
  // Re-render when the last grade's 5 minutes run out, so its Undo goes away.
  useEffect(() => {
    if (!last) return;
    const left = last.undoUntil - Date.now();
    if (left <= 0) return;
    const timer = window.setTimeout(() => setClock(Date.now()), left + 50);
    return () => window.clearTimeout(timer);
  }, [last]);
  const undoAvailable =
    last !== undefined && last.undoUntil > clock && saved.current.length === state.history.length;
  // "Type answers" (typed recall), remembered per browser. After a grade, the next card's answer
  // field (typed mode) or Show answer takes focus once the save is done (the session is locked
  // until then), and after the last card the done state's title does, so focus never falls to
  // the page.
  const [typed, setTyped] = useTypedAnswers();
  const answerRef = useRef<HTMLInputElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);
  const finished = state.queue.length === 0;
  useEffect(() => {
    if (busy || !focusNext.current) return;
    focusNext.current = false;
    (finished ? doneRef.current : typed ? answerRef.current : revealRef.current)?.focus();
  }, [busy, typed, finished]);

  const act = (action: ReviewAction) => {
    if (busyRef.current) return;
    if (action.type === "reveal" || action.type === "type" || action.type === "clear") {
      dispatch(action);
      return;
    }
    if (action.type === "grade") {
      const key = state.queue[0];
      if (key === undefined || !state.revealed) return;
      focusNext.current = true;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      dispatch(action);
      onSave(key, action.button)
        .then((grade) => {
          saved.current = [...saved.current, grade];
          gradedBefore.current = [...gradedBefore.current, graded];
          if (grade.state !== undefined) setGraded({ ...graded, [key]: grade.state });
          setClock(Date.now());
        })
        .catch(() => {
          dispatch({ type: "undo" });
          setNotice("save");
        })
        .finally(() => {
          busyRef.current = false;
          setBusy(false);
        });
      return;
    }
    const grade = saved.current.at(-1);
    if (!grade || state.history.length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    onUndo(grade)
      .then(() => {
        saved.current = saved.current.slice(0, -1);
        const before = gradedBefore.current.at(-1);
        gradedBefore.current = gradedBefore.current.slice(0, -1);
        if (before) setGraded(before);
        dispatch({ type: "undo" });
      })
      .catch(() => setNotice("undo"))
      .finally(() => {
        busyRef.current = false;
        setBusy(false);
      });
  };

  return (
    <div className="tp-study-session">
      {state.queue.length > 0 ? <TypeAnswersToggle t={t} on={typed} onChange={setTyped} /> : null}
      {/* While a grade saves, every control in the session is disabled (one answer at a time). */}
      <fieldset className="tp-study-lock" disabled={busy} aria-busy={busy}>
        <FlashcardReviewView
          cards={items}
          now={now}
          labels={labels}
          state={state}
          onAction={act}
          onKeyDown={reviewKeyDown(state.revealed, act)}
          undoAvailable={undoAvailable}
          readAloud={readAloud}
          typed={typed}
          answerRef={answerRef}
          revealRef={revealRef}
          doneRef={doneRef}
        />
      </fieldset>
      <p className="tp-small tp-muted tp-study-session__status" aria-live="polite">
        {busy ? t("st.review.saving") : ""}
      </p>
      {notice ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">
            {notice === "save" ? t("st.review.saveError") : t("st.review.undoError")}
          </span>
        </p>
      ) : null}
      {state.queue.length === 0 ? (
        <div className="tp-study-actions">
          <Link className="tp-btn tp-btn--secondary" href="/study">
            <span>{t("st.review.back")}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
