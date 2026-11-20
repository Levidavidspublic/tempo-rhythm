import {
  NagDocError,
  parseNagDoc,
  type NagDoc,
  type NagPhrase,
} from "../firestore-docs/nag-doc";

export type NagPhrasePlan =
  | {
      kind: "patch";
      patch: { phrases: NagPhrase[]; updatedAt: number };
      fields: string[];
    }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

function validatedPatch(
  stored: NagDoc,
  phrases: NagPhrase[],
  now: number
): NagPhrasePlan {
  const patch = { phrases, updatedAt: now };

  try {
    parseNagDoc({ ...stored, ...patch });
  } catch (error) {
    if (error instanceof NagDocError) {
      return { kind: "refused", reason: error.message };
    }
    return { kind: "refused", reason: "nag could not be validated" };
  }

  return { kind: "patch", patch, fields: ["phrases", "updatedAt"] };
}

export function planAddNagPhrase(
  stored: NagDoc,
  input: { id: string; text: string },
  now: number
): NagPhrasePlan {
  if (stored.deletedAt !== undefined) {
    return { kind: "refused", reason: "nag is deleted" };
  }

  const text = input.text.trim().replace(/\s+/g, " ");
  if (text.length === 0) {
    return { kind: "refused", reason: "phrase is empty" };
  }
  if (stored.phrases.some((phrase) => phrase.text.toLowerCase() === text.toLowerCase())) {
    return { kind: "refused", reason: "phrase already exists" };
  }
  if (stored.phrases.some((phrase) => phrase.id === input.id)) {
    return { kind: "refused", reason: "phrase id already exists" };
  }

  return validatedPatch(
    stored,
    [...stored.phrases, { id: input.id, text, source: "user", status: "accepted" }],
    now
  );
}

export function planDecideNagPhrase(
  stored: NagDoc,
  phraseId: string,
  decision: "accepted" | "rejected",
  now: number
): NagPhrasePlan {
  if (stored.deletedAt !== undefined) {
    return { kind: "refused", reason: "nag is deleted" };
  }

  const phrase = stored.phrases.find((candidate) => candidate.id === phraseId);
  if (!phrase) {
    return { kind: "refused", reason: "phrase not found" };
  }
  if (phrase.status === decision) {
    return { kind: "unchanged" };
  }

  const phrases = stored.phrases.map((candidate) =>
    candidate.id === phraseId ? { ...candidate, status: decision } : candidate
  );
  return validatedPatch(stored, phrases, now);
}
