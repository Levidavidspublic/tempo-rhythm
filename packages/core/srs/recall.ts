/**
 * Typed recall, kitchen T3: the person types what they remember before the card turns over, and
 * this module says in plain words how their answer compares with the back of the card.
 *
 * Pure functions. Both texts go through `normalizeAnswer` (`plugins.ts`, the same folding the
 * short-answer test questions use), so case, spacing, punctuation, quotes and Hebrew niqqud never
 * count as a difference. On top of that (`foldRecall`, here only, so test scoring is unchanged):
 * a minus sign or a dash counts as a hyphen, spaces around a sign (+ - × ÷ = < > ≤ ≥ ≠) don't
 * count, so "2x - 3" matches "2x-3", and Hebrew final letters count as their plain forms
 * (ך ם ן ף ץ as כ מ נ פ צ), so "ארצ" matches "ארץ". Then:
 * - `empty`: nothing was typed (only spaces). Not an error: the card turns over as usual.
 * - `matches`: the folded texts are the same.
 * - `different` when either answer has a digit and their numbers and signs, read in order
 *   (`numbersAndSigns`), are not exactly the same: "1945" is not almost "1954", nor "3.14" almost
 *   "3.15", nor "2x+3" almost "2x-3". The letters around the numbers may still be close.
 * - `close`: the edit distance between the folded texts is at most one per four characters of the
 *   longer one (`closeAllowance`), so answers of up to 3 characters must match exactly, 4 to 7 may
 *   be one letter off, 8 to 11 two, and so on. An edit is one letter added, removed or changed, or
 *   two neighbouring letters swapped (`editDistance`). Characters are Unicode code points.
 * - `different`: anything else.
 *
 * Known limit: opposite words that differ only by a prefix (increase / decrease, endothermic /
 * exothermic, hypertonic / hypotonic) are a letter or two apart and can read as close. There is
 * no cheap fix (it would take a list of words per subject and language), and the person sees the
 * back of the card and picks the grade themselves.
 *
 * The result is a hint only. The person still picks Again / Hard / Good / Easy; `suggestedButton`
 * names the one a screen may mark as "suggested" (EXTRAPOLATED: matches → Good, close → Hard,
 * different → Again, nothing typed → none, never Easy).
 */

import { normalizeAnswer } from "./plugins";
import type { ReviewButton } from "./sm2";

export type RecallResult = "matches" | "close" | "different" | "empty";

export type RecallComparison = {
	result: RecallResult;
	/**
	 * Edits between the folded texts; 0 for a match, -1 when not measured (empty, too far apart,
	 * or the numbers and signs differ).
	 */
	distance: number;
	/** The most edits that still count as close for these lengths. */
	allowed: number;
};

/** Characters per allowed edit: one edit for every four characters of the longer answer. */
export const CHARS_PER_EDIT = 4;

/** The edits allowed for "close" when the longer folded answer has `length` characters. */
export function closeAllowance(length: number): number {
	return Math.max(0, Math.floor(length / CHARS_PER_EDIT));
}

/**
 * Optimal string alignment distance between two strings, by code point: insertions, deletions,
 * substitutions and swaps of two neighbouring characters each cost 1.
 */
export function editDistance(a: string, b: string): number {
	const x = Array.from(a);
	const y = Array.from(b);
	if (x.length === 0) return y.length;
	if (y.length === 0) return x.length;
	let before: number[] = [];
	let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
	for (let i = 1; i <= x.length; i += 1) {
		const current = [i];
		for (let j = 1; j <= y.length; j += 1) {
			const cost = x[i - 1] === y[j - 1] ? 0 : 1;
			let best = Math.min(
				(previous[j] as number) + 1,
				(current[j - 1] as number) + 1,
				(previous[j - 1] as number) + cost,
			);
			if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1])
				best = Math.min(best, (before[j - 2] as number) + 1);
			current.push(best);
		}
		before = previous;
		previous = current;
	}
	return previous[y.length] as number;
}

/** Dashes and the minus sign (U+2010 to U+2015, U+2212), read as a hyphen. */
const DASHES = /[\u2010-\u2015\u2212]/g;
/** A sign and the spaces around it. */
const SPACED_SIGN = /\s*([+\-×÷=<>≤≥≠])\s*/g;
/** Hebrew final letters and their plain forms. */
const FINAL_LETTERS: Readonly<Record<string, string>> = {
	ך: "כ",
	ם: "מ",
	ן: "נ",
	ף: "פ",
	ץ: "צ",
};
/** A number run ("1945", "3.14", "1/2", "10:30") or a sign. */
const NUMBER_OR_SIGN = /\d+(?:[.,/:]\d+)*|[+\-×÷=<>≤≥≠]/g;

/**
 * `normalizeAnswer`, plus the recall-only folds in the module comment. The spaces around signs go
 * before `normalizeAnswer` (which keeps a hyphen only right before a digit) and again after it
 * (punctuation it turned into spaces, as in "(2x)+3").
 */
function foldRecall(text: string): string {
	const signs = text.replace(DASHES, "-").replace(SPACED_SIGN, "$1");
	return normalizeAnswer(signs)
		.replace(SPACED_SIGN, "$1")
		.replace(/[ךםןףץ]/g, (letter) => FINAL_LETTERS[letter] ?? letter);
}

/** A folded answer's numbers and signs in order, e.g. "2x+3=11" → "2 + 3 = 11". */
function numbersAndSigns(folded: string): string {
	return (folded.match(NUMBER_OR_SIGN) ?? []).join(" ");
}

/** How a typed answer compares with the expected one (the rule is in the module comment). */
export function compareRecall(
	typed: string,
	expected: string,
): RecallComparison {
	if (typed.trim() === "") return { result: "empty", distance: -1, allowed: 0 };
	const given = foldRecall(typed);
	const target = foldRecall(expected);
	if (given === target) return { result: "matches", distance: 0, allowed: 0 };
	const givenLength = Array.from(given).length;
	const targetLength = Array.from(target).length;
	const allowed = closeAllowance(Math.max(givenLength, targetLength));
	// Too far apart in length to be close, or numbers and signs that differ: skip the full table.
	if (
		givenLength === 0 ||
		targetLength === 0 ||
		Math.abs(givenLength - targetLength) > allowed ||
		(/\d/.test(given + target) &&
			numbersAndSigns(given) !== numbersAndSigns(target))
	)
		return { result: "different", distance: -1, allowed };
	const distance = editDistance(given, target);
	return {
		result: distance <= allowed ? "close" : "different",
		distance,
		allowed,
	};
}

/** The grade a screen may mark as suggested for a result, or null. Never chooses for the person. */
export function suggestedButton(result: RecallResult): ReviewButton | null {
	if (result === "matches") return "good";
	if (result === "close") return "hard";
	if (result === "different") return "again";
	return null;
}
