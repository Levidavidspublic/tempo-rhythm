import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Characters read aloud on one local day in either of Tempo's voices: the coach's sessions
 * (`voiceSessions.ttsChars`) and study read-aloud (`studyVoiceUsage.chars`). One daily cap per
 * person covers both (VOICE_LIMITS.dailyTtsCharsPerUser), so both sides count through here.
 * Tombstoned rows count too: deleting the account and restoring it in the grace period gives
 * nothing back.
 */
export async function ttsCharsUsed(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	dateKey: string,
): Promise<number> {
	const coach = await ctx.db
		.query("voiceSessions")
		.withIndex("by_userId_dateKey", (q) =>
			q.eq("userId", userId).eq("dateKey", dateKey),
		)
		.collect();
	const study = await ctx.db
		.query("studyVoiceUsage")
		.withIndex("by_userId_dateKey", (q) =>
			q.eq("userId", userId).eq("dateKey", dateKey),
		)
		.collect();
	return (
		coach.reduce((n, r) => n + r.ttsChars, 0) +
		study.reduce((n, r) => n + r.chars, 0)
	);
}
