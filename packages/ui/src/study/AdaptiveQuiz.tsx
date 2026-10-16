import type { QuizQuestion } from "@tempo/utils";
import { useId, useMemo, useReducer } from "react";
import { Check, Info } from "../icons";
import type { QuizEngine, QuizResult } from "./quiz-engine";
import { ScoreCard, type ScoreCardLabels } from "./ScoreCard";
import { fillNodes } from "./shared";

/**
 * S20 AdaptiveQuiz: one question at a time as a radio group, Check, then feedback with an icon
 * and words ("Right." / "Not quite. The answer is: …") and the explanation, then Next. Ends in
 * `ScoreCard`. Which question comes next is the injected `engine`'s choice (adaptive or fixed).
 * Arrow keys move between choices natively (and follow the page direction in RTL).
 */

export type AdaptiveQuizLabels = {
  /** e.g. "Question {current}". */
  position: string;
  check: string;
  next: string;
  /** Shown before Check when nothing is chosen, e.g. "Pick an answer to check it." */
  pickFirst: string;
  right: string;
  /** e.g. "Not quite. The answer is: {answer}" */
  notQuite: string;
  /** Marks the right choice after Check, e.g. "Answer". */
  answerMark: string;
  scoreCard: ScoreCardLabels;
};

export type AdaptiveQuizProps<S> = {
  engine: QuizEngine<S>;
  labels: AdaptiveQuizLabels;
  /** Called once when the quiz ends, e.g. to record the attempt. */
  onFinish?: (result: QuizResult) => void;
  /** "Review the ones you missed": receives the missed question ids. */
  onReviewMissed?: (missedIds: string[]) => void;
};

export type QuizViewState<S> = {
  engine: S;
  asked: number;
  selected: string | null;
  feedback: { correct: boolean; choiceId: string } | null;
};

export type QuizAction =
  | { type: "select"; choiceId: string }
  | { type: "check" }
  | { type: "next" }
  | { type: "restart" };

export function initQuiz<S>(engine: QuizEngine<S>): QuizViewState<S> {
  return { engine: engine.start(), asked: 1, selected: null, feedback: null };
}

/** Pure quiz screen state over any engine. */
export function quizReducer<S>(
  engine: QuizEngine<S>,
  state: QuizViewState<S>,
  action: QuizAction
): QuizViewState<S> {
  switch (action.type) {
    case "select":
      return state.feedback ? state : { ...state, selected: action.choiceId };
    case "check": {
      if (state.feedback || state.selected === null || !engine.current(state.engine)) return state;
      const { state: next, correct } = engine.answer(state.engine, state.selected);
      return { ...state, engine: next, feedback: { correct, choiceId: state.selected } };
    }
    case "next":
      if (!state.feedback) return state;
      return {
        engine: engine.next(state.engine),
        asked: state.asked + 1,
        selected: null,
        feedback: null,
      };
    case "restart":
      return initQuiz(engine);
  }
}

/** Report the end of the quiz when this action finishes it. */
export function notifyQuizEnd<S>(
  engine: QuizEngine<S>,
  state: QuizViewState<S>,
  action: QuizAction,
  onFinish: ((result: QuizResult) => void) | undefined
): void {
  if (action.type !== "next" || !state.feedback) return;
  const after = engine.next(state.engine);
  if (!engine.current(after)) onFinish?.(engine.result(after));
}

export type AdaptiveQuizViewProps = {
  question: QuizQuestion | null;
  result: QuizResult | null;
  state: Pick<QuizViewState<unknown>, "asked" | "selected" | "feedback">;
  labels: AdaptiveQuizLabels;
  onAction: (action: QuizAction) => void;
  onReviewMissed?: (missedIds: string[]) => void;
  /** Radio group name; unique per quiz on the page. */
  name: string;
};

export function AdaptiveQuizView({
  question,
  result,
  state,
  labels,
  onAction,
  onReviewMissed,
  name,
}: AdaptiveQuizViewProps) {
  if (!question) {
    const final = result ?? { correct: 0, total: 0, missedIds: [] };
    return (
      <div className="tp-study-quiz" data-component="AdaptiveQuiz" data-state="done">
        <ScoreCard
          score={final.correct}
          max={final.total}
          percent={final.total > 0 ? Math.round((final.correct / final.total) * 100) : 0}
          missedCount={final.missedIds.length}
          onReviewMissed={onReviewMissed ? () => onReviewMissed(final.missedIds) : undefined}
          onTryAgain={() => onAction({ type: "restart" })}
          labels={labels.scoreCard}
        />
      </div>
    );
  }

  const checked = state.feedback !== null;
  const answer = question.choices.find((choice) => choice.id === question.answerId);
  const feedbackId = `${name}-feedback`;
  return (
    <section className="tp-artifact tp-study-quiz" data-component="AdaptiveQuiz">
      <div className="tp-artifact__body">
        <p className="tp-study-progress">{fillNodes(labels.position, { current: state.asked })}</p>
        <fieldset
          className="tp-quiz"
          data-component="Quiz"
          data-checked={checked ? "true" : "false"}
          aria-describedby={checked ? feedbackId : undefined}
        >
          <legend className="tp-quiz__q" dir="auto">
            {question.prompt}
          </legend>
          {question.choices.map((choice) => (
            <label
              className="tp-choice"
              key={choice.id}
              data-correct={checked ? String(choice.id === question.answerId) : undefined}
            >
              <input
                type="radio"
                className="tp-radio"
                name={name}
                value={choice.id}
                checked={state.selected === choice.id}
                disabled={checked}
                onChange={() => onAction({ type: "select", choiceId: choice.id })}
              />
              <span className="tp-choice__text" dir="auto">
                {choice.text}
              </span>
              <span className="tp-quiz__mark">
                <Check className="tp-icon tp-icon--sm" />
                {labels.answerMark}
              </span>
            </label>
          ))}
        </fieldset>
        {state.feedback ? (
          <div
            className="tp-quiz__feedback"
            id={feedbackId}
            aria-live="polite"
            data-result={state.feedback.correct ? "right" : "wrong"}
          >
            {state.feedback.correct ? <Check className="tp-icon" /> : <Info className="tp-icon" />}
            <div className="tp-study-feedback__text">
              <p>
                {state.feedback.correct
                  ? labels.right
                  : fillNodes(labels.notQuite, { answer: answer?.text ?? "" })}
              </p>
              {question.explanation ? <p dir="auto">{question.explanation}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
      <div className="tp-artifact__foot">
        {checked ? (
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            data-action="quiz-next"
            onClick={() => onAction({ type: "next" })}
          >
            {labels.next}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="tp-btn tp-btn--primary"
              data-action="quiz-check"
              disabled={state.selected === null}
              onClick={() => onAction({ type: "check" })}
            >
              {labels.check}
            </button>
            {state.selected === null ? (
              <span className="tp-study-keys">{labels.pickFirst}</span>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

export function AdaptiveQuiz<S>({
  engine,
  labels,
  onFinish,
  onReviewMissed,
}: AdaptiveQuizProps<S>) {
  const name = useId();
  const reducer = useMemo(
    () => (state: QuizViewState<S>, action: QuizAction) => quizReducer(engine, state, action),
    [engine]
  );
  const [state, dispatch] = useReducer(reducer, engine, initQuiz);
  const question = engine.current(state.engine);
  const result = question ? null : engine.result(state.engine);
  const act = (action: QuizAction) => {
    notifyQuizEnd(engine, state, action, onFinish);
    dispatch(action);
  };
  return (
    <AdaptiveQuizView
      question={question}
      result={result}
      state={state}
      labels={labels}
      onAction={act}
      onReviewMissed={onReviewMissed}
      name={name}
    />
  );
}
