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
import { useMemo, useRef, useState } from "react";
import { OfflineNotice, SignedOutState, StateEmpty, StateLoading } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { reviewHref } from "./hub";
import { deckLabels, KIND_ICON, KIND_KEY, quizLabels, type StudyT, testLabels } from "./labels";
import {
  type AttemptAnswer,
  deckCounts,
  onlyQuizQuestions,
  onlyTestQuestions,
  quizAttempt,
  testAttempt,
} from "./set-logic";

/** A set's markup (deck, quiz, test), with no data access: StudySetScreen.tsx passes data and saves. */
export type SetBlock =
  | { id: string; type: "flashcards"; data: FlashcardsData }
  | { id: string; type: "quiz"; data: QuizData }
  | { id: string; type: "test"; data: TestData };

export type SetData = {
  set: { setId: string; noteId: string; kind: StudyBlockType; title: string; itemCount: number };
  note: { id: string; title: string };
  block: SetBlock;
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
};

export function StudySetView({
  data,
  online,
  now,
  signedOut,
  onRecord,
  onRemove,
  removeError,
}: StudySetViewProps) {
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
          <SignedOutState />
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
  const { set, block, note } = data;
  const last = data.attempts[0];
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
          <button
            className="tp-btn tp-btn--ghost"
            type="button"
            data-action="remove-set"
            onClick={onRemove}
          >
            <TpIcon name="x" size="sm" />
            <span>{t("st.set.remove")}</span>
          </button>
        </div>
      </header>
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {removeError ? <Notice text={t("st.set.removeError")} /> : null}
      {block.type === "flashcards" ? (
        <DeckPanel setId={set.setId} data={block.data} states={data.states} now={now} t={t} />
      ) : block.type === "quiz" ? (
        <QuizPanel key={block.id} data={block.data} t={t} onRecord={onRecord} />
      ) : (
        <TestPanel key={block.id} data={block.data} t={t} onRecord={onRecord} />
      )}
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
      <FlashcardDeck cards={data.cards} labels={labels} />
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
