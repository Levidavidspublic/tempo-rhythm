import { v } from "convex/values";
import { reminderRegistry, reminderText } from "../packages/core/reminders";
import { internal } from "./_generated/api";
import { internalAction, internalQuery, query } from "./_generated/server";

/**
 * S14 reminders through a messaging channel (PRD F-61). The channel is UNKNOWN (Needs Amit), so
 * this module is the seam only: it lists the candidate channels, none connected, and `deliver`
 * checks everything a real send would need and then refuses with `no_channel`. It never calls
 * the network, reads no env var and stores nothing. No new table.
 */

const channelValidator = v.object({
	id: v.string(),
	label: v.string(),
	kind: v.literal("messaging"),
	connected: v.boolean(),
});

/** The candidate channels for Settings > Reminders. None is connected today. */
export const channels = query({
	args: {},
	returns: v.array(channelValidator),
	handler: async () => reminderRegistry.list(),
});

const phraseValidator = v.object({
	id: v.string(),
	text: v.string(),
	source: v.union(v.literal("user"), v.literal("derived")),
	status: v.union(
		v.literal("proposed"),
		v.literal("accepted"),
		v.literal("rejected"),
	),
});

/**
 * `userId`'s own live nag, or null (someone else's, deleted or missing). Internal and called from
 * `deliver`, which runs from the scheduler with no signed-in person, so the owner is the
 * `userId` the caller passes, checked against the nag.
 */
export const nagForDelivery = internalQuery({
	args: { userId: v.id("users"), nagId: v.id("nags") },
	returns: v.union(
		v.null(),
		v.object({ enabled: v.boolean(), phrases: v.array(phraseValidator) }),
	),
	handler: async (ctx, args) => {
		const nag = await ctx.db.get(args.nagId);
		if (!nag || nag.userId !== args.userId || nag.deletedAt !== undefined) {
			return null;
		}
		return { enabled: nag.enabled, phrases: nag.phrases };
	},
});

const refusal = v.union(
	v.literal("not_found"),
	v.literal("unknown_channel"),
	v.literal("not_accepted"),
	v.literal("nag_off"),
	v.literal("no_channel"),
);

export type DeliverResult = {
	ok: false;
	reason:
		| "not_found"
		| "unknown_channel"
		| "not_accepted"
		| "nag_off"
		| "no_channel";
};

/**
 * Would send one of a nag's own accepted phrases (F-60) through `channelId`. Today every path
 * refuses: no channel is connected, so the last check answers `no_channel` and nothing is sent.
 * Internal (scheduler / server only): `userId` is the nag's owner; another person's nag is
 * `not_found`.
 */
export const deliver = internalAction({
	args: {
		userId: v.id("users"),
		nagId: v.id("nags"),
		phraseId: v.string(),
		channelId: v.string(),
	},
	returns: v.object({ ok: v.literal(false), reason: refusal }),
	handler: async (ctx, args): Promise<DeliverResult> => {
		const nag = await ctx.runQuery(internal.reminders.nagForDelivery, {
			userId: args.userId,
			nagId: args.nagId,
		});
		if (!nag) return { ok: false, reason: "not_found" };
		if (!reminderRegistry.has(args.channelId))
			return { ok: false, reason: "unknown_channel" };
		const text = reminderText(nag, args.phraseId);
		if (text === null) return { ok: false, reason: "not_accepted" };
		if (!nag.enabled) return { ok: false, reason: "nag_off" };
		const channel = reminderRegistry.live(args.channelId);
		if (!channel) return { ok: false, reason: "no_channel" };
		// Unreachable while the registry has no live channel. A connected channel lands here with
		// its own address for the person and `text`; that wiring is part of choosing the channel.
		return { ok: false, reason: "no_channel" };
	},
});
