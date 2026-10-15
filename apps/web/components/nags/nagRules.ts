export type NagPhraseLike = { status: "proposed" | "accepted" | "rejected" };
export type NagLike = { phrases: NagPhraseLike[] };

export const LABEL_MAX = 60;
export const ENABLE_HINT = "Add a phrase in your own words to switch this on.";

export function acceptedPhrases<T extends NagPhraseLike>(nag: { phrases: T[] }): T[] {
  return nag.phrases.filter((phrase) => phrase.status === "accepted");
}

export function canEnable(nag: NagLike): boolean {
  return acceptedPhrases(nag).length >= 1;
}

export function enableHint(nag: NagLike): string | null {
  return canEnable(nag) ? null : ENABLE_HINT;
}

export type LabelResult = { ok: true; label: string } | { ok: false; error: string };

export function validateLabel(label: string): LabelResult {
  const trimmed = label.trim();
  if (trimmed.length === 0) return { ok: false, error: "Give the nag a name." };
  if ([...trimmed].length > LABEL_MAX) {
    return { ok: false, error: `Keep the name to ${LABEL_MAX} characters or fewer.` };
  }
  if (/\p{Extended_Pictographic}/u.test(trimmed)) {
    return { ok: false, error: "Use words only, no emoji." };
  }
  return { ok: true, label: trimmed };
}
