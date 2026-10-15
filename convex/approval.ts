import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import {
	APPROVAL_GATE_EPOCH_MS,
	type ApprovalStatus,
	approvalStatusOf,
	isAdminUser,
	normalizeEmail,
	releaseApprovalDecision,
	requireAdmin,
	requireApprovedUser,
} from "./lib/approval";
import { isInactiveAccount } from "./lib/accountDeletion";
import { resolveUserFromIdentity } from "./lib/requireUser";

/**
 * Sign-up approval gate (TEMPO-GATE-01). See convex/lib/approval.ts.
 *
 * CLI (Amit, or anyone holding the deployment's deploy key):
 *   npx convex run approval:setStatusByEmail '{"email":"someone@example.com","status":"approved"}'
 *   npx convex run approval:setStatusByEmail '{"email":"someone@example.com","status":"revoked"}'
 *   npx convex run approval:listByStatus '{"status":"pending"}'
 * Add `--prod` for the live deployment (Amit only).
 */

const statusValidator = v.union(
	v.literal("pending"),
	v.literal("approved"),
	v.literal("revoked"),
);

const adminRowValidator = v.object({
	_id: v.id("users"),
	email: v.string(),
	fullName: v.optional(v.string()),
	status: statusValidator,
	isAdmin: v.boolean(),
	createdAt: v.number(),
	approvalUpdatedAt: v.optional(v.number()),
	approvalUpdatedBy: v.optional(v.string()),
});

function adminRow(user: Doc<"users">) {
	return {
		_id: user._id,
		email: user.email,
		...(user.fullName ? { fullName: user.fullName } : {}),
		status: approvalStatusOf(user),
		isAdmin: isAdminUser(user),
		createdAt: user.createdAt ?? user._creationTime,
		...(user.approvalUpdatedAt !== undefined
			? { approvalUpdatedAt: user.approvalUpdatedAt }
			: {}),
		...(user.approvalUpdatedBy !== undefined
			? { approvalUpdatedBy: user.approvalUpdatedBy }
			: {}),
	};
}

/**
 * The signed-in person's gate state. `null` when signed out or the account is
 * inactive. Never throws, so the waiting screen can always render.
 */
export const myStatus = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			status: statusValidator,
			isAdmin: v.boolean(),
			email: v.string(),
		}),
	),
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			return null;
		}
		const user = await resolveUserFromIdentity(ctx, identity);
		if (!user || isInactiveAccount(user)) {
			return null;
		}
		return {
			status: approvalStatusOf(user),
			isAdmin: isAdminUser(user),
			email: user.email,
		};
	},
});

/** Used by actions (convex/lib/aiGate.ts) before any LLM/STT/TTS call. Throws unless approved. */
export const assertApprovedForAi = internalQuery({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		await requireApprovedUser(ctx);
		return null;
	},
});

/** Admin screen: every live account with its gate state, pending first, newest first. */
export const listForAdmin = query({
	args: {},
	returns: v.array(adminRowValidator),
	handler: async (ctx) => {
		await requireAdmin(ctx);
		const users = await ctx.db
			.query("users")
			.withIndex("by_deletedAt", (q) => q.eq("deletedAt", undefined))
			.order("desc")
			.take(500);
		const rank: Record<ApprovalStatus, number> = {
			pending: 0,
			revoked: 1,
			approved: 2,
		};
		return users
			.map(adminRow)
			.sort(
				(a, b) => rank[a.status] - rank[b.status] || b.createdAt - a.createdAt,
			);
	},
});

/** Admin screen: approve, revoke, or put back to pending. Admin accounts can't be changed here. */
export const setStatus = mutation({
	args: { userId: v.id("users"), status: statusValidator },
	returns: v.object({ userId: v.id("users"), status: statusValidator }),
	handler: async (ctx, args) => {
		const admin = await requireAdmin(ctx);
		const target = await ctx.db.get(args.userId);
		if (!target) {
			throw new Error("User not found");
		}
		if (isAdminUser(target)) {
			throw new Error("Admin accounts are always approved");
		}
		await ctx.db.patch(args.userId, {
			approvalStatus: args.status,
			approvalUpdatedAt: Date.now(),
			approvalUpdatedBy: admin.email,
		});
		return { userId: args.userId, status: args.status };
	},
});

/** CLI path (`npx convex run approval:setStatusByEmail ...`). Internal: not callable from a browser. */
export const setStatusByEmail = internalMutation({
	args: { email: v.string(), status: statusValidator },
	returns: v.object({
		userId: v.id("users"),
		email: v.string(),
		status: statusValidator,
	}),
	handler: async (ctx, args) => {
		const email = normalizeEmail(args.email);
		const matches = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", email))
			.take(10);
		const user = matches.find((u) => u.deletedAt === undefined) ?? matches[0];
		if (!user) {
			throw new Error(`No user with email ${email}`);
		}
		await ctx.db.patch(user._id, {
			approvalStatus: args.status,
			approvalUpdatedAt: Date.now(),
			approvalUpdatedBy: "cli",
		});
		return { userId: user._id, email, status: args.status };
	},
});

/** CLI: list accounts in one state, e.g. `{"status":"pending"}`. */
export const listByStatus = internalQuery({
	args: { status: statusValidator },
	returns: v.array(adminRowValidator),
	handler: async (ctx, args) => {
		const users = await ctx.db.query("users").order("desc").take(1000);
		return users
			.filter((u) => u.deletedAt === undefined)
			.map(adminRow)
			.filter((row) => row.status === args.status);
	},
});

/**
 * One-off backfill: write `approved` onto every pre-gate account (created
 * before APPROVAL_GATE_EPOCH_MS) that has no explicit status yet. Optional:
 * such rows already count as approved. Idempotent.
 *   npx convex run approval:approveExistingUsers
 */
export const approveExistingUsers = internalMutation({
	args: {},
	returns: v.object({ updated: v.number() }),
	handler: async (ctx) => {
		const users = await ctx.db.query("users").take(2000);
		let updated = 0;
		const now = Date.now();
		for (const u of users) {
			if (
				u.approvalStatus === undefined &&
				u._creationTime < APPROVAL_GATE_EPOCH_MS
			) {
				await ctx.db.patch(u._id, {
					approvalStatus: "approved",
					approvalUpdatedAt: now,
					approvalUpdatedBy: "backfill",
				});
				updated++;
			}
		}
		return { updated };
	},
});

/**
 * TEMPO-GATE-03 release migration (Amit, 6 Oct 2026): every account that
 * exists when this runs becomes `approved`; accounts created later keep
 * starting `pending`. Keeps explicit `revoked` and soft-deleted accounts.
 * Idempotent; safe to re-run. Runs on live as a Phase H release step:
 *   npx convex run approval:approveAllExistingUsers '{"dryRun":true}'
 *   npx convex run approval:approveAllExistingUsers
 * (`--prod` for live, Amit only.) Prints counts only, never emails.
 */
export const approveAllExistingUsers = internalMutation({
	args: { cutoffMs: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
	returns: v.object({
		scanned: v.number(),
		updated: v.number(),
		alreadyApproved: v.number(),
		skippedRevoked: v.number(),
		skippedDeleted: v.number(),
		skippedNew: v.number(),
		cutoffMs: v.number(),
		dryRun: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const now = Date.now();
		const cutoffMs = args.cutoffMs ?? now;
		const dryRun = args.dryRun ?? false;
		const counts = {
			scanned: 0,
			updated: 0,
			alreadyApproved: 0,
			skippedRevoked: 0,
			skippedDeleted: 0,
			skippedNew: 0,
		};
		for await (const user of ctx.db.query("users")) {
			counts.scanned++;
			const decision = releaseApprovalDecision(user, cutoffMs);
			if (decision === "already") counts.alreadyApproved++;
			else if (decision === "revoked") counts.skippedRevoked++;
			else if (decision === "deleted") counts.skippedDeleted++;
			else if (decision === "new") counts.skippedNew++;
			else {
				counts.updated++;
				if (!dryRun) {
					await ctx.db.patch(user._id, {
						approvalStatus: "approved",
						approvalUpdatedAt: now,
						approvalUpdatedBy: "release-backfill",
					});
				}
			}
		}
		return { ...counts, cutoffMs, dryRun };
	},
});
