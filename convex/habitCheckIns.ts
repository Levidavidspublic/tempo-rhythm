import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { computeHabitCheckInStreaks, isLocalDate } from "./lib/habitCheckInStreak";
import { requireUser } from "./lib/requireUser";

const checkInValidator = v.object({
	_id: v.id("habitCheckIns"),
	_creationTime: v.number(),
	userId: v.id("users"),
	habitId: v.id("habits"),
	localDate: v.string(),
	checkedAt: v.number(),
	source: v.union(
		v.literal("habits"),
		v.literal("today"),
		v.literal("suggestion"),
		v.literal("legacy"),
	),
	note: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
	deletedAt: v.optional(v.number()),
});

async function getOwnedHabit(
	ctx: MutationCtx,
	userId: Id<"users">,
	habitId: Id<"habits">,
): Promise<Doc<"habits">> {
	const habit = await ctx.db.get(habitId);
	if (!habit || habit.userId !== userId || habit.deletedAt !== undefined) {
		throw new Error("Habit not found");
	}
	return habit;
}

async function liveCheckInsForHabit(ctx: MutationCtx, habitId: Id<"habits">) {
	return ctx.db
		.query("habitCheckIns")
		.withIndex("by_habitId_deletedAt_localDate", (q) =>
			q.eq("habitId", habitId).eq("deletedAt", undefined),
		)
		.collect();
}

/**
 * Resolve the "current" local date for streak evaluation. A supplied
 * `asOfLocalDate` must be a real calendar date within trusted UTC today -1..+1
 * days inclusive (covers every real timezone offset); omission falls back to UTC
 * today (legacy callers). Never derived from the toggled (historical) localDate.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function resolveAsOfLocalDate(asOfLocalDate: string | undefined): string {
	const now = Date.now();
	const utcToday = new Date(now).toISOString().slice(0, 10);
	if (asOfLocalDate === undefined) {
		return utcToday;
	}
	if (!isLocalDate(asOfLocalDate)) {
		throw new Error("asOfLocalDate must be YYYY-MM-DD");
	}
	const earliest = new Date(now - DAY_MS).toISOString().slice(0, 10);
	const latest = new Date(now + DAY_MS).toISOString().slice(0, 10);
	// YYYY-MM-DD strings compare chronologically.
	if (asOfLocalDate < earliest || asOfLocalDate > latest) {
		throw new Error("asOfLocalDate must be within one day of UTC today");
	}
	return asOfLocalDate;
}

/**
 * Recompute and patch the habit's streak cache from its live check-ins.
 * Evaluates "current" relative to the caller's as-of local date (UTC today when
 * omitted), never the toggled localDate, so historical grid edits cannot corrupt
 * the live streak. Preserves longestStreak / lastCompletedAt written by
 * habits.completeToday when check-in rows would otherwise wipe them
 * (dual-writer safe).
 */
async function refreshHabitCache(ctx: MutationCtx, habit: Doc<"habits">, asOfLocalDate: string) {
	const rows = await liveCheckInsForHabit(ctx, habit._id);
	const streaks = computeHabitCheckInStreaks(
		rows.map((r) => r.localDate),
		asOfLocalDate,
	);
	const latest = rows.reduce<number | undefined>(
		(max, r) => (max === undefined || r.checkedAt > max ? r.checkedAt : max),
		undefined,
	);
	await ctx.db.patch(habit._id, {
		currentStreak: streaks.currentStreak,
		longestStreak: Math.max(streaks.longestStreak, habit.longestStreak ?? 0),
		lastCompletedAt: latest ?? habit.lastCompletedAt,
		updatedAt: Date.now(),
	});
	return {
		currentStreak: streaks.currentStreak,
		longestStreak: Math.max(streaks.longestStreak, habit.longestStreak ?? 0),
		lastLocalDate: streaks.lastLocalDate,
	};
}

export const listForDate = query({
	args: { localDate: v.string() },
	returns: v.array(checkInValidator),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		return ctx.db
			.query("habitCheckIns")
			.withIndex("by_userId_deletedAt_localDate", (q) =>
				q.eq("userId", user._id).eq("deletedAt", undefined).eq("localDate", args.localDate),
			)
			.collect();
	},
});

export const listForHabit = query({
	args: {
		habitId: v.id("habits"),
		fromLocalDate: v.string(),
		toLocalDate: v.string(),
	},
	returns: v.array(checkInValidator),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const habit = await ctx.db.get(args.habitId);
		if (!habit || habit.userId !== user._id || habit.deletedAt !== undefined) {
			return [];
		}
		return ctx.db
			.query("habitCheckIns")
			.withIndex("by_habitId_deletedAt_localDate", (q) =>
				q
					.eq("habitId", args.habitId)
					.eq("deletedAt", undefined)
					.gte("localDate", args.fromLocalDate)
					.lte("localDate", args.toLocalDate),
			)
			.order("asc")
			.collect();
	},
});

export const check = mutation({
	args: {
		habitId: v.id("habits"),
		localDate: v.string(),
		source: v.union(v.literal("habits"), v.literal("today"), v.literal("suggestion")),
		note: v.optional(v.string()),
		asOfLocalDate: v.optional(v.string()),
	},
	returns: v.object({
		checkInId: v.id("habitCheckIns"),
		alreadyChecked: v.boolean(),
		currentStreak: v.number(),
		longestStreak: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		if (!isLocalDate(args.localDate)) {
			throw new Error("localDate must be YYYY-MM-DD");
		}
		const asOf = resolveAsOfLocalDate(args.asOfLocalDate);
		const habit = await getOwnedHabit(ctx, user._id, args.habitId);

		const existing = (await liveCheckInsForHabit(ctx, habit._id)).find(
			(r) => r.localDate === args.localDate,
		);
		if (existing) {
			return {
				checkInId: existing._id,
				alreadyChecked: true,
				currentStreak: habit.currentStreak,
				longestStreak: habit.longestStreak,
			};
		}

		const now = Date.now();
		const note = args.note?.trim();
		const checkInId = await ctx.db.insert("habitCheckIns", {
			userId: user._id,
			habitId: habit._id,
			localDate: args.localDate,
			checkedAt: now,
			source: args.source,
			...(note ? { note } : {}),
			createdAt: now,
			updatedAt: now,
		});
		const streaks = await refreshHabitCache(ctx, habit, asOf);
		return {
			checkInId,
			alreadyChecked: false,
			currentStreak: streaks.currentStreak,
			longestStreak: streaks.longestStreak,
		};
	},
});

export const undo = mutation({
	args: {
		habitId: v.id("habits"),
		localDate: v.string(),
		asOfLocalDate: v.optional(v.string()),
	},
	returns: v.object({
		removed: v.boolean(),
		currentStreak: v.number(),
		longestStreak: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		if (!isLocalDate(args.localDate)) {
			throw new Error("localDate must be YYYY-MM-DD");
		}
		const asOf = resolveAsOfLocalDate(args.asOfLocalDate);
		const habit = await getOwnedHabit(ctx, user._id, args.habitId);

		const existing = (await liveCheckInsForHabit(ctx, habit._id)).find(
			(r) => r.localDate === args.localDate,
		);
		if (!existing) {
			return {
				removed: false,
				currentStreak: habit.currentStreak,
				longestStreak: habit.longestStreak,
			};
		}

		const now = Date.now();
		await ctx.db.patch(existing._id, { deletedAt: now, updatedAt: now });
		const streaks = await refreshHabitCache(ctx, habit, asOf);
		return {
			removed: true,
			currentStreak: streaks.currentStreak,
			longestStreak: streaks.longestStreak,
		};
	},
});
