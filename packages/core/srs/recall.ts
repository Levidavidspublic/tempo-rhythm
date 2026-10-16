/**
 * Typed recall, kitchen T3: the person types what they remember before the card turns over, and
 * this module says in plain words how their answer compares with the back of the card.
 *
 * Pure functions. Both texts go through `normalizeAnswer` (`plugins.ts`, the same folding the
 * short-answer test questions use), so case, spacing, punctuation, quotes and Hebrew niqqud never
 * count as a difference. Then:
 * - `empty`: nothing was typed (only spaces). Not an error: the card turns over as usual.
 * - `matches`: the folded texts are the same.
 * - `close`: the edit distance between the folded texts is at most one per four characters of the
 *   longer one (`closeAllowance`), so answers of up to 3 characters must match exactly, 4 to 7 may
 *   be one letter off, 8 to 11 two, and so on. An edit is one letter added, removed or changed, or
 *   two neighbouring letters swapped (`editDistance`). Characters are Unicode code points.
 * - `different`: anything else.
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
	/** Edits between the folded texts; 0 for a match, -1 when not measured (empty, or too far apart). */
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

/** How a typed answer compares with the expected one (the rule is in the module comment). */
export function compareRecall(
	typed: string,
	expected: string,
): RecallComparison {
	if (typed.trim() === "") return { result: "empty", distance: -1, allowed: 0 };
	const given = normalizeAnswer(typed);
	const target = normalizeAnswer(expected);
	if (given === target) return { result: "matches", distance: 0, allowed: 0 };
	const givenLength = Array.from(given).length;
	const targetLength = Array.from(target).length;
	const allowed = closeAllowance(Math.max(givenLength, targetLength));
	// Too far apart in length to be close: skip the full table.
	if (
		givenLength === 0 ||
		targetLength === 0 ||
		Math.abs(givenLength - targetLength) > allowed
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
