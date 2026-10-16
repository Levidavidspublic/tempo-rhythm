import type { Flashcard } from "@tempo/utils";
import { type KeyboardEvent, type ReactNode, useReducer } from "react";
import { compareRecall } from "../../../core/srs/recall";
import { ArrowRight, Layers } from "../icons";
import {
  fillNodes,
  isActivationKey,
  isFromControl,
  resolveDir,
  type StudyDir,
  stepForKey,
} from "./shared";
import { RecallField, type RecallLabels, RecallVerdict, recallKeyDown } from "./TypedRecall";

/**
 * S18 FlashcardDeck: browse a deck. One card at a time, flipped by a button (`aria-pressed`),
 * never by hover. Previous / Next and "3 of 12". Keyboard on any deck button: the arrows move
 * (and swap in RTL so they point where the cards sit); Space or Enter flips (on the Flip button,
 * natively; the deck handler skips them on other buttons so they keep their own meaning).
 * Shuffle reorders the deck. The card region is `aria-live` so a flip is announced.
 * Presentational: no data access, every word from `labels`.
 *
 * Typed mode (`typed`, optional): on the front, a labelled "Your answer" field and Check take the
 * place of Show the back (Enter checks, Escape clears). The back then shows what was typed with
 * "Matches" / "Close" / "Different" from `compareRecall`. Moving to another card clears the answer.
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
  /** Typed mode: the answer field, Check and the comparison words. */
  recall: RecallLabels;
  /** Typed mode keyboard help, e.g. "Enter checks. Escape clears." */
  typedKeys: string;
};

export type FlashcardDeckCard = Pick<Flashcard, "front" | "back" | "hint">;

export type FlashcardDeckProps = {
  cards: readonly FlashcardDeckCard[];
  labels: FlashcardDeckLabels;
  /** Reading direction. Read from the closest `[dir]` element when left out. */
  dir?: StudyDir;
  /** Random source for Shuffle (0 <= n < 1). Defaults to Math.random. */
  random?: () => number;
  /**
   * Optional read-aloud control beside a piece of text (kitchen T4): the host returns a
   * ReadAloudButton, or null where speech isn't available. Left out, nothing is drawn.
   */
  readAloud?: (text: string) => ReactNode;
  /** Typed recall mode: type the answer, then Check. Off when left out. */
  typed?: boolean;
};

export type DeckSide = "front" | "back";
export type DeckState = {
  order: number[];
  index: number;
  side: DeckSide;
  /** Typed mode: what the person typed for the card shown. Left out while nothing is typed. */
  answer?: string;
};
export type DeckAction =
  | { type: "flip" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "shuffle"; random: () => number }
  | { type: "type"; text: string }
  | { type: "clear" };

export function initDeck(count: number): DeckState {
  return { order: Array.from({ length: count }, (_, i) => i), index: 0, side: "front" };
}

/** The state with this typed answer; an empty answer is left out. */
function withAnswer(state: DeckState, answer: string): DeckState {
  const { answer: _typed, ...rest } = state;
  return answer === "" ? rest : { ...rest, answer };
}

/**
 * Pure deck state. Moving shows the front of the new card with no typed answer; the ends do not
 * wrap. Typing only changes the answer while the front is showing.
 */
export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "flip":
      return { ...state, side: state.side === "front" ? "back" : "front" };
    case "next":
      return state.index >= state.order.length - 1
        ? state
        : withAnswer({ ...state, index: state.index + 1, side: "front" }, "");
    case "prev":
      return state.index <= 0
        ? state
        : withAnswer({ ...state, index: state.index - 1, side: "front" }, "");
    case "type":
      return state.side === "front" ? withAnswer(state, action.text) : state;
    case "clear":
      return state.side === "front" && state.answer ? withAnswer(state, "") : state;
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
  readAloud?: (text: string) => ReactNode;
  /** Typed recall mode. */
  typed?: boolean;
};

/** After Enter in the answer field, focus stays on the deck's main button (Check, then Flip). */
function focusDeckPrimary(from: Element) {
  from
    .closest('[data-component="FlashcardDeck"]')
    ?.querySelector<HTMLElement>('[data-action="card-check"]')
    ?.focus();
}

/** The deck drawn from a given state. `FlashcardDeck` owns the state; tests draw this directly. */
export function FlashcardDeckView({
  cards,
  labels,
  state,
  onAction,
  onKeyDown,
  random = Math.random,
  readAloud,
  typed = false,
}: FlashcardDeckViewProps) {
  const card = cards[state.order[state.index] ?? 0];
  if (!card) return null;
  const total = state.order.length;
  const flipped = state.side === "back";
  // Typed mode on the front: the main button is Check. One button element either way, so focus
  // stays on it when the card turns over.
  const checking = typed && !flipped;
  const answer = state.answer ?? "";
  const comparison = typed && flipped ? compareRecall(answer, card.back) : null;
  const onAnswerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const taken = recallKeyDown(answer, (action) =>
      onAction(action === "check" ? { type: "flip" } : { type: "clear" })
    )(event);
    if (taken === "check") focusDeckPrimary(event.currentTarget);
  };
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
            <p className="tp-flashcard__text" dir="auto">
              {card.back}
            </p>
            {readAloud?.(card.back)}
            {comparison ? (
              <RecallVerdict typed={answer} result={comparison.result} labels={labels.recall} />
            ) : null}
          </div>
        </div>
        {checking ? (
          <RecallField
            value={answer}
            labels={labels.recall}
            onChange={(text) => onAction({ type: "type", text })}
            onKeyDown={onAnswerKeyDown}
          />
        ) : null}
        <p className="tp-study-keys">{typed ? labels.typedKeys : labels.keys}</p>
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
          data-action={checking ? "card-check" : "card-flip"}
          onKeyDown={onKeyDown}
          aria-pressed={checking ? undefined : flipped}
          onClick={() => onAction({ type: "flip" })}
        >
          {checking ? labels.recall.check : flipped ? labels.showFront : labels.showBack}
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

export function FlashcardDeck({
  cards,
  labels,
  dir,
  random,
  readAloud,
  typed = false,
}: FlashcardDeckProps) {
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
      readAloud={readAloud}
      typed={typed}
    />
  );
}
