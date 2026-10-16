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

/** The session's cards, keyed by set and card (a card id is only unique inside its deck). */
export function sessionItems(cards: readonly QueueCard[]): ReviewCardItem[] {
  return cards.map((card) => ({
    key: cardKey(card.setId, card.cardId),
    front: card.front,
    back: card.back,
    ...(card.hint ? { hint: card.hint } : {}),
    state: card.state,
  }));
}

export function cardKey(setId: string, cardId: string): string {
  return `${setId}\u0000${cardId}`;
}

export function splitKey(key: string): { setId: string; cardId: string } {
  const at = key.indexOf("\u0000");
  return { setId: key.slice(0, at), cardId: key.slice(at + 1) };
}

/** One saved grade: what to send to `study.undoReview`, and until when. */
export type SavedGrade = { reviewId: string; undoUntil: number };
