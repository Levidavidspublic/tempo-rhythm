/**
 * Nags (docs/design/v3/screens/web/nags.html): checks that match the server's
 * (convex/lib/nagPhrase.ts, convex/nags.ts), as codes the screen can translate.
 */
import { NAG_PHRASE_MAX } from "../../../../convex/lib/nagPhrase";

export type WordsProblem = "empty" | "long" | "emoji";

export const NAG_LABEL_MAX = 60;
const EMOJI = /\p{Extended_Pictographic}/u;

function checkWords(
  text: string,
  max: number
): { ok: true; text: string } | { ok: false; problem: WordsProblem } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, problem: "empty" };
  if (trimmed.length > max) return { ok: false, problem: "long" };
  if (EMOJI.test(trimmed)) return { ok: false, problem: "emoji" };
  return { ok: true, text: trimmed };
}

export function checkPhrase(text: string) {
  return checkWords(text, NAG_PHRASE_MAX);
}

export function checkNagLabel(text: string) {
  return checkWords(text, NAG_LABEL_MAX);
}

export type PhraseLike = { id: string; status: "proposed" | "accepted" | "rejected" };

/** Accepted and suggested phrases, in the order they were added; rejected ones stay hidden. */
export function shownPhrases<T extends PhraseLike>(phrases: readonly T[]): T[] {
  return phrases.filter((phrase) => phrase.status !== "rejected");
}

export function nagCounts(nags: readonly { enabled: boolean }[]): { total: number; on: number } {
  return { total: nags.length, on: nags.filter((nag) => nag.enabled).length };
}

type NagLike = { enabled: boolean; phrases: readonly PhraseLike[] };

const acceptedBesides = (nag: NagLike, phraseId: string) =>
  nag.phrases.some((phrase) => phrase.status === "accepted" && phrase.id !== phraseId);

/**
 * Whether Undo of a phrase removal switches the nag back on. Only when the removal is what
 * switched it off (it was on and that was its last accepted phrase, so the server turned it
 * off), and only while it still has no other accepted phrase: until then nobody could have
 * switched it on or off, so nothing the person chose since is overridden.
 */
export function undoTurnsBackOn(
  atRemoval: NagLike,
  now: NagLike | undefined,
  phraseId: string
): boolean {
  if (!atRemoval.enabled || acceptedBesides(atRemoval, phraseId)) return false;
  return now !== undefined && !now.enabled && !acceptedBesides(now, phraseId);
}
