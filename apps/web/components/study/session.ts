import type { ReviewCardItem } from "@tempo/ui";

/** Pure pieces of the review session (/study/review): the queue's cards as FlashcardReview items. */

export type QueueCard = {
  setId: string;
  setTitle: string;
  cardId: string;
  front: string;
  back: string;
  hint?: string;
  state: ReviewCardItem["state"];
};

/** A card's state after this session's grades, by card key (what `study.review` returned). */
export type GradedStates = Readonly<Record<string, ReviewCardItem["state"]>>;

/**
 * The session's cards, keyed by set and card (a card id is only unique inside its deck). A card
 * graded in this session (e.g. Again, then back in the queue) shows its new state, so the
 * buttons' intervals read from it rather than from the state before the grade.
 */
export function sessionItems(
  cards: readonly QueueCard[],
  graded: GradedStates = {}
): ReviewCardItem[] {
  return cards.map((card) => {
    const key = cardKey(card.setId, card.cardId);
    return {
      key,
      front: card.front,
      back: card.back,
      ...(card.hint ? { hint: card.hint } : {}),
      state: key in graded ? (graded[key] ?? null) : card.state,
    };
  });
}

export function cardKey(setId: string, cardId: string): string {
  return `${setId}\u0000${cardId}`;
}

export function splitKey(key: string): { setId: string; cardId: string } {
  const at = key.indexOf("\u0000");
  return { setId: key.slice(0, at), cardId: key.slice(at + 1) };
}

/** One saved grade: what to send to `study.undoReview`, until when, and the card's new state. */
export type SavedGrade = { reviewId: string; undoUntil: number; state?: ReviewCardItem["state"] };

/** The session's cards as read when it started, for one set (or every set when `setId` is unset). */
export type SessionSnapshot = { setId: string | undefined; cards: QueueCard[]; now: number };

/**
 * The snapshot to show: the current one while it belongs to `setId`, otherwise a new one from the
 * queue once it has loaded (null until then). Moving from ?set=A to ?set=B never keeps A's cards.
 */
export function nextSnapshot(
  current: SessionSnapshot | null,
  setId: string | undefined,
  queue: readonly QueueCard[] | undefined,
  now: number
): SessionSnapshot | null {
  if (current && current.setId === setId) return current;
  if (!queue) return null;
  return { setId, cards: [...queue], now };
}
