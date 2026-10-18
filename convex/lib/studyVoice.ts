import {
	buildRecap,
	fullReading,
	pageLang,
	type RecapLang,
	type RecapSentence,
} from "../../packages/core/recap";
import { speechSentences } from "./voicePolicy";

/**
 * What study read-aloud sends to Tempo's voice, one piece at a time (docs/contracts/VOICE.md A-10).
 * Pure and shared: the server resolves piece `index` of a page from the page alone, and the
 * player (apps/web/components/study/recap) builds the same list from the same page, so a piece
 * index means the same words on both sides and the client never sends text.
 *
 * The reading is the recap (or the whole page) that `packages/core/recap` builds; each of its
 * sentences is split again with `speechSentences`, so no request is over `maxSentenceChars`.
 */

export type StudyVoiceMode = "recap" | "full";

/** One request's worth of words, and which reading sentence (transcript line) it belongs to. */
export type SpeechPiece = { text: string; at: number };

/** The page's reading: its language and its sentences, as the player shows them. */
export function pageReading(
	markdown: string,
	mode: StudyVoiceMode,
): { lang: RecapLang; sentences: RecapSentence[] } {
	const lang = pageLang(markdown);
	const sentences =
		mode === "full"
			? fullReading(markdown, { lang })
			: buildRecap(markdown, { lang });
	return { lang, sentences };
}

/** The reading's sentences as the pieces sent to TTS, in order. */
export function speechPieces(
	sentences: readonly { text: string }[],
): SpeechPiece[] {
	return sentences.flatMap((sentence, at) =>
		speechSentences(sentence.text).map((text) => ({ text, at })),
	);
}
