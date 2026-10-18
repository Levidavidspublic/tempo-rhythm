import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireApprovedForAi } from "./lib/aiGate";
import { isApproved, requireApprovedUser } from "./lib/approval";
import { requireLivePage } from "./lib/pagePrivacy";
import { requireUser } from "./lib/requireUser";
import { pageReading, speechPieces } from "./lib/studyVoice";
import { VOICE_LIMITS, localDateKey } from "./lib/voicePolicy";
import { synthesize } from "./voice";

/**
 * Study read-aloud in Tempo's voice (docs/contracts/VOICE.md, adopted 2026-10-18): the audio recap
 * player (/study/listen) reads a page one piece at a time with Chatterbox multilingual on
 * DeepInfra (P-3), Hebrew or English by the page's language.
 *
 * - The client names a page, a reading (recap or whole page) and a piece index; the words are
 *   resolved here from the page with the same shared code the player uses (lib/studyVoice.ts), so
 *   no text is ever sent by the client (A-10).
 * - Every piece is counted before synthesis and given back if no audio comes of it, against one
 *   daily TTS cap per person shared with the coach's voice (`voiceSessions.ttsChars` plus
 *   `studyVoiceUsage.chars` on the person's local day, VOICE_LIMITS.dailyTtsCharsPerUser).
 * - Audio is returned as transient bytes and never stored (R-1); nothing about the page, its text
 *   or the audio is logged (R-5). `studyVoiceUsage` holds counts only.
 *
 * Off unless DEEPINFRA_API_KEY is set on the deployment (name only; the value never leaves the
 * server). The player falls back to the device's own voice whenever this is off or fails.
 */

const STUDY_VOICE_ERRORS = {
	study_voice_off:
		"Tempo's voice isn't switched on. This device's voice can read instead.",
	study_voice_gone: "This page isn't here anymore.",
} as const;

function studyVoiceError(code: keyof typeof STUDY_VOICE_ERRORS) {
	return new ConvexError({ code, message: STUDY_VOICE_ERRORS[code] });
}

const modeValidator = v.union(v.literal("recap"), v.literal("full"));

type Db = QueryCtx | MutationCtx;

async function dateKeyFor(ctx: Db, userId: Id<"users">, now: number) {
	const prefs = await ctx.db
		.query("userPreferences")
		.withIndex("by_userId_deletedAt", (q) =>
			q.eq("userId", userId).eq("deletedAt", undefined),
		)
		.first();
	return localDateKey(now, prefs?.timeZone);
}

/**
 * Characters read aloud today in either voice: the coach's sessions and study read-aloud. Tombstoned
 * rows count too, so deleting the account and restoring it in the grace period gives nothing back.
 */
async function ttsCharsUsed(ctx: Db, userId: Id<"users">, dateKey: string) {
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

/**
 * Whether the player can use Tempo's voice: "off" (no key, or an account that can't use AI),
 * "budget" (today's shared read-aloud characters are spent), or "available" with what is left.
 */
export const availability = query({
	args: {},
	returns: v.object({
		status: v.union(
			v.literal("off"),
			v.literal("budget"),
			v.literal("available"),
		),
		charsLeft: v.number(),
	}),
	handler: async (ctx) => {
		const user = await requireUser(ctx);
		if (!isApproved(user) || !process.env.DEEPINFRA_API_KEY)
			return { status: "off" as const, charsLeft: 0 };
		const dateKey = await dateKeyFor(ctx, user._id, Date.now());
		const charsLeft = Math.max(
			0,
			VOICE_LIMITS.dailyTtsCharsPerUser -
				(await ttsCharsUsed(ctx, user._id, dateKey)),
		);
		return charsLeft > 0
			? { status: "available" as const, charsLeft }
			: { status: "budget" as const, charsLeft: 0 };
	},
});

type PieceResult =
	| {
			status: "sentence";
			text: string;
			language: string;
			count: number;
			usageId: Id<"studyVoiceUsage">;
	  }
	| { status: "done" }
	| { status: "exhausted" };

/**
 * Resolves piece `index` of a page's reading for Tempo's voice (A-10): the caller's own live page,
 * within today's shared read-aloud characters. Counts what it admits on the person's usage row for
 * the day, so concurrent calls can't pass the cap.
 */
export const admitSentence = internalMutation({
	args: { noteId: v.string(), mode: modeValidator, index: v.number() },
	returns: v.union(
		v.object({
			status: v.literal("sentence"),
			text: v.string(),
			language: v.string(),
			count: v.number(),
			usageId: v.id("studyVoiceUsage"),
		}),
		v.object({ status: v.literal("done") }),
		v.object({ status: v.literal("exhausted") }),
	),
	handler: async (ctx, args): Promise<PieceResult> => {
		const user = await requireApprovedUser(ctx);
		if (!Number.isInteger(args.index) || args.index < 0)
			throw studyVoiceError("study_voice_gone");
		const noteId = ctx.db.normalizeId("notes", args.noteId);
		if (!noteId) throw studyVoiceError("study_voice_gone");
		let body: string;
		try {
			body = (await requireLivePage(ctx, user._id, noteId)).note.body;
		} catch {
			throw studyVoiceError("study_voice_gone");
		}
		const { lang, sentences } = pageReading(body, args.mode);
		const pieces = speechPieces(sentences);
		const piece = pieces[args.index];
		if (piece === undefined) return { status: "done" as const };

		const now = Date.now();
		const dateKey = await dateKeyFor(ctx, user._id, now);
		if (
			(await ttsCharsUsed(ctx, user._id, dateKey)) + piece.text.length >
			VOICE_LIMITS.dailyTtsCharsPerUser
		) {
			return { status: "exhausted" as const };
		}
		const rows = await ctx.db
			.query("studyVoiceUsage")
			.withIndex("by_userId_dateKey", (q) =>
				q.eq("userId", user._id).eq("dateKey", dateKey),
			)
			.collect();
		const live = rows.find((row) => row.deletedAt === undefined);
		let usageId: Id<"studyVoiceUsage">;
		if (live) {
			usageId = live._id;
			await ctx.db.patch(live._id, {
				chars: live.chars + piece.text.length,
				sentences: live.sentences + 1,
				updatedAt: now,
			});
		} else {
			usageId = await ctx.db.insert("studyVoiceUsage", {
				userId: user._id,
				dateKey,
				chars: piece.text.length,
				sentences: 1,
				createdAt: now,
				updatedAt: now,
			});
		}
		return {
			status: "sentence" as const,
			text: piece.text,
			language: lang,
			count: pieces.length,
			usageId,
		};
	},
});

/** Gives back a piece that produced no audio, so a provider outage can't use up the day's read-aloud. */
export const releaseSentence = internalMutation({
	args: { usageId: v.id("studyVoiceUsage"), chars: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const row = await ctx.db.get(args.usageId);
		if (row && row.userId === user._id && row.sentences > 0) {
			await ctx.db.patch(row._id, {
				chars: Math.max(0, row.chars - args.chars),
				sentences: row.sentences - 1,
				updatedAt: Date.now(),
			});
		}
		return null;
	},
});

type SpeakResult =
	| { status: "audio"; audio: ArrayBuffer; mime: string; count: number }
	| { status: "done" }
	| { status: "exhausted" };

/**
 * One piece of a page's reading as audio in Tempo's voice. Identifiers in, transient bytes out:
 * `count` is how many pieces the reading has; "done" past the end; "exhausted" when today's
 * characters are spent.
 */
export const speak = action({
	args: { noteId: v.string(), mode: modeValidator, index: v.number() },
	returns: v.union(
		v.object({
			status: v.literal("audio"),
			audio: v.bytes(),
			mime: v.string(),
			count: v.number(),
		}),
		v.object({ status: v.literal("done") }),
		v.object({ status: v.literal("exhausted") }),
	),
	handler: async (ctx, args): Promise<SpeakResult> => {
		await requireApprovedForAi(ctx);
		const key = process.env.DEEPINFRA_API_KEY;
		if (!key) throw studyVoiceError("study_voice_off");
		// Counted first (so concurrent calls can't pass the day's allowance), given back if no audio comes.
		const admitted: PieceResult = await ctx.runMutation(
			internal.studyVoice.admitSentence,
			args,
		);
		if (admitted.status !== "sentence") return admitted;
		try {
			const audio = await synthesize(key, admitted.text, admitted.language);
			return {
				status: "audio" as const,
				audio: audio.bytes,
				mime: audio.mime,
				count: admitted.count,
			};
		} catch (error) {
			await ctx
				.runMutation(internal.studyVoice.releaseSentence, {
					usageId: admitted.usageId,
					chars: admitted.text.length,
				})
				.catch(() => {});
			throw error;
		}
	},
});
