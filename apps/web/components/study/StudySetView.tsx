"use client";

import {
  AdaptiveQuiz,
  coreQuizEngine,
  coreTestScorer,
  FlashcardDeck,
  fillNodes,
  type QuizEngine,
  TestRunner,
  type TestScore,
} from "@tempo/ui";
import type { FlashcardsData, QuizData, StudyBlockType, TestData } from "@tempo/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  makeToast,
  OfflineNotice,
  StateEmpty,
  StateLoading,
  type ToastState,
  UndoToast,
} from "@/components/goals/shared";
import { ShareSheet } from "@/components/share";
import { StateSignedOut } from "@/components/you/ScreenStates";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { reviewHref } from "./hub";
import { listenHref } from "./recap/player";
import { useReadAloudSlot } from "./recap/useReadAloud";
import { deckLabels, KIND_ICON, KIND_KEY, quizLabels, type StudyT, testLabels } from "./labels";
import type { StudyPreview } from "./preview";
import { SetEditor } from "./SetEditor";
import { blockPreview, closedEdit, type EditResult, setEditReducer } from "./set-edit";
import { setMarkdownWords, setShareTarget } from "./set-share";
import { TypeAnswersToggle } from "./TypeAnswersToggle";
import { useTypedAnswers } from "./useTypedAnswers";
import {
  type AttemptAnswer,
  deckCounts,
  onlyQuizQuestions,
  onlyTestQuestions,
  quizAttempt,
  testAttempt,
} from "./set-logic";

/**
 * A set's markup (deck, quiz, test), with no data access: StudySetScreen.tsx passes data and saves.
 * Edit swaps the study panel for the edit list (SetEditor) and Share opens the ShareSheet; the
 * existing study action stays the one primary, and Save changes takes its place while editing.
 */
export type SetBlock =
  | { id: string; type: "flashcards"; data: FlashcardsData }
  | { id: string; type: "quiz"; data: QuizData }
  | { id: string; type: "test"; data: TestData };

export type SetData = {
  set: { setId: string; noteId: string; kind: StudyBlockType; title: string; itemCount: number };
  note: { id: string; title: string };
  block: SetBlock;
  /** The block's content version (`getSet`): Edit sends it back so a save never writes over newer words. */
  blockVersion?: string;
  states: Record<string, { dueAt: number }>;
  attempts: readonly { percent: number; passed?: boolean; finishedAt: number }[];
};

export type RecordAttempt = (attempt: {
  kind: "quiz" | "test";
  score: number;
  maxScore: number;
  answers: AttemptAnswer[];
  startedAt: number;
}) => Promise<unknown>;

/** Save an edited set into its page (`study.updateBlock`), from the version the edit started at. */
export type SaveEdit = (next: StudyPreview, baseVersion: string) => Promise<EditResult>;
/** Undo a saved edit (`study.undoUpdate`): `before` goes back while the block is still `version`. */
export type UndoEdit = (before: StudyPreview, version: string) => Promise<EditResult>;

export function BackToStudy({ t }: { t: StudyT }) {
  return (
    <Link className="tp-btn tp-btn--ghost" href="/study">
      <span>{t("st.review.back")}</span>
    </Link>
  );
}

export type StudySetViewProps = {
  /** undefined while loading; null when the set (or its page) is gone. */
  data: SetData | null | undefined;
  online: boolean;
  now: number;
  signedOut?: boolean;
  onRecord: RecordAttempt;
  onRemove: () => void;
  removeError?: boolean;
  /** Without it (or without a `blockVersion`), the set has no Edit. */
  onSaveEdit?: SaveEdit;
  onUndoEdit?: UndoEdit;
  /** Open with the edit list or the share sheet showing (the gallery and static renders). */
  initialPanel?: "edit" | "share";
};

export function StudySetView({ data, online, signedOut, ...rest }: StudySetViewProps) {
  const { t } = useLocale();
  if (signedOut || data === undefined || data === null) {
    return (
      <div
        className="tp-page tp-page--narrow tp-study-stack"
        data-component="PageLayout"
        data-screen="StudySet"
      >
        {online ? null : <OfflineNotice text={t("gx.offline")} />}
        {signedOut ? (
          <StateSignedOut />
        ) : data === undefined ? (
          <StateLoading label={t("st.set.loading")} lead="block" rows={1} />
        ) : (
          <StateEmpty
            icon="card"
            title={t("st.set.gone.title")}
            body={t("st.set.gone.body")}
            action={<BackToStudy t={t} />}
          />
        )}
      </div>
    );
  }
  return <LoadedSet data={data} online={online} t={t} {...rest} />;
}

function LoadedSet({
  data,
  online,
  now,
  t,
  onRecord,
  onRemove,
  removeError,
  onSaveEdit,
  onUndoEdit,
  initialPanel,
}: Omit<StudySetViewProps, "data" | "signedOut"> & { data: SetData; t: StudyT }) {
  const { set, block, note } = data;
  const last = data.attempts[0];
  const version = data.blockVersion;
  const canEdit = Boolean(onSaveEdit && version);
  const [edit, dispatchEdit] = useReducer(
    setEditReducer,
    initialPanel === "edit" && canEdit && version
      ? setEditReducer(closedEdit, { type: "open", version })
      : closedEdit
  );
  const [sharing, setSharing] = useState(initialPanel === "share");
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  // After Undo: taken back, or not, because the block changed again after the edit.
  const [undoNote, setUndoNote] = useState<"undone" | "changed" | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const focusEdit = useRef(false);
  const saving = useRef(false);

  // Closing the edit list (Cancel, or a save) puts focus back on Edit.
  useEffect(() => {
    if (edit.phase !== "closed" || !focusEdit.current) return;
    focusEdit.current = false;
    editButton.current?.focus();
  }, [edit.phase]);

  const openEdit = () => {
    if (!version) return;
    setUndoNote(null);
    dispatchEdit({ type: "open", version });
  };
  const cancelEdit = () => {
    focusEdit.current = true;
    dispatchEdit({ type: "cancel" });
  };
  const saveEdit = (next: StudyPreview, before: StudyPreview) => {
    const base = edit.baseVersion;
    if (!onSaveEdit || !base || saving.current) return;
    saving.current = true;
    dispatchEdit({ type: "save" });
    onSaveEdit(next, base)
      .then((result) => {
        if (result.status === "changed") {
          dispatchEdit({ type: "changed" });
          return;
        }
        focusEdit.current = true;
        dispatchEdit({ type: "saved" });
        setToast(
          makeToast(
            t("st.se.toast"),
            onUndoEdit
              ? async () => {
                  const back = await onUndoEdit(before, result.version);
                  setUndoNote(back.status === "changed" ? "changed" : "undone");
                }
              : undefined
          )
        );
      })
      .catch(() => dispatchEdit({ type: "saveError" }))
      .finally(() => {
        saving.current = false;
      });
  };
  const reloadEdit = () => {
    if (version) dispatchEdit({ type: "reload", version });
  };
  const editing = edit.phase !== "closed";

  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack"
      data-component="PageLayout"
      data-screen="StudySet"
      data-kind={block.type}
    >
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-study-kind">
            <TpIcon name={KIND_ICON[block.type]} size="sm" />
            <span>{t(KIND_KEY[block.type])}</span>
          </p>
          <h1 className="tp-pagehead__title" dir="auto">
            {block.data.title}
          </h1>
          {last && block.type !== "flashcards" ? (
            <p className="tp-pagehead__sub">
              {fillNodes(t("st.set.lastScore"), { percent: last.percent })}
            </p>
          ) : null}
        </div>
        <div className="tp-pagehead__actions">
          <Link className="tp-btn tp-btn--secondary" href={`/notes/${encodeURIComponent(note.id)}`}>
            <TpIcon name="page" size="sm" />
            <span>{t("st.set.openPage")}</span>
          </Link>
          <Link className="tp-btn tp-btn--ghost" href={listenHref(note.id)} data-action="listen-page">
            <TpIcon name="volume" size="sm" />
            <span>{t("st.set.listen")}</span>
          </Link>
          {editing ? null : (
            <>
              {canEdit ? (
                <button
                  ref={editButton}
                  className="tp-btn tp-btn--ghost"
                  type="button"
                  data-action="edit-set"
                  onClick={openEdit}
                >
                  <TpIcon name="edit" size="sm" />
                  <span>{t("st.set.edit")}</span>
                </button>
              ) : null}
              <button
                className="tp-btn tp-btn--ghost"
                type="button"
                data-action="share-set"
                aria-haspopup="dialog"
                onClick={() => setSharing(true)}
              >
                <TpIcon name="send" size="sm" />
                <span>{t("st.set.share")}</span>
              </button>
              <button
                className="tp-btn tp-btn--ghost"
                type="button"
                data-action="remove-set"
                onClick={onRemove}
              >
                <TpIcon name="x" size="sm" />
                <span>{t("st.set.remove")}</span>
              </button>
            </>
          )}
        </div>
      </header>
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {removeError ? <Notice text={t("st.set.removeError")} /> : null}
      {undoNote === "changed" ? <Notice text={t("st.se.undoChanged")} /> : null}
      {undoNote === "undone" ? (
        <output className="tp-notice" data-tone="info">
          <span className="tp-notice__icon">
            <TpIcon name="undo" size="sm" />
          </span>
          <span className="tp-notice__text">{t("st.se.undone")}</span>
        </output>
      ) : null}
      {editing && version ? (
        <SetEditor
          key={edit.baseVersion ?? ""}
          base={blockPreview(block)}
          pageTitle={note.title}
          state={edit}
          currentVersion={version}
          t={t}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onReload={reloadEdit}
        />
      ) : block.type === "flashcards" ? (
        <DeckPanel setId={set.setId} data={block.data} states={data.states} now={now} t={t} />
      ) : block.type === "quiz" ? (
        <QuizPanel key={block.id} data={block.data} t={t} onRecord={onRecord} />
      ) : (
        <TestPanel key={block.id} data={block.data} t={t} onRecord={onRecord} />
      )}
      {sharing ? (
        <ShareSheet
          target={setShareTarget(
            set.setId,
            block,
            setMarkdownWords(t),
            typeof window === "undefined" ? "" : window.location.origin
          )}
          onClose={() => setSharing(false)}
        />
      ) : null}
      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="tp-notice" data-tone="caution" role="alert">
      <span className="tp-notice__icon">
        <TpIcon name="alert" size="sm" />
      </span>
      <span className="tp-notice__text">{text}</span>
    </p>
  );
}

function DeckPanel({
  setId,
  data,
  states,
  now,
  t,
}: {
  setId: string;
  data: FlashcardsData;
  states: SetData["states"];
  now: number;
  t: StudyT;
}) {
  const { due, fresh } = deckCounts(data.cards, states, now);
  const labels = useMemo(() => deckLabels(t), [t]);
  const readAloud = useReadAloudSlot();
  const [typed, setTyped] = useTypedAnswers();
  return (
    <>
      <div className="tp-study-deckbar" data-component="Toolbar">
        <p className="tp-study-deckbar__text">
          {due + fresh > 0
            ? fillNodes(t("st.set.dueLine"), { due, fresh })
            : t("st.set.nothingDue")}
        </p>
        {due + fresh > 0 ? (
          // The deck's Flip is this screen's one primary action, so this link stays secondary.
          <Link
            className="tp-btn tp-btn--secondary"
            href={reviewHref(setId)}
            data-action="review-due"
          >
            <TpIcon name="play" size="sm" />
            <span>{t("st.set.reviewDue")}</span>
          </Link>
        ) : null}
      </div>
      <TypeAnswersToggle t={t} on={typed} onChange={setTyped} />
      <FlashcardDeck cards={data.cards} labels={labels} readAloud={readAloud} typed={typed} />
    </>
  );
}

/** Wraps an engine so each answer is noted (question id → right or not) for the attempt record. */
function loggingEngine<S>(engine: QuizEngine<S>, log: Map<string, boolean>): QuizEngine<S> {
  return {
    ...engine,
    start: () => {
      log.clear();
      return engine.start();
    },
    answer: (state, choiceId) => {
      const question = engine.current(state);
      const result = engine.answer(state, choiceId);
      if (question) log.set(question.id, result.correct);
      return result;
    },
  };
}

function QuizPanel({ data, t, onRecord }: { data: QuizData; t: StudyT; onRecord: RecordAttempt }) {
  const labels = useMemo(() => quizLabels(t), [t]);
  const [missed, setMissed] = useState<string[] | null>(null);
  const [round, setRound] = useState(0);
  const readAloud = useReadAloudSlot(round);
  const [saveError, setSaveError] = useState(false);
  const startedAt = useRef(Date.now());
  const log = useRef(new Map<string, boolean>()).current;
  const engine = useMemo(() => {
    const questions = missed ? onlyQuizQuestions(data.questions, missed) : data.questions;
    return loggingEngine(coreQuizEngine(questions, { mode: missed ? "fixed" : data.mode }), log);
  }, [data, missed, log]);
  const finish = () => {
    const attempt = quizAttempt(log);
    const at = startedAt.current;
    startedAt.current = Date.now();
    // A short "missed ones" round is practice, not a full attempt: only full rounds are recorded.
    if (missed || attempt.maxScore === 0) return;
    setSaveError(false);
    onRecord({ kind: "quiz", ...attempt, startedAt: at }).catch(() => setSaveError(true));
  };
  return (
    <>
      {missed ? (
        <MissedBar
          t={t}
          onAll={() => {
            setMissed(null);
            setRound((n) => n + 1);
          }}
        />
      ) : null}
      <AdaptiveQuiz
        key={`${round}`}
        engine={engine}
        labels={labels}
        readAloud={readAloud}
        onFinish={finish}
        onReviewMissed={(ids) => {
          if (ids.length === 0) return;
          startedAt.current = Date.now();
          setMissed(ids);
          setRound((n) => n + 1);
        }}
      />
      {saveError ? <Notice text={t("st.set.saveError")} /> : null}
    </>
  );
}

function MissedBar({ t, onAll }: { t: StudyT; onAll: () => void }) {
  return (
    <div className="tp-study-deckbar" data-component="Toolbar">
      <p className="tp-study-deckbar__text">{t("st.set.missedOnly")}</p>
      <button className="tp-btn tp-btn--ghost" type="button" onClick={onAll}>
        {t("st.set.allAgain")}
      </button>
    </div>
  );
}

function TestPanel({ data, t, onRecord }: { data: TestData; t: StudyT; onRecord: RecordAttempt }) {
  const labels = useMemo(() => testLabels(t), [t]);
  const [missed, setMissed] = useState<string[] | null>(null);
  const [round, setRound] = useState(0);
  const readAloud = useReadAloudSlot(round);
  const [saveError, setSaveError] = useState(false);
  const startedAt = useRef(Date.now());
  const test = useMemo(
    () => (missed ? (onlyTestQuestions(data, missed) ?? data) : data),
    [data, missed]
  );
  const complete = (score: TestScore) => {
    const at = startedAt.current;
    startedAt.current = Date.now();
    if (missed || score.max <= 0) return;
    setSaveError(false);
    onRecord({ kind: "test", ...testAttempt(score), startedAt: at }).catch(() =>
      setSaveError(true)
    );
  };
  return (
    <>
      {missed ? (
        <MissedBar
          t={t}
          onAll={() => {
            setMissed(null);
            setRound((n) => n + 1);
          }}
        />
      ) : null}
      <TestRunner
        key={`${round}`}
        test={test}
        scorer={coreTestScorer}
        labels={labels}
        readAloud={readAloud}
        onComplete={complete}
        onReviewMissed={(ids) => {
          if (ids.length === 0) return;
          startedAt.current = Date.now();
          setMissed(ids);
          setRound((n) => n + 1);
        }}
      />
      {saveError ? <Notice text={t("st.set.saveError")} /> : null}
    </>
  );
}
