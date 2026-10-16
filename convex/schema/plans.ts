import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The last "Re-plan the rest" on a plan (`plans.replan`), kept so `plans.undoReplan` can take it
 * back for 5 minutes: each moved task's start before (`from`, absent when it had none) and after
 * (`to`), the sessions it left out (soft-deleted at `at`) and the deadline before, when the re-plan
 * moved it. The next re-plan replaces it; `undoneAt` marks one that was taken back.
 */
export const replanRecordValidator = v.object({
  at: v.number(),
  moves: v.array(v.object({ taskId: v.id("tasks"), from: v.optional(v.number()), to: v.number() })),
  removed: v.array(v.id("tasks")),
  deadlineBefore: v.optional(v.string()),
  undoneAt: v.optional(v.number()),
});

/**
 * Study plans, kitchen T8 (Plan backend). A plan is the row that groups the tasks one
 * "Plan back from a deadline" preview created, so the whole plan can be undone in one step and
 * listed later. The sessions themselves are ordinary tasks (elastic, `projectName` = plan title).
 *
 * HARD_RULES §5: soft delete through `deletedAt`, `updatedAt` on every write, a `by_userId`
 * index (account deletion streams it) and `by_userId_updated` for the list.
 */
export const planTables = {
  studyPlans: defineTable({
    userId: v.id("users"),
    title: v.string(),
    /** Local `YYYY-MM-DD` date of the exam or deadline. */
    deadline: v.string(),
    /** The study set the topics came from, when there was one. */
    sourceSetId: v.optional(v.string()),
    taskIds: v.array(v.id("tasks")),
    /** Additive (kitchen F-07 re-plan): the last re-plan, for its 5-minute Undo. */
    lastReplan: v.optional(replanRecordValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updated", ["userId", "updatedAt"]),
};
