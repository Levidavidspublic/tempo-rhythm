import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { isLocalDate } from "./lib/habitCheckInStreak";
import { requireUser } from "./lib/requireUser";

const MAX_TOP_TASKS = 3;
const MAX_CARRY_OVER = 50;

const energyValidator = v.union(v.literal("low"), v.literal("medium"), v.literal("high"));

const dayPlanValidator = v.object({
	_id: v.id("dayPlans"),
	_creationTime: v.number(),
	userId: v.id("users"),
	localDate: v.string(),
	timezone: v.optional(v.string()),
	intention: v.optional(v.string()),
	topTaskIds: v.optional(v.array(v.id("tasks"))),
	energy: v.optional(energyValidator),
	status: v.union(v.literal("draft"), v.literal("committed")),
	committedAt: v.optional(v.number()),
	reflection: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
	deletedAt: v.optional(v.number()),
});

// Same shape as `taskReturnValidator` in convex/tasks.ts (not exported there).
const taskValidator = v.object({
	_id: v.id("tasks"),
	_creationTime: v.number(),
	userId: v.id("users"),
	title: v.string(),
	description: v.optional(v.string()),
	status: v.union(
		v.literal("todo"),
		v.literal("in_progress"),
		v.literal("done"),
		v.literal("cancelled"),
	),
	priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
	energy: v.optional(energyValidator),
	timeEstimate: v.optional(v.number()),
	timeSpentOnDay: v.optional(v.any()),
	repeatCfgId: v.optional(v.id("taskRepeatCfgs")),
	parentTaskId: v.optional(v.id("tasks")),
	projectId: v.optional(v.string()),
	projectName: v.optional(v.string()),
	dueAt: v.optional(v.number()),
	completedAt: v.optional(v.number()),
	checklist: v.optional(
		v.array(
			v.object({
				id: v.string(),
				text: v.string(),
				completed: v.boolean(),
			}),
		),
	),
	createdAt: v.number(),
	updatedAt: v.number(),
	deletedAt: v.optional(v.number()),
});

function assertLocalDate(localDate: string) {
	if (!isLocalDate(localDate)) {
		throw new Error("localDate must be YYYY-MM-DD");
	}
}

async function findLivePlan(
	ctx: QueryCtx | MutationCtx,
	userId: Id<"users">,
	localDate: string,
): Promise<Doc<"dayPlans"> | null> {
	const rows = await ctx.db
		.query("dayPlans")
		.withIndex("by_userId_deletedAt_localDate", (q) =>
			q.eq("userId", userId).eq("deletedAt", undefined).eq("localDate", localDate),
		)
		.collect();
	return rows[0] ?? null;
}

async function assertOwnedTasks(ctx: MutationCtx, userId: Id<"users">, taskIds: Id<"tasks">[]) {
	if (taskIds.length > MAX_TOP_TASKS) {
		throw new Error(`A day plan can have at most ${MAX_TOP_TASKS} top tasks`);
	}
	for (const taskId of taskIds) {
		const task = await ctx.db.get(taskId);
		if (!task || task.userId !== userId || task.deletedAt !== undefined) {
			throw new Error("Task not found");
		}
	}
}

export const getForDate = query({
	args: { localDate: v.string() },
	returns: v.union(dayPlanValidator, v.null()),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		return getDayPlanForUser(ctx, user._id, args.localDate);
	},
});

/** Shared by `getForDate` and the MCP tools. */
export async function getDayPlanForUser(
	ctx: QueryCtx,
	userId: Id<"users">,
	localDate: string,
): Promise<Doc<"dayPlans"> | null> {
	assertLocalDate(localDate);
	return findLivePlan(ctx, userId, localDate);
}

export const upsert = mutation({
	args: {
		localDate: v.string(),
		timezone: v.optional(v.string()),
		intention: v.optional(v.string()),
		topTaskIds: v.optional(v.array(v.id("tasks"))),
		energy: v.optional(energyValidator),
	},
	returns: v.id("dayPlans"),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		assertLocalDate(args.localDate);
		if (args.topTaskIds !== undefined) {
			await assertOwnedTasks(ctx, user._id, args.topTaskIds);
		}

		const now = Date.now();
		const fields: Partial<Doc<"dayPlans">> = {};
		if (args.timezone !== undefined) fields.timezone = args.timezone;
		if (args.intention !== undefined) fields.intention = args.intention.trim();
		if (args.topTaskIds !== undefined) fields.topTaskIds = args.topTaskIds;
		if (args.energy !== undefined) fields.energy = args.energy;

		const existing = await findLivePlan(ctx, user._id, args.localDate);
		if (existing) {
			// Patch only: never touches `status`, so a committed plan stays committed.
			await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
			return existing._id;
		}
		return ctx.db.insert("dayPlans", {
			userId: user._id,
			localDate: args.localDate,
			...fields,
			status: "draft",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const commit = mutation({
	args: { localDate: v.string() },
	returns: v.object({ dayPlanId: v.id("dayPlans"), committedAt: v.number() }),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		assertLocalDate(args.localDate);
		const now = Date.now();

		const existing = await findLivePlan(ctx, user._id, args.localDate);
		if (!existing) {
			const dayPlanId = await ctx.db.insert("dayPlans", {
				userId: user._id,
				localDate: args.localDate,
				status: "committed",
				committedAt: now,
				createdAt: now,
				updatedAt: now,
			});
			return { dayPlanId, committedAt: now };
		}
		if (existing.status === "committed" && existing.committedAt !== undefined) {
			return { dayPlanId: existing._id, committedAt: existing.committedAt };
		}
		await ctx.db.patch(existing._id, {
			status: "committed",
			committedAt: now,
			updatedAt: now,
		});
		return { dayPlanId: existing._id, committedAt: now };
	},
});

export const listCarryOver = query({
	args: { beforeMs: v.number() },
	returns: v.array(taskValidator),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		// `gte 0` also excludes tasks without a dueAt (undefined sorts before numbers).
		const rows = await ctx.db
			.query("tasks")
			.withIndex("by_userId_dueAt", (q) =>
				q.eq("userId", user._id).gte("dueAt", 0).lt("dueAt", args.beforeMs),
			)
			.order("asc")
			.collect();
		return rows
			.filter(
				(t) => t.deletedAt === undefined && (t.status === "todo" || t.status === "in_progress"),
			)
			.slice(0, MAX_CARRY_OVER);
	},
});

export const moveTaskToDay = mutation({
	args: { taskId: v.id("tasks"), dueAt: v.number() },
	returns: v.id("tasks"),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const task = await ctx.db.get(args.taskId);
		if (!task || task.userId !== user._id || task.deletedAt !== undefined) {
			throw new Error("Task not found");
		}
		await ctx.db.patch(args.taskId, {
			dueAt: args.dueAt,
			updatedAt: Date.now(),
		});
		return args.taskId;
	},
});
