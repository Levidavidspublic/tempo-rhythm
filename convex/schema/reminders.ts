import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * S14 reminders through Telegram (PRD F-61, picked 2026-10-18).
 *
 * `reminderChannelLinks`: one live link per person and channel. `chatId` is Telegram's private chat
 * with the bot, kept as a string. Unlink is a soft delete (`deletedAt`) with a 5-minute Undo; a
 * link Telegram refused with 403 (the person blocked the bot) gets `brokenAt` and is soft-deleted
 * too, so nothing is sent to it again. `testUtcDateKey` / `testsToday` count "Send a test" per day
 * (the daily limit sums them over all of a person's link rows, deleted ones too).
 * `telegramFirstName` (optional): the Telegram display first name that pressed Start, at most 64
 * characters, so Settings can say which chat is connected. Personal data, never logged.
 *
 * `reminderLinkCodes`: the one-time codes behind the t.me deep link. Only the SHA-256 hex of a code
 * is stored. A code lives 10 minutes (`expiresAt`), works once (`usedAt`), and a newer code
 * soft-deletes the older one; `utcDateKey` counts how many a person started that day.
 *
 * Lifecycle like every owned table: `userId`, `createdAt`, `updatedAt`, `deletedAt?`, `by_userId`.
 * Enrolled in account soft deletion (`lib/accountDeletion.ts`). Neither table holds message text.
 */
export const reminderTables = {
  reminderChannelLinks: defineTable({
    userId: v.id("users"),
    channelId: v.literal("telegram"),
    chatId: v.string(),
    linkedAt: v.number(),
    brokenAt: v.optional(v.number()),
    testUtcDateKey: v.optional(v.string()),
    testsToday: v.optional(v.number()),
    telegramFirstName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_channelId", ["userId", "channelId"]),

  reminderLinkCodes: defineTable({
    userId: v.id("users"),
    channelId: v.literal("telegram"),
    codeHash: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    utcDateKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_codeHash", ["codeHash"])
    .index("by_userId_utcDateKey", ["userId", "utcDateKey"]),
};
