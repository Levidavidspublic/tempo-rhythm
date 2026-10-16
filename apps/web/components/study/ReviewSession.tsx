"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ScreenBoundary, StateError, useOnline, useSignedIn } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ReviewButton } from "../../../../packages/core/srs/sm2";
import {
  nextSnapshot,
  type QueueCard,
  type SavedGrade,
  type SessionSnapshot,
  splitKey,
} from "./session";
import { ReviewSessionView, SessionHeader } from "./ReviewSessionView";

/**
 * The review session (/study/review, or one set with ?set=<id>): FlashcardReview over
 * `study.reviewQueue`, each grade saved with `study.review` and taken back with `study.undoReview`
 * for 5 minutes. The queue is read once when the session starts, so a card that is no longer due
 * after its grade doesn't end the session early. The grade buttons are disabled while a grade (or
 * an Undo) is saving.
 */

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
      {/* A new set is a new session: fresh query, snapshot and grades. */}
      <ReviewSessionData key={setId ?? ""} setId={setId} />
    </ScreenBoundary>
  );
}

function ReviewSessionData({ setId }: { setId?: string }) {
  const signedIn = useSignedIn();
  const online = useOnline();
  const args = setId ? { setId: setId as Id<"studySets"> } : {};
  const queue = useQuery(api.study.reviewQueue, signedIn === "ready" ? args : "skip");
  const [stored, setSnapshot] = useState<SessionSnapshot | null>(null);
  useEffect(() => {
    const next = nextSnapshot(stored, setId, queue?.cards as QueueCard[] | undefined, Date.now());
    if (next !== stored) setSnapshot(next);
  }, [queue, stored, setId]);
  const snapshot = stored && stored.setId === setId ? stored : null;
  const review = useMutation(api.study.review);
  const undoReview = useMutation(api.study.undoReview);
  const save = async (key: string, button: ReviewButton): Promise<SavedGrade> => {
    const { setId: sid, cardId } = splitKey(key);
    const result = await review({ setId: sid as Id<"studySets">, cardId, button });
    return { reviewId: result.reviewId, undoUntil: result.undoUntil, state: result.state };
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
