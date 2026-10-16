import type { BagrutQuestion, TestData, TestQuestion } from "@tempo/utils";
import { useEffect, useId, useMemo, useReducer } from "react";
import { Clock, Pause, Play } from "../icons";
import { ScoreCard, type ScoreCardLabels } from "./ScoreCard";
import { fillNodes, fillText } from "./shared";
import {
  isAnswered,
  questionMaxPoints,
  type TestResponse,
  type TestResponses,
  type TestScore,
  type TestScorer,
} from "./test-scorer";

/**
 * S21 TestRunner: a practice test. Sections with their instructions ("Answer 2 of these 3"), the
 * question renderers (`mcq`, `short`, `bagrut`), an optional pausable timer that shows the time
 * left in words and, at zero, asks to submit (it never submits or marks anything on its own), a
 * submit confirm that lists the questions still open, then self-marking of written Bagrut parts
 * against the model answer and rubric, and `ScoreCard`. Scoring is the injected `scorer`'s job.
 */

export type TestRunnerLabels = {
  /** e.g. "Answer {pick} of these {total}." */
  pick: string;
  /** e.g. "Question {number}". */
  question: string;
  /** e.g. "{points} points". */
  points: string;
  /** Label of a short-answer box, e.g. "Your answer". */
  yourAnswer: string;
  /** e.g. "Part {label}". */
  part: string;
  submit: string;
  /** e.g. "{minutes} min left". */
  minutesLeft: string;
  /** e.g. "{seconds} s left". */
  secondsLeft: string;
  pause: string;
  resume: string;
  /** e.g. "Paused". */
  paused: string;
  /** e.g. "Time is up. Submit when you're ready." */
  timeUp: string;
  confirmTitle: string;
  /** e.g. "These are still open:" */
  confirmOpen: string;
  /** e.g. "Every question has an answer." */
  confirmAllAnswered: string;
  /** e.g. "{section}, question {number}". */
  openItem: string;
  confirmSubmit: string;
  keepGoing: string;
  markTitle: string;
  /** e.g. "Compare each part with the model answer and give yourself points." */
  markIntro: string;
  modelAnswer: string;
  rubric: string;
  /** Shown when a part has no answer written, e.g. "Nothing written." */
  nothingWritten: string;
  /** e.g. "Your points (0 to {max})". */
  givePoints: string;
  seeScore: string;
  scoreCard: ScoreCardLabels;
};

export type TestRunnerProps = {
  test: TestData;
  scorer: TestScorer;
  labels: TestRunnerLabels;
  /** Called once with the score when the attempt ends, e.g. to record it. */
  onComplete?: (score: TestScore, responses: TestResponses) => void;
  /** "Review the ones you missed": receives the counted question ids that lost points. */
  onReviewMissed?: (missedIds: string[]) => void;
};

export type TimerState = { remainingMs: number; paused: boolean };
export type TimerAction = { type: "tick"; ms: number } | { type: "pause" } | { type: "resume" };

export function initTimer(durationMin: number | undefined): TimerState | null {
  return durationMin === undefined ? null : { remainingMs: durationMin * 60_000, paused: false };
}

/** Pure countdown. A paused or finished timer ignores ticks. */
export function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "tick":
      if (state.paused || state.remainingMs <= 0) return state;
      return { ...state, remainingMs: Math.max(0, state.remainingMs - Math.max(0, action.ms)) };
    case "pause":
      return state.remainingMs <= 0 ? state : { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
  }
}

export type RunnerPhase = "answer" | "confirm" | "mark" | "done";

export type RunnerState = {
  phase: RunnerPhase;
  responses: TestResponses;
  timer: TimerState | null;
  score: TestScore | null;
};

export type RunnerAction =
  | { type: "respond"; questionId: string; response: TestResponse }
  | { type: "mark"; questionId: string; partId: string; points: number }
  | { type: "askSubmit" }
  | { type: "keepGoing" }
  | { type: "submit" }
  | { type: "finishMarking" }
  | { type: "restart" }
  | TimerAction;

export function initRunner(test: TestData): RunnerState {
  return { phase: "answer", responses: {}, timer: initTimer(test.durationMin), score: null };
}

function allQuestions(test: TestData): TestQuestion[] {
  return test.sections.flatMap((section) => section.questions);
}

/** Bagrut questions with something written: the ones the student marks after submitting. */
export function questionsToMark(test: TestData, responses: TestResponses): BagrutQuestion[] {
  return allQuestions(test).filter(
    (question): question is BagrutQuestion =>
      question.plugin === "bagrut" && isAnswered(question, responses[question.id])
  );
}

export type OpenQuestion = { questionId: string; sectionTitle: string; number: number };

/**
 * Questions still open, for the submit confirm. In a `pick` section, once N are answered the
 * rest are not open: the student chose not to answer them.
 */
export function openQuestions(test: TestData, responses: TestResponses): OpenQuestion[] {
  const open: OpenQuestion[] = [];
  for (const section of test.sections) {
    const answered = section.questions.filter((q) => isAnswered(q, responses[q.id])).length;
    if (section.pick !== undefined && answered >= section.pick) continue;
    section.questions.forEach((question, index) => {
      if (!isAnswered(question, responses[question.id]))
        open.push({ questionId: question.id, sectionTitle: section.title, number: index + 1 });
    });
  }
  return open;
}

/** Pure runner state. Scoring happens only through `scorer`. */
export function runnerReducer(
  test: TestData,
  scorer: TestScorer,
  state: RunnerState,
  action: RunnerAction
): RunnerState {
  switch (action.type) {
    case "respond":
      if (state.phase !== "answer" && state.phase !== "confirm") return state;
      return { ...state, responses: { ...state.responses, [action.questionId]: action.response } };
    case "mark": {
      const response = state.responses[action.questionId];
      if (state.phase !== "mark" || response?.plugin !== "bagrut") return state;
      const marks = { ...response.marks, [action.partId]: action.points };
      return {
        ...state,
        responses: { ...state.responses, [action.questionId]: { ...response, marks } },
      };
    }
    case "askSubmit":
      return state.phase === "answer" ? { ...state, phase: "confirm" } : state;
    case "keepGoing":
      return state.phase === "confirm" ? { ...state, phase: "answer" } : state;
    case "submit":
      if (state.phase !== "confirm") return state;
      if (questionsToMark(test, state.responses).length > 0) return { ...state, phase: "mark" };
      return { ...state, phase: "done", score: scorer(test, state.responses) };
    case "finishMarking":
      if (state.phase !== "mark") return state;
      return { ...state, phase: "done", score: scorer(test, state.responses) };
    case "restart":
      return initRunner(test);
    case "tick":
    case "pause":
    case "resume":
      if (!state.timer || state.phase === "mark" || state.phase === "done") return state;
      return { ...state, timer: timerReducer(state.timer, action) };
  }
}

/** Report the score when this action ends the attempt. */
export function notifyTestEnd(
  test: TestData,
  scorer: TestScorer,
  state: RunnerState,
  action: RunnerAction,
  onComplete: TestRunnerProps["onComplete"]
): void {
  if (action.type !== "submit" && action.type !== "finishMarking") return;
  const next = runnerReducer(test, scorer, state, action);
  if (next.phase === "done" && next.score) onComplete?.(next.score, next.responses);
}

/** The counted questions that lost points, in paper order. */
export function missedQuestionIds(score: TestScore): string[] {
  return score.sections.flatMap((section) =>
    section.counted.filter((id) => {
      const question = score.questions[id];
      return question !== undefined && question.points < question.max;
    })
  );
}

export function TimeLeft({ timer, labels }: { timer: TimerState; labels: TestRunnerLabels }) {
  const { remainingMs } = timer;
  const words =
    remainingMs <= 0
      ? labels.timeUp
      : remainingMs >= 60_000
        ? fillNodes(labels.minutesLeft, { minutes: Math.ceil(remainingMs / 60_000) })
        : fillNodes(labels.secondsLeft, { seconds: Math.ceil(remainingMs / 1000) });
  return (
    <span className="tp-study-timer__left" data-state={remainingMs <= 0 ? "up" : "running"}>
      <Clock className="tp-icon tp-icon--sm" />
      <span>{words}</span>
      {timer.paused ? <span className="tp-badge">{labels.paused}</span> : null}
    </span>
  );
}

export type TestRunnerViewProps = {
  test: TestData;
  state: RunnerState;
  labels: TestRunnerLabels;
  onAction: (action: RunnerAction) => void;
  onReviewMissed?: (missedIds: string[]) => void;
  /** Base for element ids; unique per runner on the page. */
  idBase: string;
};

export function TestRunnerView({
  test,
  state,
  labels,
  onAction,
  onReviewMissed,
  idBase,
}: TestRunnerViewProps) {
  if (state.phase === "done" && state.score) {
    const score = state.score;
    const missed = missedQuestionIds(score);
    const titles = new Map(test.sections.map((section) => [section.id, section.title]));
    return (
      <div className="tp-study-test" data-component="TestRunner" data-phase="done">
        <ScoreCard
          score={score.total}
          max={score.max}
          percent={score.percent}
          passMark={score.passMark}
          passed={score.passed}
          sections={score.sections.map((section) => ({
            title: titles.get(section.sectionId) ?? "",
            score: section.points,
            max: section.max,
          }))}
          missedCount={missed.length}
          onReviewMissed={onReviewMissed ? () => onReviewMissed(missed) : undefined}
          onTryAgain={() => onAction({ type: "restart" })}
          labels={labels.scoreCard}
        />
      </div>
    );
  }

  if (state.phase === "mark") {
    return (
      <section className="tp-artifact tp-study-test" data-component="TestRunner" data-phase="mark">
        <header className="tp-artifact__head">
          <h2 className="tp-artifact__title">{labels.markTitle}</h2>
        </header>
        <div className="tp-artifact__body">
          <p>{labels.markIntro}</p>
          {questionsToMark(test, state.responses).map((question) => (
            <MarkBagrut
              key={question.id}
              question={question}
              response={state.responses[question.id]}
              labels={labels}
              onAction={onAction}
              idBase={`${idBase}-${question.id}`}
            />
          ))}
        </div>
        <footer className="tp-artifact__foot">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            data-action="test-see-score"
            onClick={() => onAction({ type: "finishMarking" })}
          >
            {labels.seeScore}
          </button>
        </footer>
      </section>
    );
  }

  const open = state.phase === "confirm" ? openQuestions(test, state.responses) : [];
  const timer = state.timer;
  return (
    <section
      className="tp-artifact tp-study-test"
      data-component="TestRunner"
      data-phase={state.phase}
    >
      <header className="tp-artifact__head">
        <h2 className="tp-artifact__title" dir="auto">
          {test.title}
        </h2>
        {timer ? (
          <div className="tp-study-timer" role="timer" aria-live="off">
            <TimeLeft timer={timer} labels={labels} />
            {timer.remainingMs > 0 ? (
              <button
                type="button"
                className="tp-btn tp-btn--ghost tp-btn--sm"
                data-action={timer.paused ? "timer-resume" : "timer-pause"}
                onClick={() => onAction({ type: timer.paused ? "resume" : "pause" })}
              >
                {timer.paused ? (
                  <Play className="tp-icon tp-icon--sm" />
                ) : (
                  <Pause className="tp-icon tp-icon--sm" />
                )}
                {timer.paused ? labels.resume : labels.pause}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="tp-artifact__body">
        {timer && timer.remainingMs <= 0 ? (
          <p className="tp-notice" data-tone="info" aria-live="polite">
            {labels.timeUp}
          </p>
        ) : null}
        {test.sections.map((section) => (
          <section className="tp-study-section" key={section.id}>
            <h3 className="tp-study-section__title" dir="auto">
              {section.title}
            </h3>
            {section.instructions ? <p dir="auto">{section.instructions}</p> : null}
            {section.pick !== undefined ? (
              <p className="tp-study-section__pick">
                {fillNodes(labels.pick, { pick: section.pick, total: section.questions.length })}
              </p>
            ) : null}
            <ol className="tp-study-questions">
              {section.questions.map((question, index) => (
                <li className="tp-study-question" key={question.id} data-plugin={question.plugin}>
                  <QuestionInput
                    question={question}
                    number={index + 1}
                    response={state.responses[question.id]}
                    labels={labels}
                    onAction={onAction}
                    idBase={`${idBase}-${question.id}`}
                  />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <footer className="tp-artifact__foot">
        {state.phase === "confirm" ? (
          <div
            className="tp-study-confirm"
            role="alertdialog"
            aria-labelledby={`${idBase}-confirm`}
            data-component="SubmitConfirm"
          >
            <h3 className="tp-label" id={`${idBase}-confirm`}>
              {labels.confirmTitle}
            </h3>
            {open.length > 0 ? (
              <>
                <p>{labels.confirmOpen}</p>
                <ul className="tp-study-confirm__list">
                  {open.map((item) => (
                    <li key={item.questionId} dir="auto">
                      {fillNodes(labels.openItem, {
                        section: item.sectionTitle,
                        number: item.number,
                      })}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>{labels.confirmAllAnswered}</p>
            )}
            <div className="tp-study-confirm__actions">
              <button
                type="button"
                className="tp-btn tp-btn--primary"
                data-action="test-submit-confirm"
                onClick={() => onAction({ type: "submit" })}
              >
                {labels.confirmSubmit}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--secondary"
                data-action="test-keep-going"
                onClick={() => onAction({ type: "keepGoing" })}
              >
                {labels.keepGoing}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            data-action="test-submit"
            onClick={() => onAction({ type: "askSubmit" })}
          >
            {labels.submit}
          </button>
        )}
      </footer>
    </section>
  );
}

type QuestionInputProps = {
  question: TestQuestion;
  number: number;
  response: TestResponse | undefined;
  labels: TestRunnerLabels;
  onAction: (action: RunnerAction) => void;
  idBase: string;
};

function QuestionHead({
  number,
  max,
  labels,
}: {
  number: number;
  max: number;
  labels: TestRunnerLabels;
}) {
  return (
    <span className="tp-study-question__head">
      <span>{fillNodes(labels.question, { number })}</span>
      <span className="tp-study-question__points">{fillNodes(labels.points, { points: max })}</span>
    </span>
  );
}

function QuestionInput({
  question,
  number,
  response,
  labels,
  onAction,
  idBase,
}: QuestionInputProps) {
  const max = questionMaxPoints(question);
  if (question.plugin === "mcq") {
    const chosen = response?.plugin === "mcq" ? response.choiceId : null;
    return (
      <fieldset className="tp-quiz" data-component="Quiz">
        <legend className="tp-quiz__q">
          <QuestionHead number={number} max={max} labels={labels} />
          <span className="tp-study-question__prompt" dir="auto">
            {question.prompt}
          </span>
        </legend>
        {question.choices.map((choice) => (
          <label className="tp-choice" key={choice.id}>
            <input
              type="radio"
              className="tp-radio"
              name={idBase}
              value={choice.id}
              checked={chosen === choice.id}
              onChange={() =>
                onAction({
                  type: "respond",
                  questionId: question.id,
                  response: { plugin: "mcq", choiceId: choice.id },
                })
              }
            />
            <span className="tp-choice__text" dir="auto">
              {choice.text}
            </span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (question.plugin === "short") {
    const text = response?.plugin === "short" ? response.text : "";
    return (
      <div className="tp-field">
        <QuestionHead number={number} max={max} labels={labels} />
        <label className="tp-label" htmlFor={idBase}>
          <span dir="auto">{question.prompt}</span>
          <span className="tp-sr-only"> {labels.yourAnswer}</span>
        </label>
        <input
          id={idBase}
          className="tp-input"
          dir="auto"
          value={text}
          onChange={(event) =>
            onAction({
              type: "respond",
              questionId: question.id,
              response: { plugin: "short", text: event.currentTarget.value },
            })
          }
        />
      </div>
    );
  }

  const parts = response?.plugin === "bagrut" ? response.parts : {};
  const marks = response?.plugin === "bagrut" ? response.marks : {};
  return (
    <div className="tp-study-bagrut">
      <QuestionHead number={number} max={max} labels={labels} />
      <p className="tp-study-question__prompt" dir="auto">
        {question.stem}
      </p>
      {question.parts.map((part) => (
        <div className="tp-field" key={part.id}>
          <label className="tp-label" htmlFor={`${idBase}-${part.id}`}>
            <span>{fillNodes(labels.part, { label: part.label })}</span>{" "}
            <span className="tp-study-question__points">
              {fillNodes(labels.points, { points: part.points })}
            </span>
            <span className="tp-study-part__prompt" dir="auto">
              {part.prompt}
            </span>
          </label>
          <textarea
            id={`${idBase}-${part.id}`}
            className="tp-textarea"
            dir="auto"
            value={parts[part.id] ?? ""}
            onChange={(event) =>
              onAction({
                type: "respond",
                questionId: question.id,
                response: {
                  plugin: "bagrut",
                  parts: { ...parts, [part.id]: event.currentTarget.value },
                  marks,
                },
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

type MarkBagrutProps = {
  question: BagrutQuestion;
  response: TestResponse | undefined;
  labels: TestRunnerLabels;
  onAction: (action: RunnerAction) => void;
  idBase: string;
};

function MarkBagrut({ question, response, labels, onAction, idBase }: MarkBagrutProps) {
  const parts = response?.plugin === "bagrut" ? response.parts : {};
  const marks = response?.plugin === "bagrut" ? response.marks : {};
  return (
    <section className="tp-study-mark" data-component="BagrutMark">
      <p className="tp-study-question__prompt" dir="auto">
        {question.stem}
      </p>
      {question.parts.map((part) => {
        const written = parts[part.id]?.trim() ?? "";
        const inputId = `${idBase}-${part.id}-points`;
        return (
          <div className="tp-study-mark__part" key={part.id}>
            <h4 className="tp-label">
              {fillNodes(labels.part, { label: part.label })}{" "}
              <span className="tp-study-part__prompt" dir="auto">
                {part.prompt}
              </span>
            </h4>
            <p className="tp-study-mark__answer" dir="auto">
              {written === "" ? labels.nothingWritten : written}
            </p>
            {part.modelAnswer ? (
              <div className="tp-study-mark__model">
                <span className="tp-label">{labels.modelAnswer}</span>
                <p dir="auto">{part.modelAnswer}</p>
              </div>
            ) : null}
            {part.rubric ? (
              <div className="tp-study-mark__rubric">
                <span className="tp-label">{labels.rubric}</span>
                <p dir="auto">{part.rubric}</p>
              </div>
            ) : null}
            <div className="tp-field">
              <label className="tp-label" htmlFor={inputId}>
                {fillText(labels.givePoints, { max: part.points })}
              </label>
              <input
                id={inputId}
                className="tp-input tp-num tp-study-mark__points"
                type="number"
                inputMode="numeric"
                min={0}
                max={part.points}
                step={1}
                value={marks[part.id] ?? 0}
                onChange={(event) =>
                  onAction({
                    type: "mark",
                    questionId: question.id,
                    partId: part.id,
                    points: Math.min(
                      part.points,
                      Math.max(0, Number(event.currentTarget.value) || 0)
                    ),
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function TestRunner({ test, scorer, labels, onComplete, onReviewMissed }: TestRunnerProps) {
  const idBase = useId();
  const reducer = useMemo(
    () => (state: RunnerState, action: RunnerAction) => runnerReducer(test, scorer, state, action),
    [test, scorer]
  );
  const [state, dispatch] = useReducer(reducer, test, initRunner);
  const timer = state.timer;
  const running =
    timer !== null &&
    !timer.paused &&
    timer.remainingMs > 0 &&
    (state.phase === "answer" || state.phase === "confirm");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => dispatch({ type: "tick", ms: 1000 }), 1000);
    return () => clearInterval(id);
  }, [running]);

  const act = (action: RunnerAction) => {
    notifyTestEnd(test, scorer, state, action, onComplete);
    dispatch(action);
  };

  return (
    <TestRunnerView
      test={test}
      state={state}
      labels={labels}
      onAction={act}
      onReviewMissed={onReviewMissed}
      idBase={idBase}
    />
  );
}
