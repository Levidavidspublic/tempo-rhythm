"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import {
  makeToast,
  ScreenBoundary,
  StateError,
  type ToastState,
  UndoToast,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BackToStudy, type RecordAttempt, type SetData, StudySetView } from "./StudySetView";

/**
 * A study set (/study/[setId]). A deck: browse it (FlashcardDeck) and "Review due cards". A quiz:
 * AdaptiveQuiz over the core engine, in the block's mode. A practice test: TestRunner with the
 * core scorer. Quizzes and tests end in ScoreCard and record the attempt. "Open the page" goes to
 * the page holding the block; "Remove set" takes it off the hub (the page stays) with a 5-minute
 * Undo. "Edit" opens the Turn-into edit list on the saved set and saves it back into the page
 * (`study.updateBlock`, from the block version it started at) with a 5-minute Undo
 * (`study.undoUpdate`).
 */

export function StudySetScreen({ setId }: { setId: string }) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--narrow tp-study-stack" data-component="PageLayout">
          <StateError title={t("st.set.error")} onRetry={retry} action={<BackToStudy t={t} />} />
        </div>
      )}
    >
      <StudySetData setId={setId} />
    </ScreenBoundary>
  );
}

function StudySetData({ setId }: { setId: string }) {
  const { t } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const id = setId as Id<"studySets">;
  const data = useQuery(api.study.getSet, signedIn === "ready" ? { setId: id } : "skip");
  const record = useMutation(api.study.recordAttempt);
  const remove = useMutation(api.study.removeSet);
  const restore = useMutation(api.study.restoreSet);
  const update = useMutation(api.study.updateBlock);
  const undoUpdate = useMutation(api.study.undoUpdate);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);

  const onRecord: RecordAttempt = (attempt) => record({ setId: id, ...attempt });
  const onRemove = () => {
    setRemoveError(false);
    remove({ setId: id })
      .then(() => setToast(makeToast(t("st.set.removed"), () => restore({ setId: id }))))
      .catch(() => setRemoveError(true));
  };

  return (
    <>
      <StudySetView
        data={signedIn === "signedOut" ? null : (data as SetData | null | undefined)}
        signedOut={signedIn === "signedOut"}
        online={online}
        now={Date.now()}
        onRecord={onRecord}
        onRemove={onRemove}
        removeError={removeError}
        onSaveEdit={(next, baseVersion) => update({ setId: id, data: next.data, baseVersion })}
        onUndoEdit={(before, version) => undoUpdate({ setId: id, data: before.data, version })}
      />
      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </>
  );
}
