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
import { type AskPage, askPageId } from "./SetAsk";
import { BackToStudy, type RecordAttempt, type SetData, StudySetView } from "./StudySetView";

/**
 * A study set (/study/[setId]). A deck: browse it (FlashcardDeck) and "Review due cards". A quiz:
 * AdaptiveQuiz over the core engine, in the block's mode. A practice test: TestRunner with the
 * core scorer. Quizzes and tests end in ScoreCard and record the attempt. "Open the page" goes to
 * the page holding the block; "Remove set" takes it off the hub (the page stays) with a 5-minute
 * Undo. "Edit" opens the Turn-into edit list on the saved set and saves it back into the page
 * (`study.updateBlock`, from the block version it started at) with a 5-minute Undo
 * (`study.undoUpdate`). "Share" opens the ShareSheet for the set. "Ask about this set" reads the
 * set's page with the notes query (`notes.getSafe`, as /study/listen does) only once its panel
 * opens, and searches it with the set's own items on the device.
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
  // The URL string goes to the read as it is: the server checks it and answers null for one that
  // names no set. Writes only happen on a loaded set, so they name the set the server read back.
  const data = useQuery(api.study.getSet, signedIn === "ready" ? { setId } : "skip");
  const record = useMutation(api.study.recordAttempt);
  const remove = useMutation(api.study.removeSet);
  const restore = useMutation(api.study.restoreSet);
  const update = useMutation(api.study.updateBlock);
  const undoUpdate = useMutation(api.study.undoUpdate);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [removeError, setRemoveError] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);
  const loaded = signedIn === "signedOut" ? null : (data as SetData | null | undefined);
  const id = (loaded ? loaded.set.setId : setId) as Id<"studySets">;
  const [askOpened, setAskOpened] = useState(false);
  const pageId = loaded ? askPageId(loaded) : undefined;
  const page = useQuery(
    api.notes.getSafe,
    signedIn === "ready" && askOpened && pageId ? { noteId: pageId } : "skip"
  );
  const askPage: AskPage =
    !pageId || page === null
      ? null
      : page === undefined
        ? undefined
        : { id: pageId, title: page.title, body: page.body };

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
        data={loaded}
        signedOut={signedIn === "signedOut"}
        online={online}
        now={Date.now()}
        onRecord={onRecord}
        onRemove={onRemove}
        removeError={removeError}
        onSaveEdit={(next, baseVersion) => update({ setId: id, data: next.data, baseVersion })}
        onUndoEdit={(before, version) => undoUpdate({ setId: id, data: before.data, version })}
        askPage={askPage}
        onAskOpen={() => setAskOpened(true)}
      />
      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </>
  );
}
