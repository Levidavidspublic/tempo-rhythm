/**
 * S14 reminders through Telegram (PRD F-61; channel picked 2026-10-18 because the Bot API is free
 * per message and handles Hebrew). Plain TypeScript: everything here is pure or goes through an
 * injected `fetch`, so tests never reach the network. Nothing here logs, and no error or result
 * ever carries the bot token, a link code or a chat id.
 */

import type { ReminderChannel, SendResult } from "./channel";

export const TELEGRAM_API_ORIGIN = "https://api.telegram.org";

/** The env var NAMES the Telegram channel needs. Values are set on each deployment, never here. */
export const TELEGRAM_ENV_NAMES = [
	"TELEGRAM_BOT_TOKEN",
	"TELEGRAM_WEBHOOK_SECRET",
	"TELEGRAM_BOT_USERNAME",
] as const;

export type TelegramEnv = {
	token: string;
	webhookSecret: string;
	botUsername: string;
};

const BOT_USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/**
 * The three Telegram settings, or null when any is missing or blank (then Telegram is "not
 * available yet" and every path refuses). `env` is `process.env` on the server.
 */
export function telegramEnv(
	env: Readonly<Record<string, string | undefined>>,
): TelegramEnv | null {
	const token = env.TELEGRAM_BOT_TOKEN?.trim();
	const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
	const botUsername = env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
	if (
		!token ||
		!webhookSecret ||
		!botUsername ||
		!BOT_USERNAME.test(botUsername)
	)
		return null;
	return { token, webhookSecret, botUsername };
}

// ---------------------------------------------------------------------------------------------
// Link codes
// ---------------------------------------------------------------------------------------------

/** A code lives 10 minutes; a new one replaces the person's old one. */
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

/** 24 random bytes give 32 URL-safe characters (Telegram's start parameter allows up to 64). */
const LINK_CODE_BYTES = 24;

/** Only what Telegram allows in a `start` parameter, and long enough to be a code of ours. */
const LINK_CODE_SHAPE = /^[A-Za-z0-9_-]{24,64}$/;

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** A fresh one-time code: 32 URL-safe characters from `crypto.getRandomValues`. */
export function newLinkCode(
	random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b),
): string {
	return base64Url(random(new Uint8Array(LINK_CODE_BYTES)));
}

export function isLinkCodeShape(code: string): boolean {
	return LINK_CODE_SHAPE.test(code);
}

/** The t.me deep link that opens the bot with Start, carrying the code. */
export function telegramDeepLink(botUsername: string, code: string): string {
	return `https://t.me/${encodeURIComponent(botUsername)}?start=${encodeURIComponent(code)}`;
}

/** Lowercase SHA-256 hex of the UTF-8 text (Web Crypto, as `convex/lib/pageLedger.ts` uses). */
export async function sha256Hex(text: string): Promise<string> {
	const digest = new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
	);
	let hex = "";
	for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
	return hex;
}

/**
 * Whether `given` equals `expected`, in time that doesn't depend on where they differ: both are
 * hashed to 32 bytes first (so their lengths don't leak either) and every byte is compared.
 */
export async function sameSecret(
	given: string | null | undefined,
	expected: string,
): Promise<boolean> {
	if (typeof given !== "string" || given.length === 0 || expected.length === 0)
		return false;
	const enc = new TextEncoder();
	const [a, b] = await Promise.all([
		crypto.subtle.digest("SHA-256", enc.encode(given)),
		crypto.subtle.digest("SHA-256", enc.encode(expected)),
	]);
	const x = new Uint8Array(a);
	const y = new Uint8Array(b);
	let diff = 0;
	for (let i = 0; i < x.length; i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

// ---------------------------------------------------------------------------------------------
// The webhook update
// ---------------------------------------------------------------------------------------------

export type StartUpdate = {
	/** The private chat's id, as a string (Telegram ids can pass 2^53 in future). */
	chatId: string;
	/** The `start` parameter: a code-shaped string, not yet checked against the store. */
	code: string;
	/** Telegram's guess at the sender's app language, for a reply when we don't know them yet. */
	languageCode: string | null;
};

const START = /^\/start(?:@[A-Za-z0-9_]+)?[ \t]+(\S+)\s*$/;

/**
 * The one update the webhook acts on: a private-chat `message.text` of `/start <code>`. Anything
 * else (groups, channels, edits, other text, a code of the wrong shape) is null.
 */
export function parseStartUpdate(update: unknown): StartUpdate | null {
	if (!update || typeof update !== "object") return null;
	const message = (update as { message?: unknown }).message;
	if (!message || typeof message !== "object") return null;
	const { text, chat, from } = message as {
		text?: unknown;
		chat?: unknown;
		from?: unknown;
	};
	if (typeof text !== "string" || !chat || typeof chat !== "object")
		return null;
	const { id, type } = chat as { id?: unknown; type?: unknown };
	if (type !== "private") return null;
	if (typeof id !== "number" && typeof id !== "string") return null;
	const chatId = String(id);
	if (!/^-?\d{1,20}$/.test(chatId)) return null;
	const match = START.exec(text);
	const code = match?.[1];
	if (!code || !isLinkCodeShape(code)) return null;
	const lang =
		from && typeof from === "object"
			? (from as { language_code?: unknown }).language_code
			: undefined;
	return { chatId, code, languageCode: typeof lang === "string" ? lang : null };
}

// ---------------------------------------------------------------------------------------------
// Replies the bot sends while linking (not nags: those are only the person's own words)
// ---------------------------------------------------------------------------------------------

export type LinkReplyKind = "linked" | "expired";

const LINK_REPLIES: Record<"en" | "he", Record<LinkReplyKind, string>> = {
	en: {
		linked:
			"Connected. Tempo can send your nags here, in your own words. To stop, open Settings, then Reminders, in Tempo.",
		expired:
			"This link has expired or was already used. In Tempo, open Settings, then Reminders, and press Connect again.",
	},
	he: {
		linked:
			"מחובר. Tempo יכול לשלוח לכאן את הנדנודים שלכם, במילים שלכם. כדי להפסיק, פותחים ב־Tempo את ההגדרות ואז תזכורות.",
		expired:
			"הקישור הזה פג או שכבר השתמשו בו. ב־Tempo פותחים את ההגדרות ואז תזכורות, ולוחצים שוב על חיבור.",
	},
};

export function linkReplyText(lang: "en" | "he", kind: LinkReplyKind): string {
	return LINK_REPLIES[lang][kind];
}

/** Hebrew when Telegram says the sender's app is in Hebrew; English otherwise. */
export function replyLangFromTelegram(
	languageCode: string | null,
): "en" | "he" {
	return languageCode && /^(he|iw)\b/i.test(languageCode) ? "he" : "en";
}

/**
 * A webhook response that makes Telegram call `sendMessage` for us (the Bot API's "reply in the
 * webhook answer"), so linking needs no second request and replies exactly once.
 */
export function webhookReplyBody(chatId: string, text: string): string {
	return JSON.stringify({ method: "sendMessage", chat_id: chatId, text });
}

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

export type TelegramFetch = (
	url: string,
	init: { method: "POST"; headers: Record<string, string>; body: string },
) => Promise<{ status: number }>;

/** The Bot API `sendMessage` request for `text` to `chatId`. Plain text, no parse mode. */
export function telegramSendRequest(
	token: string,
	chatId: string,
	text: string,
) {
	return {
		url: `${TELEGRAM_API_ORIGIN}/bot${token}/sendMessage`,
		init: {
			method: "POST" as const,
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text,
				disable_web_page_preview: true,
			}),
		},
	};
}

export type TelegramSendResult = SendResult | { ok: false; reason: "blocked" };

/**
 * The Telegram channel. `send` posts one `sendMessage`; 403 means the person blocked the bot
 * (`blocked`), any other failure is `send_failed`. Linking happens through the deep link and the
 * webhook, so `connect` can't connect anything by itself.
 */
export function telegramChannel(options: {
	token: string;
	fetch: TelegramFetch;
}): ReminderChannel & {
	send(to: string, text: string): Promise<TelegramSendResult>;
} {
	return {
		id: "telegram",
		label: "Telegram",
		kind: "messaging",
		connect: async () => ({ ok: false, reason: "not_connected" }),
		send: async (to, text) => {
			const words = text.trim();
			if (!words) return { ok: false, reason: "empty_text" };
			if (!to) return { ok: false, reason: "not_connected" };
			const { url, init } = telegramSendRequest(options.token, to, words);
			try {
				const response = await options.fetch(url, init);
				if (response.status >= 200 && response.status < 300)
					return { ok: true };
				if (response.status === 403) return { ok: false, reason: "blocked" };
				return { ok: false, reason: "send_failed" };
			} catch {
				return { ok: false, reason: "send_failed" };
			}
		},
	};
}
