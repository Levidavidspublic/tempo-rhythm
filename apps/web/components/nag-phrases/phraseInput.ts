export type PhraseStatus = "accepted" | "proposed" | "rejected";

export type PhraseCheck = { ok: true; text: string } | { ok: false; message: string };

const MAX_PHRASE_LENGTH = 140;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Trim, then reject empty, over-long, or emoji phrases. */
export function validatePhraseText(text: string): PhraseCheck {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: "Write a phrase in your own words." };
  }
  if (trimmed.length > MAX_PHRASE_LENGTH) {
    return { ok: false, message: "Keep it under 140 characters." };
  }
  if (EMOJI.test(trimmed)) {
    return { ok: false, message: "No emoji in nags." };
  }
  return { ok: true, text: trimmed };
}

export type NagEditorLocal<T> = {
  draft: string;
  error: string | null;
  suggestions: T[];
};

const OWN_WORDS_HINT = "Add a phrase of your own first so suggestions can come from your words.";

/**
 * Local draft and unsaved suggestions belong to one nag.
 * A reused editor gets a blank slate for the next nag.
 */
export function localForNag<T>(
  activeNagId: string,
  nagId: string,
  local: NagEditorLocal<T>
): NagEditorLocal<T> {
  if (activeNagId === nagId) return local;
  return { draft: "", error: null, suggestions: [] };
}

/** An in-flight suggest or save applies only while the editor is still on that nag. */
export function isCurrentNagRequest(requestNagId: string, activeNagId: string): boolean {
  return requestNagId === activeNagId;
}

/**
 * The own-words hint is for a nag that has no accepted user phrase yet.
 * A finished suggest cycle that cleared the cards is not that case.
 */
export function suggestSectionMessage(
  hasOwnWords: boolean,
  suggestionCount: number
): string | null {
  if (hasOwnWords || suggestionCount > 0) return null;
  return OWN_WORDS_HINT;
}

/** Group phrases by status. Unknown statuses are left out. */
export function splitByStatus<T extends { status: PhraseStatus }>(phrases: readonly T[]) {
  const accepted: T[] = [];
  const proposed: T[] = [];
  const rejected: T[] = [];
  for (const phrase of phrases) {
    if (phrase.status === "accepted") {
      accepted.push(phrase);
    } else if (phrase.status === "proposed") {
      proposed.push(phrase);
    } else if (phrase.status === "rejected") {
      rejected.push(phrase);
    }
  }
  return { accepted, proposed, rejected };
}
