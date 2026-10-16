import { type KeyboardEvent, type ReactNode, type Ref, useEffect, useReducer, useRef } from "react";
import { compareRecall, suggestedButton } from "../../../core/srs/recall";
import {
  newCardState,
  previewIntervals,
  type ReviewButton,
  type Sm2State,
} from "../../../core/srs/sm2";
import { Check } from "../icons";
import { fillNodes, fillText, isActivationKey, isFromControl } from "./shared";
import { RecallField, type RecallLabels, RecallVerdict, recallKeyDown } from "./TypedRecall";

/**
 * S19 FlashcardReview: the review session view. One card at a time: Show answer, then Again / Hard
 * / Good / Easy, each with the interval SM-2 would set ("Good · 6 days", from `previewIntervals`).
 * Progress, an Undo for the last grade, and a calm end state.
 *
 * The host persists each grade (`onGrade`) and its Undo (`onUndo`). Within the session, "Again"
 * shows the card once more near the end, at most twice per card (EXTRAPOLATED: same rule as
 * `packages/core/srs/queue.ts`; the lead may swap this reducer for that one).
 *
 * Keyboard on the session's buttons: Space or Enter shows the answer (Show answer is a button);
 * 1 to 4 grade once it is shown.
 *
 * Typed mode (`typed`, optional): the card shows its front, a labelled "Your answer" field and
 * Check instead of Show answer. Enter in the field checks, Escape clears it. Check turns the card
 * over and shows what was typed with "Matches" / "Almost" / "Different" (or "No answer typed"),
 * from `compareRecall`; focus then moves to the grade group. The person still picks the grade:
 * the button `suggestedButton` names only gets a "Suggested" marker. The typed answer lives in the
 * session state, so Undo brings it back with the card.
 */

export const REVIEW_BUTTONS: readonly ReviewButton[] = ["again", "hard", "good", "easy"];

/** Times a card may come back in one session after "Again". */
export const MAX_AGAIN_PER_CARD = 2;

export type ReviewCardItem = {
  /** The host's key for the card; never shown. */
  key: string;
  front: string;
  back: string;
  hint?: string;
  /** The card's SM-2 state, or null for a new card. */
  state: Sm2State | null;
};

export type FlashcardReviewLabels = {
  /** Accessible name of the card region, e.g. "Card to review". */
  card: string;
  front: string;
  back: string;
  hint: string;
  showAnswer: string;
  /** e.g. "{done} done, {left} to go". */
  progress: string;
  /** Group label over the four buttons, e.g. "How well did you know it?". */
  gradeGroup: string;
  grades: Record<ReviewButton, string>;
  /** e.g. "{days} day". */
  intervalOne: string;
  /** e.g. "{days} days". */
  intervalMany: string;
  undo: string;
  doneTitle: string;
  /** e.g. "You reviewed {count} cards." */
  doneBody: string;
  /** Short keyboard help, e.g. "Space shows the answer. 1 to 4 grade it." */
  keys: string;
  /** Typed mode: the answer field, Check and the comparison words. */
  recall: RecallLabels;
  /** Typed mode: marks the grade that fits the comparison, e.g. "Suggested". A hint only. */
  suggested: string;
  /** Typed mode keyboard help, e.g. "Enter checks. Escape clears. Then 1 to 4 grade it." */
  typedKeys: string;
};

export type ReviewGrade = { key: string; button: ReviewButton };

export type FlashcardReviewProps = {
  cards: readonly ReviewCardItem[];
  /** The time used for interval previews (Unix ms). */
  now: number;
  labels: FlashcardReviewLabels;
  onGrade?: (grade: ReviewGrade) => void;
  /** Called with the grade being taken back. Undo shows only while `undoAvailable` is not false. */
  onUndo?: (grade: ReviewGrade) => void;
  undoAvailable?: boolean;
  /**
   * Optional read-aloud control beside a piece of text (kitchen T4): the host returns a
   * ReadAloudButton, or null where speech isn't available. Left out, nothing is drawn.
   */
  readAloud?: (text: string) => ReactNode;
  /** Typed recall mode: type the answer, then Check. Off when left out. */
  typed?: boolean;
};

export type ReviewState = {
  queue: string[];
  revealed: boolean;
  /** Typed mode: what the person typed for the card on top. Empty otherwise. */
  answer: string;
  again: Record<string, number>;
  done: number;
  history: { grade: ReviewGrade; before: Omit<ReviewState, "history"> }[];
};

export type ReviewAction =
  | { type: "reveal" }
  | { type: "grade"; button: ReviewButton }
  | { type: "undo" }
  | { type: "type"; text: string }
  | { type: "clear" };

export function initReview(keys: readonly string[]): ReviewState {
  return { queue: [...keys], revealed: false, answer: "", again: {}, done: 0, history: [] };
}

/**
 * Pure session state. Grading needs the answer shown first. Typing only changes the answer while
 * the front is showing; a grade starts the next card with an empty answer.
 */
export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  const { history, ...rest } = state;
  switch (action.type) {
    case "reveal":
      return state.queue.length === 0 ? state : { ...state, revealed: true };
    case "grade": {
      const [key, ...queue] = state.queue;
      if (key === undefined || !state.revealed) return state;
      const seen = state.again[key] ?? 0;
      const comesBack = action.button === "again" && seen < MAX_AGAIN_PER_CARD;
      return {
        queue: comesBack ? [...queue, key] : queue,
        revealed: false,
        answer: "",
        again: comesBack ? { ...state.again, [key]: seen + 1 } : state.again,
        done: comesBack ? state.done : state.done + 1,
        history: [...history, { grade: { key, button: action.button }, before: rest }],
      };
    }
    case "undo": {
      const last = history.at(-1);
      if (!last) return state;
      return { ...last.before, history: history.slice(0, -1) };
    }
    case "type":
      return state.queue.length === 0 || state.revealed ? state : { ...state, answer: action.text };
    case "clear":
      return state.revealed || state.answer === "" ? state : { ...state, answer: "" };
  }
}

/** The review action a key asks for, or null. */
export function reviewKeyAction(key: string, revealed: boolean): ReviewAction | null {
  if (!revealed) return isActivationKey(key) ? { type: "reveal" } : null;
  const index = ["1", "2", "3", "4"].indexOf(key);
  const button = REVIEW_BUTTONS[index];
  return button ? { type: "grade", button } : null;
}

type KeyLike = Pick<KeyboardEvent<HTMLElement>, "key" | "target" | "preventDefault">;

/** The card's keydown handler: Space or Enter shows the answer, then 1 to 4 grade. */
export function reviewKeyDown(revealed: boolean, act: (action: ReviewAction) => void) {
  return (event: KeyLike) => {
    if (isActivationKey(event.key) && isFromControl(event.target)) return;
    const action = reviewKeyAction(event.key, revealed);
    if (!action) return;
    event.preventDefault();
    act(action);
  };
}

/** Tell the host about a grade or an Undo before the state changes. */
export function notifyReview(
  state: ReviewState,
  action: ReviewAction,
  callbacks: Pick<FlashcardReviewProps, "onGrade" | "onUndo">
): void {
  if (action.type === "grade") {
    const key = state.queue[0];
    if (key !== undefined && state.revealed) callbacks.onGrade?.({ key, button: action.button });
  } else if (action.type === "undo") {
    const last = state.history.at(-1);
    if (last) callbacks.onUndo?.(last.grade);
  }
}

export type FlashcardReviewViewProps = {
  cards: readonly ReviewCardItem[];
  now: number;
  labels: FlashcardReviewLabels;
  state: ReviewState;
  onAction: (action: ReviewAction) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  undoAvailable?: boolean;
  readAloud?: (text: string) => ReactNode;
  /** Typed recall mode. */
  typed?: boolean;
  /** Typed mode: the answer field, so the host can focus it when the next card comes up. */
  answerRef?: Ref<HTMLInputElement>;
  /** Show answer (or Check): the host focuses it when the next card comes up outside typed mode. */
  revealRef?: Ref<HTMLButtonElement>;
};

/**
 * Moves focus to the grade group when it appears after Show answer or Check, so focus never falls
 * to the page when the button that had it goes away. A stable function, so React calls it only
 * when the group mounts (turning typed mode on never moves focus).
 */
function focusGrades(node: HTMLFieldSetElement | null) {
  node?.focus();
}

export function FlashcardReviewView({
  cards,
  now,
  labels,
  state,
  onAction,
  onKeyDown,
  undoAvailable = true,
  readAloud,
  typed = false,
  answerRef,
  revealRef,
}: FlashcardReviewViewProps) {
  const key = state.queue[0];
  const card = key === undefined ? undefined : cards.find((item) => item.key === key);
  const canUndo = undoAvailable && state.history.length > 0;
  const undo = canUndo ? (
    <button
      type="button"
      className="tp-btn tp-btn--ghost tp-btn--sm"
      data-action="review-undo"
      onClick={() => onAction({ type: "undo" })}
    >
      {labels.undo}
    </button>
  ) : null;

  if (!card) {
    return (
      <section
        className="tp-artifact tp-study-review"
        data-component="FlashcardReview"
        data-state="done"
      >
        <div className="tp-state tp-state--empty" data-component="StateEmpty">
          <Check className="tp-icon tp-state__icon" />
          <h2 className="tp-state__title">{labels.doneTitle}</h2>
          <p className="tp-state__body">{fillNodes(labels.doneBody, { count: state.done })}</p>
          {undo ? <div className="tp-state__actions">{undo}</div> : null}
        </div>
      </section>
    );
  }

  const intervals = previewIntervals(card.state ?? newCardState(now), now);
  const side = state.revealed ? "back" : "front";
  const comparison = typed && state.revealed ? compareRecall(state.answer, card.back) : null;
  const suggested = comparison ? suggestedButton(comparison.result) : null;
  const onAnswerKeyDown = recallKeyDown(state.answer, (action) =>
    onAction(action === "check" ? { type: "reveal" } : { type: "clear" })
  );
  return (
    <section
      className="tp-artifact tp-study-review"
      data-component="FlashcardReview"
      aria-label={labels.card}
    >
      <header className="tp-artifact__head">
        <span className="tp-study-progress" aria-live="polite">
          {fillNodes(labels.progress, { done: state.done, left: state.queue.length })}
        </span>
        {undo}
      </header>
      <div className="tp-artifact__body">
        <div
          className="tp-flashcard"
          data-component="Flashcard"
          data-side={side}
          aria-live="polite"
        >
          <div className="tp-flashcard__face" data-face="front">
            <span className="tp-flashcard__side">{labels.front}</span>
            <p className="tp-flashcard__text" dir="auto">
              {card.front}
            </p>
            {readAloud?.(card.front)}
            {card.hint ? (
              <p className="tp-study-hint">
                <span className="tp-study-hint__label">{labels.hint}</span>{" "}
                <span dir="auto">{card.hint}</span>
              </p>
            ) : null}
          </div>
          <div className="tp-flashcard__face" data-face="back">
            <span className="tp-flashcard__side">{labels.back}</span>
            <p className="tp-study-review__front" dir="auto">
              {card.front}
            </p>
            <p className="tp-flashcard__text" dir="auto">
              {card.back}
            </p>
            {readAloud?.(card.back)}
            {comparison ? (
              <RecallVerdict typed={state.answer} result={comparison.result} labels={labels.recall} />
            ) : null}
          </div>
        </div>
        {typed && !state.revealed ? (
          <RecallField
            value={state.answer}
            labels={labels.recall}
            onChange={(text) => onAction({ type: "type", text })}
            onKeyDown={onAnswerKeyDown}
            inputRef={answerRef}
          />
        ) : null}
        <p className="tp-study-keys">{typed ? labels.typedKeys : labels.keys}</p>
      </div>
      <div className="tp-artifact__foot">
        {state.revealed ? (
          <fieldset
            className="tp-study-grades"
            aria-label={labels.gradeGroup}
            data-typed={typed ? "true" : undefined}
            tabIndex={-1}
            ref={focusGrades}
            onKeyDown={
              onKeyDown
                ? (event) => {
                    // 1 to 4 also work while the group itself has focus (right after Check).
                    if (event.target === event.currentTarget) onKeyDown(event);
                  }
                : undefined
            }
          >
            {REVIEW_BUTTONS.map((button, index) => {
              const days = intervals[button];
              const interval = days === 1 ? labels.intervalOne : labels.intervalMany;
              const hint = button === suggested;
              return (
                <button
                  type="button"
                  key={button}
                  className="tp-btn tp-btn--secondary tp-study-grade"
                  data-action="review-grade"
                  onKeyDown={onKeyDown}
                  data-grade={button}
                  data-suggested={hint ? "true" : undefined}
                  aria-keyshortcuts={String(index + 1)}
                  aria-label={`${labels.grades[button]} · ${fillText(interval, { days })}${
                    hint ? ` · ${labels.suggested}` : ""
                  }`}
                  onClick={() => onAction({ type: "grade", button })}
                >
                  <span>{labels.grades[button]}</span>
                  <span className="tp-study-grade__interval">{fillNodes(interval, { days })}</span>
                  {hint ? <span className="tp-study-grade__suggested">{labels.suggested}</span> : null}
                </button>
              );
            })}
          </fieldset>
        ) : (
          <button
            ref={revealRef}
            type="button"
            className="tp-btn tp-btn--primary"
            data-action={typed ? "review-check" : "review-reveal"}
            onKeyDown={onKeyDown}
            onClick={() => onAction({ type: "reveal" })}
          >
            {typed ? labels.recall.check : labels.showAnswer}
          </button>
        )}
      </div>
    </section>
  );
}

export function FlashcardReview({
  cards,
  now,
  labels,
  onGrade,
  onUndo,
  undoAvailable,
  readAloud,
  typed = false,
}: FlashcardReviewProps) {
  const [state, dispatch] = useReducer(
    reviewReducer,
    cards.map((card) => card.key),
    initReview
  );
  // After a grade, the next card's answer field (typed mode) or Show answer takes focus.
  const answerRef = useRef<HTMLInputElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef(false);
  const graded = state.history.length;
  useEffect(() => {
    if (graded === 0 || !focusNext.current) return;
    focusNext.current = false;
    (typed ? answerRef.current : revealRef.current)?.focus();
  }, [graded, typed]);
  const act = (action: ReviewAction) => {
    notifyReview(state, action, { onGrade, onUndo });
    if (action.type === "grade" && state.revealed) focusNext.current = true;
    dispatch(action);
  };
  const onKeyDown = reviewKeyDown(state.revealed, act);
  return (
    <FlashcardReviewView
      cards={cards}
      now={now}
      labels={labels}
      state={state}
      onAction={act}
      onKeyDown={onKeyDown}
      undoAvailable={undoAvailable}
      readAloud={readAloud}
      typed={typed}
      answerRef={answerRef}
      revealRef={revealRef}
    />
  );
}
