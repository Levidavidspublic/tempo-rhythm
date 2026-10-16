import { COACH_LIMITS, type CoachProposal, truncate } from "./coachPrompt";

/**
 * The coach never offers a task that is already open on Today (TEMPO-B07-29, #1031). In a demo, a
 * task card proposed a task the person already had for the day. `coach.reply` checks the first
 * answer's card against the day's open tasks; a task card that matches one is dropped, and the
 * reply gets one fixed line saying so. Decision, page and template cards always pass. Pure, so it is
 * tested without a model or a db (coachProposalGuard.test.ts).
 */

/** Most of the day's open tasks one coach turn checks a task card against. */
export const MAX_OPEN_TASKS_CHECKED = 200;

/** The line added to a reply whose task card was dropped, in the person's app language. */
export const ALREADY_ON_TODAY_NOTE = {
  en: "(That task is already on Today, so there's nothing new to add.)",
  he: "(המשימה הזו כבר מופיעה בהיום, אז אין מה להוסיף.)",
} as const;

// Hebrew niqqud and cantillation marks (U+0591 to U+05C7). The punctuation in that range (maqaf,
// paseq, sof pasuq, nun hafukha) is not listed: it goes with the rest of the punctuation.
const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
// What an emoji carries besides its symbol: variation selectors and the keycap mark.
const EMOJI_MARKS = /[\uFE00-\uFE0F\u20E3\u{E0100}-\u{E01EF}]/gu;
// Anything that isn't a letter, a digit or a mark on a letter: spaces, punctuation, symbols, emoji.
const NOT_WORD = /[^\p{L}\p{N}\p{M}]/gu;

/**
 * A title as the guard compares it: case, spaces, punctuation, emoji and Hebrew niqqud set aside.
 * "Call Mom! 📞" and "call mom" are the same; "לְהִתְקַשֵּׁר" and "להתקשר" too. Empty when the
 * title has no letters or digits.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(HEBREW_MARKS, "")
    .replace(EMOJI_MARKS, "")
    .replace(NOT_WORD, "");
}

/** A title as a task card carries it (`readProposal`): one line, at most `COACH_LIMITS.titleChars`. */
export function cardTitle(title: string): string {
  return truncate(title.trim().replace(/\s+/g, " "), COACH_LIMITS.titleChars);
}

/**
 * The open task a task card would make again: the first of `openTasks` (at most
 * `MAX_OPEN_TASKS_CHECKED`) whose title is the card's once both go through `normalizeTitle`. Null
 * for any other card, for a title with no letters or digits, and when none matches. Which tasks are
 * open and due today is the caller's to say.
 */
export function duplicateOfOpenTask<T extends { title: string }>(
  proposal: CoachProposal | null,
  openTasks: readonly T[]
): T | null {
  if (proposal?.kind !== "task") return null;
  const key = normalizeTitle(proposal.title);
  if (!key) return null;
  const checked = openTasks.slice(0, MAX_OPEN_TASKS_CHECKED);
  return checked.find((task) => normalizeTitle(cardTitle(task.title)) === key) ?? null;
}
