import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { linkReplyText } from "../packages/core/reminders";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { LINK_STARTS_PER_DAY, TESTS_PER_DAY } from "./reminders";
import appSchema from "./schema";

/**
 * S14 reminders through Telegram on `convex-test` with the real schema and the real http router.
 * The env values are fake names-only stand-ins, `fetch` is a stub restored after every test (its
 * default throws, so nothing can reach the network), and every id, chat and phrase is synthetic.
 */

const modules: Record<string, () => Promise<unknown>> = {
	"./_generated/api.js": () => import("./_generated/api.js"),
	"./_generated/server.js": () => import("./_generated/server.js"),
	"./reminders.ts": () => import("./reminders"),
	"./http.ts": () => import("./http"),
};

const ENV = {
	TELEGRAM_BOT_TOKEN: "000000:fake-token-for-tests",
	TELEGRAM_WEBHOOK_SECRET: "fake-webhook-secret",
	TELEGRAM_BOT_USERNAME: "TempoTestBot",
} as const;
const CHAT = "777000111";

type FetchCall = { url: string; body: Record<string, unknown> };
let fetchCalls: FetchCall[] = [];
let fetchStatus: number | "unexpected" = "unexpected";
const realFetch = globalThis.fetch;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
	for (const [name, value] of Object.entries(ENV)) {
		savedEnv[name] = process.env[name];
		process.env[name] = value;
	}
	fetchCalls = [];
	fetchStatus = "unexpected";
	globalThis.fetch = (async (url: string, init?: { body?: string }) => {
		if (fetchStatus === "unexpected")
			throw new Error("no network in reminders tests");
		fetchCalls.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") });
		return new Response("{}", { status: fetchStatus });
	}) as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	for (const name of Object.keys(ENV)) {
		if (savedEnv[name] === undefined) delete process.env[name];
		else process.env[name] = savedEnv[name];
	}
});

const setup = () => convexTest(appSchema, modules);
type T = ReturnType<typeof setup>;

async function addUser(t: T, email: string, locale?: "en" | "he") {
	return t.run(async (ctx) => {
		const now = Date.now();
		const userId = await ctx.db.insert("users", {
			email,
			approvalStatus: "approved",
			createdAt: now,
			updatedAt: now,
		});
		if (locale) {
			await ctx.db.insert("userPreferences", {
				userId,
				theme: "system",
				locale,
				weekStartsOn: 0,
				timeZone: "Asia/Jerusalem",
				emailReminders: false,
				inAppNotifications: true,
				createdAt: now,
				updatedAt: now,
			});
		}
		return userId;
	});
}

async function addNag(t: T, userId: Id<"users">, enabled = true) {
	return t.run((ctx) =>
		ctx.db.insert("nags", {
			userId,
			label: "Plants",
			enabled,
			phrases: [
				{
					id: "mine",
					text: "Water the plants",
					source: "user",
					status: "accepted",
				},
				{
					id: "maybe",
					text: "Plants are thirsty",
					source: "derived",
					status: "proposed",
				},
			],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}),
	);
}

const as = (t: T, userId: Id<"users">) => t.withIdentity({ subject: userId });

async function startLink(t: T, userId: Id<"users">) {
	const started = await as(t, userId).mutation(
		api.reminders.startTelegramLink,
		{},
	);
	if (!started.ok) throw new Error(`start refused: ${started.reason}`);
	const code = new URL(started.url).searchParams.get("start") ?? "";
	return { ...started, code };
}

function postUpdate(
	t: T,
	text: string,
	opts: { secret?: string | null; chat?: Record<string, unknown> } = {},
) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	const secret =
		opts.secret === undefined ? ENV.TELEGRAM_WEBHOOK_SECRET : opts.secret;
	if (secret !== null) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;
	return t.fetch("/telegram/webhook", {
		method: "POST",
		headers,
		body: JSON.stringify({
			update_id: 1,
			message: {
				message_id: 1,
				text,
				chat: opts.chat ?? { id: Number(CHAT), type: "private" },
				from: { language_code: "en" },
			},
		}),
	});
}

async function telegramRow(t: T, userId: Id<"users">) {
	const list = await as(t, userId).query(api.reminders.channels, {});
	return list.find((c) => c.id === "telegram");
}

async function links(t: T, userId: Id<"users">) {
	return t.run((ctx) =>
		ctx.db
			.query("reminderChannelLinks")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect(),
	);
}

async function linked(t: T, userId: Id<"users">, chat = CHAT) {
	const { code } = await startLink(t, userId);
	const response = await postUpdate(t, `/start ${code}`, {
		chat: { id: Number(chat), type: "private" },
	});
	expect(response.status).toBe(200);
}

describe("env missing", () => {
	test("Telegram is not available, and every path refuses", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		delete process.env.TELEGRAM_BOT_TOKEN;
		expect(await telegramRow(t, userId)).toMatchObject({
			available: false,
			connected: false,
		});
		expect(
			await as(t, userId).mutation(api.reminders.startTelegramLink, {}),
		).toEqual({ ok: false, reason: "not_available" });
		expect(
			await t.action(internal.reminders.deliver, {
				userId,
				nagId,
				phraseId: "mine",
				channelId: "telegram",
			}),
		).toEqual({
			ok: false,
			reason: "no_channel",
		});
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({ ok: false, reason: "no_channel" });
		// Authenticated but half set up: 200 so Telegram doesn't retry, and nothing changes.
		const before = await links(t, userId);
		expect((await postUpdate(t, `/start ${"x".repeat(32)}`)).status).toBe(200);
		expect(await links(t, userId)).toEqual(before);
		delete process.env.TELEGRAM_WEBHOOK_SECRET;
		expect((await postUpdate(t, "/start abc")).status).toBe(503);
		expect(fetchCalls).toHaveLength(0);
	});

	test("WhatsApp and SMS are never available", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const list = await as(t, userId).query(api.reminders.channels, {});
		expect(
			list
				.filter((c) => c.id !== "telegram")
				.every((c) => c.available === false && !c.connected),
		).toBe(true);
	});
});

describe("webhook auth", () => {
	test("a missing or wrong secret is rejected and links nothing", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const { code } = await startLink(t, userId);
		expect(
			(await postUpdate(t, `/start ${code}`, { secret: null })).status,
		).toBe(401);
		expect(
			(await postUpdate(t, `/start ${code}`, { secret: "wrong" })).status,
		).toBe(401);
		expect(
			(
				await postUpdate(t, `/start ${code}`, {
					secret: `${ENV.TELEGRAM_WEBHOOK_SECRET}x`,
				})
			).status,
		).toBe(401);
		expect(await links(t, userId)).toHaveLength(0);
		// The code is still good after the rejected tries.
		expect((await postUpdate(t, `/start ${code}`)).status).toBe(200);
		expect(await telegramRow(t, userId)).toMatchObject({
			available: true,
			connected: true,
		});
	});

	test("a malformed body is 400; other messages, groups and plain /start are 200 with no reply", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const { code } = await startLink(t, userId);
		const bad = await t.fetch("/telegram/webhook", {
			method: "POST",
			headers: {
				"X-Telegram-Bot-Api-Secret-Token": ENV.TELEGRAM_WEBHOOK_SECRET,
			},
			body: "{not json",
		});
		expect(bad.status).toBe(400);
		for (const response of [
			await postUpdate(t, "hello"),
			await postUpdate(t, "/start"),
			await postUpdate(t, `/start ${code}`, {
				chat: { id: -100123, type: "group" },
			}),
		]) {
			expect(response.status).toBe(200);
			expect(await response.text()).toBe("");
		}
		expect(await links(t, userId)).toHaveLength(0);
	});
});

describe("linking", () => {
	test("start gives a t.me link with a one-time code; only its hash is stored", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const started = await startLink(t, userId);
		expect(started.url.startsWith("https://t.me/TempoTestBot?start=")).toBe(
			true,
		);
		expect(started.code).toMatch(/^[A-Za-z0-9_-]{32}$/);
		const rows = await t.run((ctx) =>
			ctx.db.query("reminderLinkCodes").collect(),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.codeHash).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.stringify(rows)).not.toContain(started.code);
		expect(started.expiresAt - (rows[0]?.createdAt ?? 0)).toBe(10 * 60 * 1000);
	});

	test("/start with the code links the chat and replies once in the webhook answer", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const { code } = await startLink(t, userId);
		const response = await postUpdate(t, `/start ${code}`);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			method: "sendMessage",
			chat_id: CHAT,
			text: linkReplyText("en", "linked"),
		});
		expect(
			(await links(t, userId)).map((l) => ({
				chatId: l.chatId,
				deletedAt: l.deletedAt,
			})),
		).toEqual([{ chatId: CHAT, deletedAt: undefined }]);
		expect(await telegramRow(t, userId)).toMatchObject({
			connected: true,
			linkedAt: expect.any(Number),
		});
		expect(fetchCalls).toHaveLength(0);
	});

	test("the reply follows the person's Tempo language", async () => {
		const t = setup();
		const userId = await addUser(t, "he@example.test", "he");
		const { code } = await startLink(t, userId);
		expect((await (await postUpdate(t, `/start ${code}`)).json()).text).toBe(
			linkReplyText("he", "linked"),
		);
	});

	test("a used, expired, replaced or unknown code links nothing and says so", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const first = await startLink(t, userId);
		const second = await startLink(t, userId);
		const expired = { text: linkReplyText("en", "expired") };
		// Replaced: the first code stopped working when the second was made.
		expect(
			await (await postUpdate(t, `/start ${first.code}`)).json(),
		).toMatchObject(expired);
		expect(
			await (await postUpdate(t, `/start ${"Z".repeat(32)}`)).json(),
		).toMatchObject(expired);
		expect(await links(t, userId)).toHaveLength(0);
		// Expired: ten minutes have passed.
		await t.run(async (ctx) => {
			const rows = await ctx.db.query("reminderLinkCodes").collect();
			for (const row of rows)
				await ctx.db.patch(row._id, { expiresAt: Date.now() - 1 });
		});
		expect(
			await (await postUpdate(t, `/start ${second.code}`)).json(),
		).toMatchObject(expired);
		expect(await links(t, userId)).toHaveLength(0);
		// Used: works once.
		const third = await startLink(t, userId);
		expect(
			await (await postUpdate(t, `/start ${third.code}`)).json(),
		).toMatchObject({ text: linkReplyText("en", "linked") });
		expect(
			await (
				await postUpdate(t, `/start ${third.code}`, {
					chat: { id: 555, type: "private" },
				})
			).json(),
		).toMatchObject(expired);
		expect((await links(t, userId)).map((l) => l.chatId)).toEqual([CHAT]);
	});

	test("linking again replaces the chat on the one live link", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		await linked(t, userId, "111");
		await linked(t, userId, "222");
		const rows = await links(t, userId);
		expect(
			rows.filter((l) => l.deletedAt === undefined).map((l) => l.chatId),
		).toEqual(["222"]);
	});

	test("starts are limited per person per day", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const other = await addUser(t, "b@example.test");
		for (let i = 0; i < LINK_STARTS_PER_DAY; i += 1) await startLink(t, userId);
		expect(
			await as(t, userId).mutation(api.reminders.startTelegramLink, {}),
		).toEqual({ ok: false, reason: "rate_limited" });
		expect(
			(await as(t, other).mutation(api.reminders.startTelegramLink, {})).ok,
		).toBe(true);
	});

	test("signed out can't start a link", async () => {
		const t = setup();
		await expect(
			t.mutation(api.reminders.startTelegramLink, {}),
		).rejects.toThrow();
	});
});

describe("unlink and Undo", () => {
	test("Disconnect is a soft delete; Undo brings the same link back", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		await linked(t, userId);
		const gone = await as(t, userId).mutation(api.reminders.unlinkTelegram, {});
		if (!gone.ok) throw new Error("unlink refused");
		expect(gone.undoUntil).toBeGreaterThan(Date.now());
		expect(await telegramRow(t, userId)).toMatchObject({ connected: false });
		expect((await links(t, userId))[0]?.deletedAt).toEqual(expect.any(Number));
		expect(
			await as(t, userId).mutation(api.reminders.undoUnlinkTelegram, {
				linkId: gone.linkId,
			}),
		).toEqual({ ok: true });
		expect(await telegramRow(t, userId)).toMatchObject({ connected: true });
		expect(await links(t, userId)).toHaveLength(1);
	});

	test("Undo refuses after 5 minutes, for someone else, and after a new link", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const other = await addUser(t, "b@example.test");
		await linked(t, userId);
		const gone = await as(t, userId).mutation(api.reminders.unlinkTelegram, {});
		if (!gone.ok) throw new Error("unlink refused");
		expect(
			await as(t, other).mutation(api.reminders.undoUnlinkTelegram, {
				linkId: gone.linkId,
			}),
		).toEqual({
			ok: false,
			reason: "not_found",
		});
		await linked(t, userId, "333");
		expect(
			await as(t, userId).mutation(api.reminders.undoUnlinkTelegram, {
				linkId: gone.linkId,
			}),
		).toEqual({
			ok: false,
			reason: "relinked",
		});
		await t.run((ctx) =>
			ctx.db.patch(gone.linkId, { deletedAt: Date.now() - 5 * 60 * 1000 - 1 }),
		);
		expect(
			await as(t, userId).mutation(api.reminders.undoUnlinkTelegram, {
				linkId: gone.linkId,
			}),
		).toEqual({
			ok: false,
			reason: "expired",
		});
		expect(
			await as(t, other).mutation(api.reminders.unlinkTelegram, {}),
		).toEqual({ ok: false, reason: "not_linked" });
	});
});

describe("deliver through Telegram", () => {
	test("sends only the accepted phrase to the person's chat", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		fetchStatus = 200;
		expect(
			await t.action(internal.reminders.deliver, {
				userId,
				nagId,
				phraseId: "mine",
				channelId: "telegram",
			}),
		).toEqual({ ok: true });
		expect(fetchCalls).toEqual([
			{
				url: `https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN}/sendMessage`,
				body: {
					chat_id: CHAT,
					text: "Water the plants",
					disable_web_page_preview: true,
				},
			},
		]);
	});

	test("403 (blocked the bot) breaks the link and refuses; it shows as needing a reconnect", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		fetchStatus = 403;
		expect(
			await t.action(internal.reminders.deliver, {
				userId,
				nagId,
				phraseId: "mine",
				channelId: "telegram",
			}),
		).toEqual({
			ok: false,
			reason: "blocked",
		});
		const [row] = await links(t, userId);
		expect(row?.brokenAt).toEqual(expect.any(Number));
		expect(row?.deletedAt).toEqual(expect.any(Number));
		expect(await telegramRow(t, userId)).toMatchObject({
			connected: false,
			needsReconnect: true,
		});
		// Nothing more goes to that chat.
		expect(
			await t.action(internal.reminders.deliver, {
				userId,
				nagId,
				phraseId: "mine",
				channelId: "telegram",
			}),
		).toEqual({
			ok: false,
			reason: "no_channel",
		});
		expect(fetchCalls).toHaveLength(1);
	});

	test("any other failure is send_failed and keeps the link", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		for (const status of [400, 429, 500]) {
			fetchStatus = status;
			expect(
				await t.action(internal.reminders.deliver, {
					userId,
					nagId,
					phraseId: "mine",
					channelId: "telegram",
				}),
			).toEqual({
				ok: false,
				reason: "send_failed",
			});
		}
		expect(await telegramRow(t, userId)).toMatchObject({ connected: true });
	});

	test("checks come first: someone else's nag, a proposed phrase, a nag that's off, no link", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const other = await addUser(t, "b@example.test");
		const nagId = await addNag(t, userId);
		const off = await addNag(t, userId, false);
		const call = (who: Id<"users">, nag: Id<"nags">, phraseId = "mine") =>
			t.action(internal.reminders.deliver, {
				userId: who,
				nagId: nag,
				phraseId,
				channelId: "telegram",
			});
		expect(await call(userId, nagId)).toEqual({
			ok: false,
			reason: "no_channel",
		});
		await linked(t, userId);
		await linked(t, other, "444");
		expect(await call(other, nagId)).toEqual({
			ok: false,
			reason: "not_found",
		});
		expect(await call(userId, nagId, "maybe")).toEqual({
			ok: false,
			reason: "not_accepted",
		});
		expect(await call(userId, off)).toEqual({ ok: false, reason: "nag_off" });
		expect(
			await t.action(internal.reminders.deliver, {
				userId,
				nagId,
				phraseId: "mine",
				channelId: "whatsapp",
			}),
		).toEqual({
			ok: false,
			reason: "no_channel",
		});
		expect(fetchCalls).toHaveLength(0);
	});
});

describe("Send a test", () => {
	test("the owner sends one accepted phrase of their own nag, a few times a day", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		fetchStatus = 200;
		for (let i = 0; i < TESTS_PER_DAY; i += 1) {
			expect(
				await as(t, userId).action(api.reminders.sendTest, {
					nagId,
					phraseId: "mine",
				}),
			).toEqual({ ok: true });
		}
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({
			ok: false,
			reason: "rate_limited",
		});
		expect(fetchCalls).toHaveLength(TESTS_PER_DAY);
		expect(
			fetchCalls.every(
				(c) => c.body.text === "Water the plants" && c.body.chat_id === CHAT,
			),
		).toBe(true);
	});

	test("goes through the same checks, and refused tries don't use up the day", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const other = await addUser(t, "b@example.test");
		const nagId = await addNag(t, userId);
		const off = await addNag(t, userId, false);
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({ ok: false, reason: "no_channel" });
		await linked(t, userId);
		await linked(t, other, "444");
		expect(
			await as(t, other).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({ ok: false, reason: "not_found" });
		for (let i = 0; i < TESTS_PER_DAY + 1; i += 1) {
			expect(
				await as(t, userId).action(api.reminders.sendTest, {
					nagId,
					phraseId: "maybe",
				}),
			).toEqual({
				ok: false,
				reason: "not_accepted",
			});
		}
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId: off,
				phraseId: "mine",
			}),
		).toEqual({ ok: false, reason: "nag_off" });
		fetchStatus = 200;
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({ ok: true });
		await expect(
			t.action(api.reminders.sendTest, { nagId, phraseId: "mine" }),
		).rejects.toThrow();
	});

	test("a 403 on a test breaks the link too", async () => {
		const t = setup();
		const userId = await addUser(t, "a@example.test");
		const nagId = await addNag(t, userId);
		await linked(t, userId);
		fetchStatus = 403;
		expect(
			await as(t, userId).action(api.reminders.sendTest, {
				nagId,
				phraseId: "mine",
			}),
		).toEqual({ ok: false, reason: "blocked" });
		expect(await telegramRow(t, userId)).toMatchObject({
			connected: false,
			needsReconnect: true,
		});
	});
});

describe("the webhook route", () => {
	test("is POST /telegram/webhook on the app's http router", async () => {
		const http = (await import("./http")).default;
		expect(http.lookup("/telegram/webhook", "POST")).not.toBeNull();
	});
});
