/** The longest Telegram first name kept on a link, in characters (code points). */
export const TELEGRAM_FIRST_NAME_MAX = 64;

/**
 * The sender's Telegram display first name from a `/start` update (`message.from.first_name`),
 * trimmed and cut to TELEGRAM_FIRST_NAME_MAX characters, or null when there is none. Settings
 * shows it on the Connected row so a person can see which chat pressed Start (a leaked code shows
 * up as someone else's name). Personal data: kept only on the person's own link row, never logged.
 */
export function telegramFirstName(update: unknown): string | null {
	if (!update || typeof update !== "object") return null;
	const message = (update as { message?: unknown }).message;
	if (!message || typeof message !== "object") return null;
	const from = (message as { from?: unknown }).from;
	if (!from || typeof from !== "object") return null;
	const raw = (from as { first_name?: unknown }).first_name;
	if (typeof raw !== "string") return null;
	const name = Array.from(raw.trim())
		.slice(0, TELEGRAM_FIRST_NAME_MAX)
		.join("")
		.trim();
	return name.length > 0 ? name : null;
}
