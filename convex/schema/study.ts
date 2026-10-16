import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Study layer tables (kitchen T3). The study content itself (cards, questions) lives in the page
 * as a `json tempo` block; these rows hold only what the page can't: which blocks are study sets,
 * SM-2 schedule state per card, a review log for Undo, and quiz/test scores (never free text).
 *
 * Lifecycle like every owned table: `userId`, `createdAt`, `updatedAt`, `deletedAt?`, `by_userId`.
 * All four are enrolled in account soft deletion (`lib/accountDeletion.ts`). `studySets` carries
 * `noteId`, so it is a page-child table read only through `lib/pagePrivacy.ts`'s page guard.
 */

const studyKind = v.union(v.literal("flashcards"), v.literal("quiz"), v.literal("test"));

const reviewButton = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy"),
);

/** SM-2 schedule state (`packages/core/srs/sm2.ts` `Sm2State`). */
const sm2StateFields = {
  ease: v.number(),
  intervalDays: v.number(),
  repetitions: v.number(),
  lapses: v.number(),
  dueAt: v.number(),
  lastReviewedAt: v.optional(v.number()),
};

export const studyTables = {
  studySets: defineTable({
    userId: v.id("users"),
    /** The page holding the block. */
    noteId: v.id("notes"),
    blockId: v.string(),
    kind: studyKind,
    title: v.string(),
    itemCount: v.number(),
    /** The page the set was made from, when there was one. */
    sourceNoteId: v.optional(v.id("notes")),
    /** True when `createFromPreview` made the page, so its Undo removes the page too. */
    createdByTempo: v.boolean(),
    lastStudiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updated", ["userId", "deletedAt", "updatedAt"])
    .index("by_note_block", ["noteId", "blockId"]),

  studyCardStates: defineTable({
    userId: v.id("users"),
    setId: v.id("studySets"),
    cardId: v.string(),
    ...sm2StateFields,
    /** The review that wrote this state; only that review can be undone. */
    lastReviewId: v.optional(v.id("studyReviews")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_user_due", ["userId", "deletedAt", "dueAt"])
    .index("by_set_card", ["setId", "cardId"]),

  studyReviews: defineTable({
    userId: v.id("users"),
    setId: v.id("studySets"),
    cardId: v.string(),
    button: reviewButton,
    reviewedAt: v.number(),
    /** The card's state before this review, or null for a card seen for the first time. */
    prev: v.union(v.null(), v.object(sm2StateFields)),
    /** The review that wrote `prev`, so undoing this one makes that one the latest again. */
    prevReviewId: v.optional(v.id("studyReviews")),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_user_reviewed", ["userId", "reviewedAt"]),

  studyAttempts: defineTable({
    userId: v.id("users"),
    setId: v.id("studySets"),
    kind: v.union(v.literal("quiz"), v.literal("test")),
    score: v.number(),
    maxScore: v.number(),
    percent: v.number(),
    passed: v.optional(v.boolean()),
    /** Marks per item only. Never the student's own words. */
    answers: v.array(
      v.object({
        itemId: v.string(),
        correct: v.optional(v.boolean()),
        points: v.optional(v.number()),
        maxPoints: v.optional(v.number()),
      }),
    ),
    startedAt: v.number(),
    finishedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_set", ["setId", "deletedAt", "startedAt"]),
};
