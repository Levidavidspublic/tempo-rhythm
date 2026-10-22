/**
 * Fixed crisis word list (PRD §6: crisis words return a fixed resources card, no model).
 * Lower-case words and phrases. Matching is by substring on normalised text.
 */
export const CRISIS_PHRASES: readonly string[] = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my own life",
  "want to die",
  "wanna die",
  "better off dead",
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "hurt myself",
  "hurting myself",
  "cut myself",
  "no reason to live",
  "don't want to be alive",
  "dont want to be alive",
  "don't want to live",
  "dont want to live",
];

function normalise(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Machine-drafted candidates, NOT a clinically reviewed lexicon. No production caller
 * enables these. See docs/research/hebrew-crisis-phrases.md for source-access limits,
 * false positives/negatives and the owner review required before live activation.
 */
export const HEBREW_CRISIS_CANDIDATES: readonly string[] = [
  "רוצה למות",
  "רוצים למות",
  "רוצות למות",
  "רוצה להתאבד",
  "רוצים להתאבד",
  "רוצות להתאבד",
  "חושב על התאבדות",
  "חושבת על התאבדות",
  "חושבים על התאבדות",
  "חושבות על התאבדות",
  "מתכוון להתאבד",
  "מתכוונת להתאבד",
  "מתכוונים להתאבד",
  "מתכוונות להתאבד",
  "להרוג את עצמי",
  "לפגוע בעצמי",
  "לחתוך את עצמי",
  "אין לי סיבה לחיות",
  "לא רוצה לחיות",
  "לא רוצים לחיות",
  "לא רוצות לחיות",
  "לשים קץ לחיי",
];

export type CrisisTextOptions = {
  /** OFF unless a reviewed caller explicitly opts in; this is not a public endpoint flag. */
  hebrewEnabled?: boolean;
};

function normaliseHebrew(text: string): string {
  return text
    .normalize("NFKD")
    // Hebrew accents/vowel points, excluding punctuation such as the maqaf separator.
    .replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g, "")
    .replace(/\p{Cf}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function isCrisisText(text: string, options: CrisisTextOptions = {}): boolean {
  const t = normalise(text);
  if (!t) {
    return false;
  }
  if (CRISIS_PHRASES.some((phrase) => t.includes(phrase))) return true;
  if (options.hebrewEnabled !== true) return false;
  // Whole tokens avoid matching a candidate inside a longer unrelated word. This
  // intentionally makes no claim to resolve negation, quoted speech or other context.
  const hebrew = ` ${normaliseHebrew(text)} `;
  return HEBREW_CRISIS_CANDIDATES.some((phrase) => hebrew.includes(` ${phrase} `));
}

export type CrisisCard = {
  title: string;
  body: string;
  resources: { label: string; detail: string }[];
};

/** Fixed card. Generic: country-specific numbers are not set up yet (PRD §6 UNKNOWN). */
export const CRISIS_CARD: CrisisCard = {
  title: "You are not alone, and help is available",
  body: "What you wrote matters. If you might act on these thoughts or you are in danger, please contact your local emergency number now. Country-specific helpline numbers are not set up in Tempo yet, so this card cannot show one for your location.",
  resources: [
    {
      label: "Emergency services",
      detail: "Call your local emergency number if you are in immediate danger.",
    },
    {
      label: "A crisis line near you",
      detail: "Search for a suicide or crisis helpline in your country and call or text them.",
    },
    {
      label: "Someone you trust",
      detail: "Tell a friend, family member or doctor how you feel. You do not have to wait for a good moment.",
    },
  ],
};

/** The card as plain text, stored as the assistant message on a crisis reply. */
export function crisisCardText(card: CrisisCard = CRISIS_CARD): string {
  const lines = card.resources.map((r) => `- ${r.label}: ${r.detail}`);
  return `${card.title}\n\n${card.body}\n\n${lines.join("\n")}`;
}
