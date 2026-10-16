"use client";

import {
  FlashcardReviewView,
  fillNodes,
  initReview,
  type ReviewAction,
  type ReviewCardItem,
  reviewKeyDown,
  reviewReducer,
} from "@tempo/ui";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  OfflineNotice,
  ScreenBoundary,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ReviewButton } from "../../../../packages/core/srs/sm2";
import { countKey, reviewLabels, type StudyT } from "./labels";

/**
 * The review session (/study/review, or one set with ?set=<id>): FlashcardReview over
 * `study.reviewQueue`, each grade saved with `study.review` and taken back with `study.undoReview`
 * for 5 minutes. The queue is read once when the session starts, so a card that is no longer due
 * after its grade doesn't end the session early. The grade buttons are disabled while a grade (or
 * an Undo) is saving.
 */

export type QueueCard = {
  setId: string;
  setTitle: string;
  cardId: string;
  front: string;
  back: string;
  hint?: string;
  state: ReviewCardItem["state"];
};

/** The session's cards, keyed by set and card (a card id is only unique inside its deck). */
export function sessionItems(cards: readonly QueueCard[]): ReviewCardItem[] {
  return cards.map((card) => ({
    key: cardKey(card.setId, card.cardId),
    front: card.front,
    back: card.back,
    ...(card.hint ? { hint: card.hint } : {}),
    state: card.state,
  }));
}

export function cardKey(setId: string, cardId: string): string {
  return `${setId}\u0000${cardId}`;
}

export function splitKey(key: string): { setId: string; cardId: string } {
  const at = key.indexOf("\u0000");
  return { setId: key.slice(0, at), cardId: key.slice(at + 1) };
}

/** One saved grade: what to send to `study.undoReview`, and until when. */
export type SavedGrade = { reviewId: string; undoUntil: number };

export function ReviewSession({ setId }: { setId?: string }) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout">
          <SessionHeader t={t} count={null} />
          <StateError title={t("st.review.error")} onRetry={retry} />
        </div>
      )}
    >
      <ReviewSessionData setId={setId} />
    </ScreenBoundary>
  );
}

function ReviewSessionData({ setId }: { setId?: string }) {
  const signedIn = useSignedIn();
  const online = useOnline();
  const args = setId ? { setId: setId as Id<"studySets"> } : {};
  const queue = useQuery(api.study.reviewQueue, signedIn === "ready" ? args : "skip");
  const [snapshot, setSnapshot] = useState<{ cards: QueueCard[]; now: number } | null>(null);
  useEffect(() => {
    if (queue && !snapshot) setSnapshot({ cards: queue.cards as QueueCard[], now: Date.now() });
  }, [queue, snapshot]);
  const review = useMutation(api.study.review);
  const undoReview = useMutation(api.study.undoReview);
  const save = async (key: string, button: ReviewButton): Promise<SavedGrade> => {
    const { setId: sid, cardId } = splitKey(key);
    const result = await review({ setId: sid as Id<"studySets">, cardId, button });
    return { reviewId: result.reviewId, undoUntil: result.undoUntil };
  };
  const undo = async (grade: SavedGrade) => {
    await undoReview({ reviewId: grade.reviewId as Id<"studyReviews"> });
  };
  return (
    <ReviewSessionView
      cards={signedIn === "signedOut" ? [] : (snapshot?.cards ?? null)}
      now={snapshot?.now ?? 0}
      online={online}
      signedOut={signedIn === "signedOut"}
      onSave={save}
      onUndo={undo}
    />
  );
}

function SessionHeader({ t, count }: { t: StudyT; count: number | null }) {
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("st.review.title")}</h1>
        {count !== null && count > 0 ? (
          <p className="tp-pagehead__sub">{fillNodes(t(countKey("st.review.sub", count)), { n: count })}</p>
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
  onSave: (key: string, button: ReviewButton) => Promise<SavedGrade>;
  onUndo: (grade: SavedGrade) => Promise<void>;
};

export function ReviewSessionView({ cards, now, online, signedOut, onSave, onUndo }: ReviewSessionViewProps) {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout" data-screen="ReviewSession">
      <SessionHeader t={t} count={cards?.length ?? null} />
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {signedOut ? (
        <SignedOutState />
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
  const items = useMemo(() => sessionItems(cards), [cards]);
  const labels = useMemo(() => reviewLabels(t), [t]);
  const [state, dispatch] = useReducer(
    reviewReducer,
    items.map((item) => item.key),
    initReview,
  );
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
  const undoAvailable = last !== undefined && last.undoUntil > clock && saved.current.length === state.history.length;

  const act = (action: ReviewAction) => {
    if (busyRef.current) return;
    if (action.type === "reveal") {
      dispatch(action);
      return;
    }
    if (action.type === "grade") {
      const key = state.queue[0];
      if (key === undefined || !state.revealed) return;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      dispatch(action);
      onSave(key, action.button)
        .then((grade) => {
          saved.current = [...saved.current, grade];
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
          <span className="tp-notice__text">{notice === "save" ? t("st.review.saveError") : t("st.review.undoError")}</span>
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
