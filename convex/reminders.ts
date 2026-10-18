import { v } from "convex/values";
import {
	LINK_CODE_TTL_MS,
	linkReplyText,
	newLinkCode,
	parseStartUpdate,
	reminderRegistry,
	reminderText,
	replyLangFromTelegram,
	sameSecret,
	sha256Hex,
	telegramChannel,
	telegramDeepLink,
	telegramEnv,
	webhookReplyBody,
} from "../packages/core/reminders";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	action,
	httpAction,
	internalAction,
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import { isInactiveAccount } from "./lib/accountDeletion";
import { requireUser, resolveUserFromIdentity } from "./lib/requireUser";
import { UNDO_WINDOW_MS } from "./lib/softDelete";

/**
 * S14 reminders through a messaging channel (PRD F-61). On 2026-10-18 Amit said "Reminders, yes"
 * and the channel is Telegram (its Bot API is free per message and handles Hebrew). WhatsApp and
 * SMS cost money per message and stay inert placeholders that always refuse with `no_channel`.
 *
 * Telegram fails closed. It needs three env vars, by NAME only: `TELEGRAM_BOT_TOKEN`,
 * `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`. With any one missing it shows as "not
 * available yet" and every path refuses. Linking: `startTelegramLink` hands out a t.me deep link
 * with a one-time code (only its SHA-256 is stored, 10 minutes, one live code per person); the
 * person presses Start; Telegram posts `/start <code>` to `POST /telegram/webhook`, which checks
 * the secret header in constant time, consumes the code and stores the person's chat id. Unlink is
 * a soft delete with a 5-minute Undo. Nothing here logs a body, the token, a code or a chat id.
 *
 * No model is called anywhere here, so these functions use `requireUser` (an account that is
 * signed in and active), not `requireApprovedForAi`.
 */

/** "Connect" presses a person can make in a UTC day [EXTRAPOLATED: the docs give no number]. */
export const LINK_STARTS_PER_DAY = 10;
/** "Send a test" presses a person can make in a UTC day [EXTRAPOLATED]. */
export const TESTS_PER_DAY = 5;

const utcDateKey = (now: number) => new Date(now).toISOString().slice(0, 10);

const telegramReady = () => telegramEnv(process.env) !== null;

// ---------------------------------------------------------------------------------------------
// Channels, per person
// ---------------------------------------------------------------------------------------------

const channelValidator = v.object({
	id: v.string(),
	label: v.string(),
	kind: v.literal("messaging"),
	connected: v.boolean(),
	/** Additive: false when the channel can't be connected at all (env missing, or a placeholder). */
	available: v.optional(v.boolean()),
	/** Additive: when the live link was made. */
	linkedAt: v.optional(v.number()),
	/** Additive: the last link stopped because Telegram said the bot was blocked. */
	needsReconnect: v.optional(v.boolean()),
});

/** The signed-in, active person, or null. Never throws, so the list shows signed out too. */
async function currentUser(
	ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) return null;
	const user = await resolveUserFromIdentity(ctx, identity);
	return user && !isInactiveAccount(user) ? user : null;
}

async function telegramLinks(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
	return ctx.db
		.query("reminderChannelLinks")
		.withIndex("by_userId_channelId", (q) =>
			q.eq("userId", userId).eq("channelId", "telegram"),
		)
		.collect();
}

const liveOf = (links: readonly Doc<"reminderChannelLinks">[]) =>
	links.find((link) => link.deletedAt === undefined) ?? null;

/**
 * The channels for Settings > Reminders. Telegram is `connected` only when its env is complete
 * and the signed-in person has a live link; WhatsApp and SMS are never available.
 */
export const channels = query({
	args: {},
	returns: v.array(channelValidator),
	handler: async (ctx) => {
		const ready = telegramReady();
		const user = ready ? await currentUser(ctx) : null;
		const links = user ? await telegramLinks(ctx, user._id) : [];
		const live = liveOf(links);
		const latest = links.reduce<Doc<"reminderChannelLinks"> | null>(
			(best, link) =>
				best === null || link.updatedAt > best.updatedAt ? link : best,
			null,
		);
		return reminderRegistry.list().map((channel) => {
			if (channel.id !== "telegram") return { ...channel, available: false };
			return {
				...channel,
				available: ready,
				connected: ready && live !== null,
				...(live ? { linkedAt: live.linkedAt } : {}),
				...(!live && latest?.brokenAt !== undefined
					? { needsReconnect: true }
					: {}),
			};
		});
	},
});

// ---------------------------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------------------------

/**
 * Start linking Telegram: a fresh one-time code (the older live one stops working) and the deep
 * link that carries it. Refuses when Telegram isn't set up or after LINK_STARTS_PER_DAY today.
 */
export const startTelegramLink = mutation({
	args: {},
	returns: v.union(
		v.object({ ok: v.literal(true), url: v.string(), expiresAt: v.number() }),
		v.object({
			ok: v.literal(false),
			reason: v.union(v.literal("not_available"), v.literal("rate_limited")),
		}),
	),
	handler: async (ctx) => {
		const user = await requireUser(ctx);
		const env = telegramEnv(process.env);
		if (!env) return { ok: false as const, reason: "not_available" as const };
		const now = Date.now();
		const dayKey = utcDateKey(now);
		const today = await ctx.db
			.query("reminderLinkCodes")
			.withIndex("by_userId_utcDateKey", (q) =>
				q.eq("userId", user._id).eq("utcDateKey", dayKey),
			)
			.collect();
		if (today.length >= LINK_STARTS_PER_DAY)
			return { ok: false as const, reason: "rate_limited" as const };
		const codes = await ctx.db
			.query("reminderLinkCodes")
			.withIndex("by_userId", (q) => q.eq("userId", user._id))
			.collect();
		for (const old of codes) {
			if (old.deletedAt === undefined && old.usedAt === undefined) {
				await ctx.db.patch(old._id, { deletedAt: now, updatedAt: now });
			}
		}
		const code = newLinkCode();
		const expiresAt = now + LINK_CODE_TTL_MS;
		await ctx.db.insert("reminderLinkCodes", {
			userId: user._id,
			channelId: "telegram",
			codeHash: await sha256Hex(code),
			expiresAt,
			utcDateKey: dayKey,
			createdAt: now,
			updatedAt: now,
		});
		return {
			ok: true as const,
			url: telegramDeepLink(env.botUsername, code),
			expiresAt,
		};
	},
});

/**
 * The webhook's write: consume a live, unused code and point the person's Telegram link at
 * `chatId` (replacing an older chat). Returns the person's Tempo language for the reply, when set.
 */
export const consumeLinkCode = internalMutation({
	args: { codeHash: v.string(), chatId: v.string() },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			lang: v.union(v.null(), v.literal("en"), v.literal("he")),
		}),
		v.object({ ok: v.literal(false) }),
	),
	handler: async (ctx, args) => {
		const now = Date.now();
		const code = await ctx.db
			.query("reminderLinkCodes")
			.withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
			.first();
		if (
			!code ||
			code.deletedAt !== undefined ||
			code.usedAt !== undefined ||
			code.expiresAt <= now
		) {
			return { ok: false as const };
		}
		const user = await ctx.db.get(code.userId);
		if (!user || isInactiveAccount(user)) return { ok: false as const };
		await ctx.db.patch(code._id, { usedAt: now, updatedAt: now });
		const links = await telegramLinks(ctx, code.userId);
		const live = links.filter((link) => link.deletedAt === undefined);
		const [keep, ...extra] = live;
		if (keep) {
			await ctx.db.patch(keep._id, {
				chatId: args.chatId,
				linkedAt: now,
				brokenAt: undefined,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("reminderChannelLinks", {
				userId: code.userId,
				channelId: "telegram",
				chatId: args.chatId,
				linkedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		}
		for (const link of extra)
			await ctx.db.patch(link._id, { deletedAt: now, updatedAt: now });
		const prefs = await ctx.db
			.query("userPreferences")
			.withIndex("by_userId", (q) => q.eq("userId", code.userId))
			.first();
		return {
			ok: true as const,
			lang: prefs && prefs.deletedAt === undefined ? prefs.locale : null,
		};
	},
});

const empty200 = () => new Response(null, { status: 200 });

/**
 * `POST /telegram/webhook`. Telegram sends the secret it was given in `setWebhook` as
 * `X-Telegram-Bot-Api-Secret-Token`; anything without it is rejected. An authenticated request
 * always gets 200 (Telegram retries anything else), and only a private `/start <code>` does
 * something: the reply is sent as the webhook answer (one `sendMessage`, no second request).
 */
export const telegramWebhook = httpAction(async (ctx, request) => {
	const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
	if (!secret) return new Response(null, { status: 503 });
	if (
		!(await sameSecret(
			request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
			secret,
		))
	) {
		return new Response(null, { status: 401 });
	}
	let update: unknown;
	try {
		update = await request.json();
	} catch {
		return new Response(null, { status: 400 });
	}
	// Authenticated, but Telegram is only half set up: accept and do nothing.
	if (!telegramReady()) return empty200();
	const start = parseStartUpdate(update);
	if (!start) return empty200();
	const result = await ctx.runMutation(internal.reminders.consumeLinkCode, {
		codeHash: await sha256Hex(start.code),
		chatId: start.chatId,
	});
	const fallback = replyLangFromTelegram(start.languageCode);
	const text = result.ok
		? linkReplyText(result.lang ?? fallback, "linked")
		: linkReplyText(fallback, "expired");
	return new Response(webhookReplyBody(start.chatId, text), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
});

/** Disconnect Telegram: a soft delete the person can undo for 5 minutes. */
export const unlinkTelegram = mutation({
	args: {},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			linkId: v.id("reminderChannelLinks"),
			undoUntil: v.number(),
		}),
		v.object({ ok: v.literal(false), reason: v.literal("not_linked") }),
	),
	handler: async (ctx) => {
		const user = await requireUser(ctx);
		const live = liveOf(await telegramLinks(ctx, user._id));
		if (!live) return { ok: false as const, reason: "not_linked" as const };
		const now = Date.now();
		await ctx.db.patch(live._id, { deletedAt: now, updatedAt: now });
		return {
			ok: true as const,
			linkId: live._id,
			undoUntil: now + UNDO_WINDOW_MS,
		};
	},
});

/** Undo `unlinkTelegram` within 5 minutes, unless the person has linked another chat since. */
export const undoUnlinkTelegram = mutation({
	args: { linkId: v.id("reminderChannelLinks") },
	returns: v.union(
		v.object({ ok: v.literal(true) }),
		v.object({
			ok: v.literal(false),
			reason: v.union(
				v.literal("not_found"),
				v.literal("expired"),
				v.literal("relinked"),
			),
		}),
	),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const link = await ctx.db.get(args.linkId);
		if (
			!link ||
			link.userId !== user._id ||
			link.deletedAt === undefined ||
			link.brokenAt !== undefined
		) {
			return { ok: false as const, reason: "not_found" as const };
		}
		const now = Date.now();
		if (now - link.deletedAt > UNDO_WINDOW_MS)
			return { ok: false as const, reason: "expired" as const };
		if (liveOf(await telegramLinks(ctx, user._id)))
			return { ok: false as const, reason: "relinked" as const };
		await ctx.db.patch(link._id, { deletedAt: undefined, updatedAt: now });
		return { ok: true as const };
	},
});

// ---------------------------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------------------------

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

/** The person's live Telegram link (id and chat), or null. Internal: `deliver` only. */
export const liveTelegramLink = internalQuery({
	args: { userId: v.id("users") },
	returns: v.union(
		v.null(),
		v.object({ linkId: v.id("reminderChannelLinks"), chatId: v.string() }),
	),
	handler: async (ctx, args) => {
		const live = liveOf(await telegramLinks(ctx, args.userId));
		return live ? { linkId: live._id, chatId: live.chatId } : null;
	},
});

/** Telegram answered 403 (the person blocked the bot): stop sending to that chat. */
export const markLinkBroken = internalMutation({
	args: { linkId: v.id("reminderChannelLinks") },
	returns: v.null(),
	handler: async (ctx, args) => {
		const link = await ctx.db.get(args.linkId);
		if (!link || link.deletedAt !== undefined) return null;
		const now = Date.now();
		await ctx.db.patch(link._id, {
			brokenAt: now,
			deletedAt: now,
			updatedAt: now,
		});
		return null;
	},
});

const refusalReason = v.union(
	v.literal("not_found"),
	v.literal("unknown_channel"),
	v.literal("not_accepted"),
	v.literal("nag_off"),
	v.literal("no_channel"),
	// Additive (Telegram): the person blocked the bot, the send failed, or too many tests today.
	v.literal("blocked"),
	v.literal("send_failed"),
	v.literal("rate_limited"),
);

const deliverReturns = v.union(
	v.object({ ok: v.literal(true) }),
	v.object({ ok: v.literal(false), reason: refusalReason }),
);

type Refusal =
	| "not_found"
	| "unknown_channel"
	| "not_accepted"
	| "nag_off"
	| "no_channel";

export type DeliverResult =
	| { ok: true }
	| { ok: false; reason: Refusal | "blocked" | "send_failed" | "rate_limited" };

type NagForDelivery = {
	enabled: boolean;
	phrases: Doc<"nags">["phrases"];
} | null;

/**
 * The checks every send makes, in order, before it looks for the person's chat: the nag is theirs
 * and live, the channel exists, the phrase is accepted (F-60: only their own words) and the nag is
 * on. Gives the words to send, or the refusal.
 */
function checkNag(
	nag: NagForDelivery,
	channelId: string,
	phraseId: string,
): { ok: true; text: string } | { ok: false; reason: Refusal } {
	if (!nag) return { ok: false, reason: "not_found" };
	if (!reminderRegistry.has(channelId))
		return { ok: false, reason: "unknown_channel" };
	const text = reminderText(nag, phraseId);
	if (text === null) return { ok: false, reason: "not_accepted" };
	if (!nag.enabled) return { ok: false, reason: "nag_off" };
	return { ok: true, text };
}

/** One Telegram send. A 403 marks the link broken so nothing goes to that chat again. */
async function sendThroughTelegram(
	ctx: ActionCtx,
	token: string,
	link: { linkId: Id<"reminderChannelLinks">; chatId: string },
	text: string,
): Promise<DeliverResult> {
	const channel = telegramChannel({
		token,
		fetch: (url, init) => fetch(url, init),
	});
	const sent = await channel.send(link.chatId, text);
	if (sent.ok) return { ok: true };
	if (sent.reason === "blocked") {
		await ctx.runMutation(internal.reminders.markLinkBroken, {
			linkId: link.linkId,
		});
		return { ok: false, reason: "blocked" };
	}
	return { ok: false, reason: "send_failed" };
}

/**
 * Send one of a nag's own accepted phrases (F-60) through `channelId`. Internal (scheduler /
 * server only): `userId` is the nag's owner; another person's nag is `not_found`. Telegram sends
 * when its env is complete and the person has a live link; every other case refuses, and WhatsApp
 * and SMS always answer `no_channel`.
 */
export const deliver = internalAction({
	args: {
		userId: v.id("users"),
		nagId: v.id("nags"),
		phraseId: v.string(),
		channelId: v.string(),
	},
	returns: deliverReturns,
	handler: async (ctx, args): Promise<DeliverResult> => {
		const nag = await ctx.runQuery(internal.reminders.nagForDelivery, {
			userId: args.userId,
			nagId: args.nagId,
		});
		const checked = checkNag(nag, args.channelId, args.phraseId);
		if (!checked.ok) return checked;
		if (args.channelId !== "telegram") {
			// WhatsApp and SMS are placeholders: the registry never hands one out.
			return { ok: false, reason: "no_channel" };
		}
		const env = telegramEnv(process.env);
		if (!env) return { ok: false, reason: "no_channel" };
		const link = await ctx.runQuery(internal.reminders.liveTelegramLink, {
			userId: args.userId,
		});
		if (!link) return { ok: false, reason: "no_channel" };
		return sendThroughTelegram(ctx, env.token, link, checked.text);
	},
});

/**
 * The signed-in owner's side of "Send a test": the same checks as `deliver`, then the daily
 * limit, counted only when a send will actually be tried.
 */
export const claimTestSend = internalMutation({
	args: { nagId: v.id("nags"), phraseId: v.string() },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			linkId: v.id("reminderChannelLinks"),
			chatId: v.string(),
			text: v.string(),
		}),
		v.object({ ok: v.literal(false), reason: refusalReason }),
	),
	handler: async (ctx, args) => {
		const user = await requireUser(ctx);
		const row = await ctx.db.get(args.nagId);
		const nag =
			row && row.userId === user._id && row.deletedAt === undefined
				? row
				: null;
		const checked = checkNag(nag, "telegram", args.phraseId);
		if (!checked.ok) return checked;
		if (!telegramReady())
			return { ok: false as const, reason: "no_channel" as const };
		const live = liveOf(await telegramLinks(ctx, user._id));
		if (!live) return { ok: false as const, reason: "no_channel" as const };
		const now = Date.now();
		const dayKey = utcDateKey(now);
		const used = live.testUtcDateKey === dayKey ? (live.testsToday ?? 0) : 0;
		if (used >= TESTS_PER_DAY)
			return { ok: false as const, reason: "rate_limited" as const };
		await ctx.db.patch(live._id, {
			testUtcDateKey: dayKey,
			testsToday: used + 1,
			updatedAt: now,
		});
		return {
			ok: true as const,
			linkId: live._id,
			chatId: live.chatId,
			text: checked.text,
		};
	},
});

/**
 * "Send a test" from Settings > Reminders: sends one accepted phrase of the signed-in person's own
 * nag to their linked Telegram, so they (and a phone walk) can see a reminder arrive.
 */
export const sendTest = action({
	args: { nagId: v.id("nags"), phraseId: v.string() },
	returns: deliverReturns,
	handler: async (ctx, args): Promise<DeliverResult> => {
		const claim = await ctx.runMutation(internal.reminders.claimTestSend, args);
		if (!claim.ok) return claim;
		const env = telegramEnv(process.env);
		if (!env) return { ok: false, reason: "no_channel" };
		return sendThroughTelegram(
			ctx,
			env.token,
			{ linkId: claim.linkId, chatId: claim.chatId },
			claim.text,
		);
	},
});
