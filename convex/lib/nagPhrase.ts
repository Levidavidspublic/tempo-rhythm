export const NAG_PHRASE_MAX = 140;

const EMOJI = /\p{Extended_Pictographic}/u;

export type PhraseCheck = { ok: true; text: string } | { ok: false; message: string };

/** Nag phrases are the user's own words: 1-140 chars after trim, no emoji. */
export function validatePhrase(text: string): PhraseCheck {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, message: "Write a phrase first." };
  }
  if (trimmed.length > NAG_PHRASE_MAX) {
    return { ok: false, message: `Keep the phrase to ${NAG_PHRASE_MAX} characters or fewer.` };
  }
  if (EMOJI.test(trimmed)) {
    return { ok: false, message: "Phrases are plain words, no emoji." };
  }
  return { ok: true, text: trimmed };
}

/** Parse model output into at most 3 valid, distinct proposals. Never throws. */
export function parseProposals(content: string, existing: string[] = []): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return [];
  }
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { proposals?: unknown }).proposals)
      ? (raw as { proposals: unknown[] }).proposals
      : [];
  const seen = new Set(existing.map((e) => e.toLowerCase()));
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      continue;
    }
    const check = validatePhrase(item);
    if (!check.ok || seen.has(check.text.toLowerCase())) {
      continue;
    }
    seen.add(check.text.toLowerCase());
    out.push(check.text);
    if (out.length === 3) {
      break;
    }
  }
  return out;
}
