import { describe, expect, test } from "bun:test";
import {
	isLinkCodeShape,
	linkReplyText,
	newLinkCode,
	parseStartUpdate,
	replyLangFromTelegram,
	sameSecret,
	sha256Hex,
	type TelegramFetch,
	telegramChannel,
	telegramDeepLink,
	telegramEnv,
	telegramSendRequest,
	webhookReplyBody,
} from "./index";

/** Fake values only: none of these is a real token, secret, bot or chat. */
const FAKE_TOKEN = "000000:fake-token-for-tests";
const CODE = "abcdefghijklmnopqrstuvwxyzABCDEF";

function fakeFetch(status: number | "throw") {
	const calls: Array<{ url: string; init: Parameters<TelegramFetch>[1] }> = [];
	const fetch: TelegramFetch = async (url, init) => {
		calls.push({ url, init });
		if (status === "throw") throw new Error("offline");
		return { status };
	};
	return { fetch, calls };
}

describe("telegramEnv", () => {
	const full = {
		TELEGRAM_BOT_TOKEN: FAKE_TOKEN,
		TELEGRAM_WEBHOOK_SECRET: "s3cret",
		TELEGRAM_BOT_USERNAME: "@TempoTestBot",
	};

	test("all three set gives the settings, without a leading @ on the name", () => {
		expect(telegramEnv(full)).toEqual({
			token: FAKE_TOKEN,
			webhookSecret: "s3cret",
			botUsername: "TempoTestBot",
		});
	});

	test("any one missing, blank or a bad bot name gives null", () => {
		for (const name of [
			"TELEGRAM_BOT_TOKEN",
			"TELEGRAM_WEBHOOK_SECRET",
			"TELEGRAM_BOT_USERNAME",
		] as const) {
			expect(telegramEnv({ ...full, [name]: undefined })).toBeNull();
			expect(telegramEnv({ ...full, [name]: "  " })).toBeNull();
		}
		expect(
			telegramEnv({ ...full, TELEGRAM_BOT_USERNAME: "bad name/../x" }),
		).toBeNull();
		expect(telegramEnv({})).toBeNull();
	});
});

describe("link codes", () => {
	test("a code is 32 URL-safe characters from the random source", () => {
		const code = newLinkCode((bytes) => bytes.fill(251));
		expect(code).toHaveLength(32);
		expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(isLinkCodeShape(code)).toBe(true);
		expect(newLinkCode()).not.toBe(newLinkCode());
	});

	test("the deep link carries the bot name and the code", () => {
		expect(telegramDeepLink("TempoTestBot", CODE)).toBe(
			`https://t.me/TempoTestBot?start=${CODE}`,
		);
	});

	test("sha256Hex matches the published vector", async () => {
		expect(await sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	test("sameSecret is true only for the exact secret", async () => {
		expect(await sameSecret("s3cret", "s3cret")).toBe(true);
		expect(await sameSecret("s3creT", "s3cret")).toBe(false);
		expect(await sameSecret("s3cret-and-more", "s3cret")).toBe(false);
		expect(await sameSecret("", "s3cret")).toBe(false);
		expect(await sameSecret(null, "s3cret")).toBe(false);
		expect(await sameSecret(undefined, "s3cret")).toBe(false);
	});
});

describe("parseStartUpdate", () => {
	const update = (message: Record<string, unknown>) => ({
		update_id: 1,
		message,
	});
	const privateChat = { id: 4242, type: "private" };

	test("a private /start with a code-shaped parameter", () => {
		expect(
			parseStartUpdate(
				update({
					text: `/start ${CODE}`,
					chat: privateChat,
					from: { language_code: "he" },
				}),
			),
		).toEqual({
			chatId: "4242",
			code: CODE,
			languageCode: "he",
		});
		expect(
			parseStartUpdate(
				update({ text: `/start@TempoTestBot ${CODE}`, chat: privateChat }),
			)?.code,
		).toBe(CODE);
	});

	test("anything else is ignored", () => {
		expect(parseStartUpdate(null)).toBeNull();
		expect(parseStartUpdate({ update_id: 1 })).toBeNull();
		expect(
			parseStartUpdate(update({ text: "/start", chat: privateChat })),
		).toBeNull();
		expect(
			parseStartUpdate(update({ text: `hello ${CODE}`, chat: privateChat })),
		).toBeNull();
		expect(
			parseStartUpdate(update({ text: "/start short", chat: privateChat })),
		).toBeNull();
		expect(
			parseStartUpdate(update({ text: `/start ${CODE}!`, chat: privateChat })),
		).toBeNull();
		expect(
			parseStartUpdate(
				update({ text: `/start ${CODE}`, chat: { id: -100, type: "group" } }),
			),
		).toBeNull();
		expect(
			parseStartUpdate(
				update({ text: `/start ${CODE}`, chat: { id: "x1", type: "private" } }),
			),
		).toBeNull();
		expect(
			parseStartUpdate({
				edited_message: { text: `/start ${CODE}`, chat: privateChat },
			}),
		).toBeNull();
	});
});

describe("replies while linking", () => {
	test("English and Hebrew, picked from Telegram's language code", () => {
		expect(replyLangFromTelegram("he")).toBe("he");
		expect(replyLangFromTelegram("iw")).toBe("he");
		expect(replyLangFromTelegram("en-US")).toBe("en");
		expect(replyLangFromTelegram(null)).toBe("en");
		for (const lang of ["en", "he"] as const) {
			for (const kind of ["linked", "expired"] as const) {
				const text = linkReplyText(lang, kind);
				expect(text.length).toBeGreaterThan(10);
				expect(text).not.toContain("—");
				expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
			}
		}
	});

	test("the webhook answer asks Telegram to send one message", () => {
		expect(JSON.parse(webhookReplyBody("4242", "Hi"))).toEqual({
			method: "sendMessage",
			chat_id: "4242",
			text: "Hi",
		});
	});
});

describe("telegramChannel", () => {
	test("the request is one sendMessage with only the chat and the words", () => {
		const { url, init } = telegramSendRequest(
			FAKE_TOKEN,
			"4242",
			"Water the plants",
		);
		expect(url).toBe(`https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`);
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({
			chat_id: "4242",
			text: "Water the plants",
			disable_web_page_preview: true,
		});
	});

	test("2xx sends, 403 is blocked, anything else or a throw is send_failed", async () => {
		const ok = fakeFetch(200);
		expect(
			await telegramChannel({ token: FAKE_TOKEN, fetch: ok.fetch }).send(
				"4242",
				"  Grab the keys ",
			),
		).toEqual({ ok: true });
		expect(JSON.parse(ok.calls[0]?.init.body ?? "{}").text).toBe(
			"Grab the keys",
		);
		expect(
			await telegramChannel({
				token: FAKE_TOKEN,
				fetch: fakeFetch(403).fetch,
			}).send("4242", "x"),
		).toEqual({
			ok: false,
			reason: "blocked",
		});
		for (const status of [400, 429, 500] as const) {
			expect(
				await telegramChannel({
					token: FAKE_TOKEN,
					fetch: fakeFetch(status).fetch,
				}).send("4242", "x"),
			).toEqual({
				ok: false,
				reason: "send_failed",
			});
		}
		const thrown = await telegramChannel({
			token: FAKE_TOKEN,
			fetch: fakeFetch("throw").fetch,
		}).send("4242", "x");
		expect(thrown).toEqual({ ok: false, reason: "send_failed" });
		expect(JSON.stringify(thrown)).not.toContain(FAKE_TOKEN);
	});

	test("blank words or no chat never call the network", async () => {
		const { fetch, calls } = fakeFetch(200);
		const channel = telegramChannel({ token: FAKE_TOKEN, fetch });
		expect(await channel.send("4242", "   ")).toEqual({
			ok: false,
			reason: "empty_text",
		});
		expect(await channel.send("", "Hi")).toEqual({
			ok: false,
			reason: "not_connected",
		});
		expect(await channel.connect()).toEqual({
			ok: false,
			reason: "not_connected",
		});
		expect(calls).toHaveLength(0);
		expect(channel.id).toBe("telegram");
	});
});
