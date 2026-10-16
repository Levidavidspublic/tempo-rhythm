import { defineTable } from "convex/server";
import { v } from "convex/values";

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
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updated", ["userId", "updatedAt"]),
};
