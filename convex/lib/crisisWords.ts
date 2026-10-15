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

export function isCrisisText(text: string): boolean {
  const t = normalise(text);
  if (!t) {
    return false;
  }
  return CRISIS_PHRASES.some((phrase) => t.includes(phrase));
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
