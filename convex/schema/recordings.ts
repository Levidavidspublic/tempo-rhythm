import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Record a meeting or lecture (kitchen T8, S7 RecordSession).
 *
 * `recordingSessions` is a content-free lease, like `voiceSessions`: when it started and ended,
 * the language lane, the local and UTC day it counts against, and how many speech tokens it was
 * given. It never holds audio, words, tokens or provider bodies. Audio goes from the browser
 * straight to Deepgram; the transcript lives in the browser until the person saves a page.
 *
 * Each save (`saveSession`) is a row of its own, so its Undo removes only what that save made: the
 * page and task ids (`savedNoteId`, `savedTaskIds`), with no words. A save row is `ended`, zero
 * length, no tokens, and has empty day keys, so it never counts against anyone's minutes or
 * sessions.
 *
 * Lifecycle like every owned table: `userId`, `createdAt`, `updatedAt`, `deletedAt?`, `by_userId`.
 * Enrolled in account soft deletion (`lib/accountDeletion.ts`).
 */
export const recordingTables = {
  recordingSessions: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("ended")),
    lang: v.union(v.literal("en"), v.literal("he")),
    startedAt: v.number(),
    lastRenewalAt: v.number(),
    endedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    endReason: v.optional(
      v.union(
        v.literal("stopped"),
        v.literal("replaced"),
        v.literal("expired"),
        v.literal("exhausted"),
        v.literal("revoked"),
      ),
    ),
    /** The person's local day (the daily minutes); `utcDateKey` is the global ceiling's day. */
    dateKey: v.string(),
    utcDateKey: v.string(),
    grants: v.number(),
    /** Additive (whole-run review): the page a save made, so its Undo can find that save. */
    savedNoteId: v.optional(v.id("notes")),
    /** Additive (whole-run review): the tasks that save made; its Undo removes only these. */
    savedTaskIds: v.optional(v.array(v.id("tasks"))),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_dateKey", ["userId", "dateKey"])
    .index("by_utcDateKey", ["utcDateKey"])
    .index("by_userId_savedNoteId", ["userId", "savedNoteId"]),
};
