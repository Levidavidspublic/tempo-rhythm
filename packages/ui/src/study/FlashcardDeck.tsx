import type { Flashcard } from "@tempo/utils";
import { type KeyboardEvent, useReducer } from "react";
import { ArrowRight, Layers } from "../icons";
import {
  fillNodes,
  isActivationKey,
  isFromControl,
  resolveDir,
  type StudyDir,
  stepForKey,
} from "./shared";

/**
 * S18 FlashcardDeck: browse a deck. One card at a time, flipped by a button (`aria-pressed`),
 * never by hover. Previous / Next and "3 of 12". Keyboard on any deck button: the arrows move
 * (and swap in RTL so they point where the cards sit); Space or Enter flips (on the Flip button,
 * natively; the deck handler skips them on other buttons so they keep their own meaning).
 * Shuffle reorders the deck. The card region is `aria-live` so a flip is announced.
 * Presentational: no data access, every word from `labels`.
 */

export type FlashcardDeckLabels = {
  /** Accessible name of the card region, e.g. "Flashcard". */
  deck: string;
  front: string;
  back: string;
  hint: string;
  /** e.g. "{current} of {total}". */
  position: string;
  showBack: string;
  showFront: string;
  previous: string;
  next: string;
  shuffle: string;
  /** Short keyboard help, e.g. "Space flips. Arrows move." */
  keys: string;
};

export type FlashcardDeckCard = Pick<Flashcard, "front" | "back" | "hint">;

export type FlashcardDeckProps = {
  cards: readonly FlashcardDeckCard[];
  labels: FlashcardDeckLabels;
  /** Reading direction. Read from the closest `[dir]` element when left out. */
  dir?: StudyDir;
  /** Random source for Shuffle (0 <= n < 1). Defaults to Math.random. */
  random?: () => number;
};

export type DeckSide = "front" | "back";
export type DeckState = { order: number[]; index: number; side: DeckSide };
export type DeckAction =
  | { type: "flip" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "shuffle"; random: () => number };

export function initDeck(count: number): DeckState {
  return { order: Array.from({ length: count }, (_, i) => i), index: 0, side: "front" };
}

/** Pure deck state. Moving shows the front of the new card; the ends do not wrap. */
export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "flip":
      return { ...state, side: state.side === "front" ? "back" : "front" };
    case "next":
      return state.index >= state.order.length - 1
        ? state
        : { ...state, index: state.index + 1, side: "front" };
    case "prev":
      return state.index <= 0 ? state : { ...state, index: state.index - 1, side: "front" };
    case "shuffle": {
      const order = [...state.order];
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(action.random() * (i + 1));
        [order[i], order[j]] = [order[j] as number, order[i] as number];
      }
      return { order, index: 0, side: "front" };
    }
  }
}

/** The deck action a key asks for on the card, or null. */
export function deckKeyAction(key: string, dir: StudyDir): DeckAction | null {
  if (isActivationKey(key)) return { type: "flip" };
  const step = stepForKey(key, dir);
  return step ? { type: step } : null;
}

type KeyLike = Pick<
  KeyboardEvent<HTMLElement>,
  "key" | "target" | "currentTarget" | "preventDefault"
>;

/**
 * The deck's keydown handler. Reads the direction from `dir` or, when it is left out, from the
 * closest `[dir]` element at the time of the key press (so a page switched to Hebrew just works).
 */
export function deckKeyDown(dir: StudyDir | undefined, dispatch: (action: DeckAction) => void) {
  return (event: KeyLike) => {
    if (isActivationKey(event.key) && isFromControl(event.target)) return;
    const action = deckKeyAction(event.key, resolveDir(dir, event.currentTarget as Element));
    if (!action) return;
    event.preventDefault();
    dispatch(action);
  };
}

export type FlashcardDeckViewProps = {
  cards: readonly FlashcardDeckCard[];
  labels: FlashcardDeckLabels;
  state: DeckState;
  onAction: (action: DeckAction) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  random?: () => number;
};

/** The deck drawn from a given state. `FlashcardDeck` owns the state; tests draw this directly. */
export function FlashcardDeckView({
  cards,
  labels,
  state,
  onAction,
  onKeyDown,
  random = Math.random,
}: FlashcardDeckViewProps) {
  const card = cards[state.order[state.index] ?? 0];
  if (!card) return null;
  const total = state.order.length;
  const flipped = state.side === "back";
  return (
    <section
      className="tp-artifact tp-study-deck"
      data-component="FlashcardDeck"
      aria-label={labels.deck}
    >
      <div className="tp-artifact__body">
        <div
          className="tp-flashcard"
          data-component="Flashcard"
          data-side={state.side}
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
            <p className="tp-flashcard__text" dir="auto">
              {card.back}
            </p>
          </div>
        </div>
        <p className="tp-study-keys">{labels.keys}</p>
      </div>
      <div className="tp-artifact__foot">
        <span className="tp-flashcard__count" aria-live="polite">
          {fillNodes(labels.position, { current: state.index + 1, total })}
        </span>
        <button
          type="button"
          className="tp-btn tp-btn--ghost"
          data-action="card-step"
          data-dir="prev"
          onKeyDown={onKeyDown}
          disabled={state.index === 0}
          onClick={() => onAction({ type: "prev" })}
        >
          <ArrowRight className="tp-icon tp-icon--back" />
          {labels.previous}
        </button>
        <button
          type="button"
          className="tp-btn tp-btn--primary"
          data-action="card-flip"
          onKeyDown={onKeyDown}
          aria-pressed={flipped}
          onClick={() => onAction({ type: "flip" })}
        >
          {flipped ? labels.showFront : labels.showBack}
        </button>
        <button
          type="button"
          className="tp-btn tp-btn--ghost"
          data-action="card-step"
          data-dir="next"
          onKeyDown={onKeyDown}
          disabled={state.index >= total - 1}
          onClick={() => onAction({ type: "next" })}
        >
          {labels.next}
          <ArrowRight className="tp-icon tp-icon--flip" />
        </button>
        <button
          type="button"
          className="tp-btn tp-btn--ghost"
          data-action="card-shuffle"
          onKeyDown={onKeyDown}
          disabled={total < 2}
          onClick={() => onAction({ type: "shuffle", random })}
        >
          <Layers className="tp-icon" />
          {labels.shuffle}
        </button>
      </div>
    </section>
  );
}

export function FlashcardDeck({ cards, labels, dir, random }: FlashcardDeckProps) {
  const [state, dispatch] = useReducer(deckReducer, cards.length, initDeck);
  const onKeyDown = deckKeyDown(dir, dispatch);
  return (
    <FlashcardDeckView
      cards={cards}
      labels={labels}
      state={state}
      onAction={dispatch}
      onKeyDown={onKeyDown}
      random={random}
    />
  );
}
