import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import {
	capsFor,
	PAYMENTS_SWITCH_ENV,
	paymentsEnabled,
	TEMPO_PLANS,
} from "./lib/billingPlans";
import { requireUser } from "./lib/requireUser";

/**
 * Billing tiers + payment event ledger.
 * Payments switch: env PAYMENTS_ENABLED. Default OFF. While OFF, webhooks are
 * verified and recorded in paymentEvents, but no subscription is changed.
 */

/** Upsert the plan catalog from convex/lib/billingPlans.ts. Run: `convex run billing:seedPlans`. */
export const seedPlans = internalMutation({
	args: {},
	returns: v.object({ inserted: v.number(), updated: v.number() }),
	handler: async (ctx) => {
		let inserted = 0;
		let updated = 0;
		const now = Date.now();
		for (const p of TEMPO_PLANS) {
			const row = {
				key: p.key,
				name: p.name,
				priceCentsMonthly: p.priceCentsMonthly,
				currency: p.currency,
				caps: { ...p.caps },
				capsPlaceholder: p.capsPlaceholder,
				sortOrder: p.sortOrder,
				updatedAt: now,
			};
			const existing = await ctx.db
				.query("billingPlans")
				.withIndex("by_key", (q) => q.eq("key", p.key))
				.unique();
			if (existing) {
				await ctx.db.patch(existing._id, row);
				updated++;
			} else {
				await ctx.db.insert("billingPlans", row);
				inserted++;
			}
		}
		return { inserted, updated };
	},
});

export const listPlans = query({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db.query("billingPlans").collect();
		return rows
			.sort((a, b) => a.sortOrder - b.sortOrder)
			.map(
				({
					key,
					name,
					priceCentsMonthly,
					currency,
					caps,
					capsPlaceholder,
				}) => ({
					key,
					name,
					priceCentsMonthly,
					currency,
					caps,
					capsPlaceholder,
				}),
			);
	},
});

/** The signed-in user's tier caps. */
export const getMyCaps = query({
	args: {},
	handler: async (ctx) => {
		const user = await requireUser(ctx);
		const sub = await ctx.db
			.query("subscriptionStates")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.unique();
		return {
			tierKey:
				sub?.status === "active" || sub?.status === "grace"
					? (sub.tierKey ?? "free")
					: "free",
			status: sub?.status ?? "inactive",
			caps: capsFor(sub?.tierKey, sub?.status),
		};
	},
});

const statusV = v.union(
	v.literal("inactive"),
	v.literal("active"),
	v.literal("grace"),
	v.literal("cancelled"),
);

/** Map new tier keys onto the existing subscriptionStates.plan union. */
function legacyPlanFor(tierKey: string | undefined): "none" | "basic" | "pro" {
	if (tierKey === "tier_20") return "basic";
	if (tierKey === "tier_50") return "pro";
	return "none";
}

/**
 * Record one verified webhook. Idempotent on (provider, eventId).
 * Applies the subscription change only when the payments switch is ON.
 */
export const recordPaymentEvent = internalMutation({
	args: {
		provider: v.string(),
		eventId: v.string(),
		eventType: v.string(),
		testMode: v.boolean(),
		userId: v.optional(v.string()),
		tierKey: v.optional(v.string()),
		status: v.optional(statusV),
		providerSubscriptionId: v.optional(v.string()),
		providerCustomerId: v.optional(v.string()),
		currentPeriodEnd: v.optional(v.number()),
	},
	returns: v.object({ duplicate: v.boolean(), applied: v.boolean() }),
	handler: async (ctx, a) => {
		const dup = await ctx.db
			.query("paymentEvents")
			.withIndex("by_provider_eventId", (q) =>
				q.eq("provider", a.provider).eq("eventId", a.eventId),
			)
			.unique();
		if (dup) return { duplicate: true, applied: dup.applied };

		const userId = a.userId ? ctx.db.normalizeId("users", a.userId) : null;
		const user = userId ? await ctx.db.get(userId) : null;
		const switchOn = paymentsEnabled(process.env[PAYMENTS_SWITCH_ENV]);
		let applied = false;
		let note: string | undefined;

		if (!switchOn) note = "payments switch OFF: recorded only";
		else if (!user) note = "no matching user";
		else if (!a.status) note = "event has no subscription status";
		else {
			const now = Date.now();
			const fields = {
				plan: legacyPlanFor(a.tierKey),
				status: a.status,
				tierKey: a.tierKey,
				provider: a.provider,
				providerSubscriptionId: a.providerSubscriptionId,
				providerCustomerId: a.providerCustomerId,
				currentPeriodEnd: a.currentPeriodEnd,
				source: a.provider,
				updatedAt: now,
			};
			const sub = await ctx.db
				.query("subscriptionStates")
				.withIndex("by_userId", (q) => q.eq("userId", user._id))
				.unique();
			if (sub) await ctx.db.patch(sub._id, fields);
			else
				await ctx.db.insert("subscriptionStates", {
					...fields,
					userId: user._id,
					billingCycle: "monthly",
					trialUsed: false,
					createdAt: now,
				});
			applied = true;
		}

		await ctx.db.insert("paymentEvents", {
			provider: a.provider,
			eventId: a.eventId,
			eventType: a.eventType,
			testMode: a.testMode,
			userId: user?._id,
			tierKey: a.tierKey,
			applied,
			note,
			receivedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return { duplicate: false, applied };
	},
});

/** Dev check: latest recorded payment events (no payload, no secrets). Run: `convex run billing:recentPaymentEvents`. */
export const recentPaymentEvents = internalQuery({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit }) => {
		return await ctx.db
			.query("paymentEvents")
			.withIndex("by_receivedAt")
			.order("desc")
			.take(Math.min(limit ?? 10, 50));
	},
});
