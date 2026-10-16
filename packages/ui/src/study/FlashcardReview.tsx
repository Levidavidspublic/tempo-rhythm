import { type KeyboardEvent, useReducer } from "react";
import {
  newCardState,
  previewIntervals,
  type ReviewButton,
  type Sm2State,
} from "../../../core/srs/sm2";
import { Check } from "../icons";
import { fillNodes, fillText, isActivationKey, isFromControl } from "./shared";

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
};

export type ReviewState = {
  queue: string[];
  revealed: boolean;
  again: Record<string, number>;
  done: number;
  history: { grade: ReviewGrade; before: Omit<ReviewState, "history"> }[];
};

export type ReviewAction =
  | { type: "reveal" }
  | { type: "grade"; button: ReviewButton }
  | { type: "undo" };

export function initReview(keys: readonly string[]): ReviewState {
  return { queue: [...keys], revealed: false, again: {}, done: 0, history: [] };
}

/** Pure session state. Grading needs the answer shown first. */
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
};

export function FlashcardReviewView({
  cards,
  now,
  labels,
  state,
  onAction,
  onKeyDown,
  undoAvailable = true,
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
          </div>
        </div>
        <p className="tp-study-keys">{labels.keys}</p>
      </div>
      <div className="tp-artifact__foot">
        {state.revealed ? (
          <fieldset className="tp-study-grades" aria-label={labels.gradeGroup}>
            {REVIEW_BUTTONS.map((button, index) => {
              const days = intervals[button];
              const interval = days === 1 ? labels.intervalOne : labels.intervalMany;
              return (
                <button
                  type="button"
                  key={button}
                  className="tp-btn tp-btn--secondary tp-study-grade"
                  data-action="review-grade"
                  onKeyDown={onKeyDown}
                  data-grade={button}
                  aria-keyshortcuts={String(index + 1)}
                  aria-label={`${labels.grades[button]} · ${fillText(interval, { days })}`}
                  onClick={() => onAction({ type: "grade", button })}
                >
                  <span>{labels.grades[button]}</span>
                  <span className="tp-study-grade__interval">{fillNodes(interval, { days })}</span>
                </button>
              );
            })}
          </fieldset>
        ) : (
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            data-action="review-reveal"
            onKeyDown={onKeyDown}
            onClick={() => onAction({ type: "reveal" })}
          >
            {labels.showAnswer}
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
}: FlashcardReviewProps) {
  const [state, dispatch] = useReducer(
    reviewReducer,
    cards.map((card) => card.key),
    initReview
  );
  const act = (action: ReviewAction) => {
    notifyReview(state, action, { onGrade, onUndo });
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
    />
  );
}
