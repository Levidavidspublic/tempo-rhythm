import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Study read-aloud in Tempo's voice (Chatterbox on DeepInfra, docs/contracts/VOICE.md P-3).
 *
 * `studyVoiceUsage` is content-free usage metadata (VOICE.md R-4): one row per person per local
 * day with how many characters and sentences of their pages were read aloud. It never holds page
 * text, audio, which page was read, tokens or provider bodies. The characters count against the
 * same daily TTS cap as the coach's voice (`voiceSessions.ttsChars`, VOICE_LIMITS).
 *
 * Lifecycle like every owned table: `userId`, `createdAt`, `updatedAt`, `deletedAt?`, `by_userId`.
 * Enrolled in account soft deletion (`lib/accountDeletion.ts`).
 */
export const studyVoiceTables = {
	studyVoiceUsage: defineTable({
		userId: v.id("users"),
		/** The person's local day (YYYY-MM-DD, `localDateKey`), the cap's day. */
		dateKey: v.string(),
		chars: v.number(),
		sentences: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
		deletedAt: v.optional(v.number()),
	})
		.index("by_userId", ["userId"])
		.index("by_userId_dateKey", ["userId", "dateKey"]),
};
