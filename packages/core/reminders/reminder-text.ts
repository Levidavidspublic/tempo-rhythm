/**
 * The words a reminder sends (PRD F-60): only a phrase the person wrote or accepted. There is no
 * stock copy to fall back on and no emoji is ever added, so anything else gives null.
 */

export type ReminderPhrase = {
	id: string;
	text: string;
	source: "user" | "derived";
	status: "proposed" | "accepted" | "rejected";
};

export type ReminderNag = { phrases: readonly ReminderPhrase[] };

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/** The accepted phrase `phraseId` as it will be sent, or null when there is none to send. */
export function reminderText(
	nag: ReminderNag,
	phraseId: string,
): string | null {
	const phrase = nag.phrases.find((p) => p.id === phraseId);
	if (!phrase || phrase.status !== "accepted") return null;
	const text = phrase.text.trim();
	if (!text) return null;
	// Phrases are checked when they are added; this keeps an emoji from ever going out anyway.
	if (PICTOGRAPHIC.test(text)) return null;
	return text;
}
