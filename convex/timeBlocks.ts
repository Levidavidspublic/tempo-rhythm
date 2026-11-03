import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { isLocalDate } from "./lib/habitCheckInStreak";
import { requireUser } from "./lib/requireUser";

const kindValidator = v.union(
	v.literal("focus"),
	v.literal("task"),
	v.literal("habit"),
	v.literal("break"),
	v.literal("other"),
);

const statusValidator = v.union(v.literal("planned"), v.literal("done"), v.literal("skipped"));

const timeBlockValidator = v.object({
	_id: v.id("timeBlocks"),
	_creationTime: v.number(),
	userId: v.id("users"),
	localDate: v.string(),
	dayPlanId: v.optional(v.id("dayPlans")),
	title: v.string(),
	startMinute: v.number(),
	durationMinutes: v.number(),
	startsAtMs: v.number(),
	endsAtMs: v.number(),
	kind: kindValidator,
	taskId: v.optional(v.id("tasks")),
	habitId: v.optional(v.id("habits")),
	status: statusValidator,
	source: v.union(v.literal("user"), v.literal("coach")),
	createdAt: v.number(),
	updatedAt: v.number(),
	deletedAt: v.optional(v.number()),
});

function cleanTitle(title: string): string {
	const trimmed = title.trim();
	if (!trimmed) {
		throw new Error("Title is required");
	}
	return trimmed;
}

function assertTiming(t: {
	startMinute: number;
	durationMinutes: number;
	startsAtMs: number;
	endsAtMs: number;
}) {
	if (!Number.isInteger(t.startMinute) || t.startMinute < 0 || t.startMinute > 1439) {
		throw new Error("startMinute must be a whole number from 0 to 1439");
	}
	if (!Number.isInteger(t.durationMinutes) || t.durationMinutes < 5 || t.durationMinutes > 720) {
		throw new Error("durationMinutes must be a whole number from 5 to 720");
	}
	if (!(t.endsAtMs > t.startsAtMs)) {
		throw new Error("endsAtMs must be after startsAtMs");
	}
}

async function getOwnedBlock(
	ctx: MutationCtx,
	userId: Id<"users">,
	timeBlockId: Id<"timeBlocks">,
): Promise<Doc<"timeBlocks">> {
	const block = await ctx.db.get(timeBlockId);
	if (!block || block.userId !== userId || block.deletedAt !== undefined) {
		throw new Error("Time block not found");
	}
	return block;
}

export const listForDate = query({
	args: { localDate: v.string() },
	returns: v.array(timeBlockValidator),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const rows = await ctx.db
			.query("timeBlocks")
			.withIndex("by_userId_deletedAt_localDate", (q) =>
				q.eq("userId", user._id).eq("deletedAt", undefined).eq("localDate", args.localDate),
			)
			.collect();
		rows.sort((a, b) => a.startMinute - b.startMinute || a.startsAtMs - b.startsAtMs);
		return rows;
	},
});

export const create = mutation({
	args: {
		localDate: v.string(),
		title: v.string(),
		startMinute: v.number(),
		durationMinutes: v.number(),
		startsAtMs: v.number(),
		endsAtMs: v.number(),
		kind: kindValidator,
		taskId: v.optional(v.id("tasks")),
		habitId: v.optional(v.id("habits")),
	},
	returns: v.id("timeBlocks"),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		if (!isLocalDate(args.localDate)) {
			throw new Error("localDate must be YYYY-MM-DD");
		}
		const title = cleanTitle(args.title);
		assertTiming(args);

		if (args.taskId) {
			const task = await ctx.db.get(args.taskId);
			if (!task || task.userId !== user._id || task.deletedAt !== undefined) {
				throw new Error("Task not found");
			}
		}
		if (args.habitId) {
			const habit = await ctx.db.get(args.habitId);
			if (!habit || habit.userId !== user._id || habit.deletedAt !== undefined) {
				throw new Error("Habit not found");
			}
		}

		const plans = await ctx.db
			.query("dayPlans")
			.withIndex("by_userId_deletedAt_localDate", (q) =>
				q.eq("userId", user._id).eq("deletedAt", undefined).eq("localDate", args.localDate),
			)
			.collect();

		const now = Date.now();
		return ctx.db.insert("timeBlocks", {
			userId: user._id,
			localDate: args.localDate,
			...(plans[0] ? { dayPlanId: plans[0]._id } : {}),
			title,
			startMinute: args.startMinute,
			durationMinutes: args.durationMinutes,
			startsAtMs: args.startsAtMs,
			endsAtMs: args.endsAtMs,
			kind: args.kind,
			...(args.taskId ? { taskId: args.taskId } : {}),
			...(args.habitId ? { habitId: args.habitId } : {}),
			status: "planned",
			source: "user",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		timeBlockId: v.id("timeBlocks"),
		title: v.optional(v.string()),
		startMinute: v.optional(v.number()),
		durationMinutes: v.optional(v.number()),
		startsAtMs: v.optional(v.number()),
		endsAtMs: v.optional(v.number()),
		kind: v.optional(kindValidator),
	},
	returns: v.id("timeBlocks"),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const block = await getOwnedBlock(ctx, user._id, args.timeBlockId);

		const next = {
			startMinute: args.startMinute ?? block.startMinute,
			durationMinutes: args.durationMinutes ?? block.durationMinutes,
			startsAtMs: args.startsAtMs ?? block.startsAtMs,
			endsAtMs: args.endsAtMs ?? block.endsAtMs,
		};
		assertTiming(next);

		const patch: Partial<Doc<"timeBlocks">> = { ...next, updatedAt: Date.now() };
		if (args.title !== undefined) patch.title = cleanTitle(args.title);
		if (args.kind !== undefined) patch.kind = args.kind;
		await ctx.db.patch(args.timeBlockId, patch);
		return args.timeBlockId;
	},
});

export const setStatus = mutation({
	args: { timeBlockId: v.id("timeBlocks"), status: statusValidator },
	returns: v.id("timeBlocks"),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		await getOwnedBlock(ctx, user._id, args.timeBlockId);
		await ctx.db.patch(args.timeBlockId, { status: args.status, updatedAt: Date.now() });
		return args.timeBlockId;
	},
});

export const remove = mutation({
	args: { timeBlockId: v.id("timeBlocks") },
	returns: v.object({ success: v.literal(true) }),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		await getOwnedBlock(ctx, user._id, args.timeBlockId);
		const now = Date.now();
		await ctx.db.patch(args.timeBlockId, { deletedAt: now, updatedAt: now });
		return { success: true as const };
	},
});
