/**
 * Local task suggestions from a meeting or lecture transcript (kitchen T8, S7 RecordSession).
 *
 * The fallback when the runtime model isn't available: a line that sounds like a commitment
 * ("I'll…", "we need to…", "let's…", "TODO", "by Friday", and Hebrew equivalents such as
 * "צריך ל", "אני אעשה", "עד יום") becomes a suggestion, with the line it came from. Pure and
 * deterministic; nothing here is saved. The person accepts, edits or rejects each one.
 */

export type RecordLang = "en" | "he";

export type ActionSuggestion = {
  /** A short task title, cut from the line. */
  title: string;
  /** The line it came from, as said. */
  source: string;
  /** Index of the line in the transcript's lines (0-based). */
  line: number;
};

export const EXTRACT_MAX_SUGGESTIONS = 20;
export const EXTRACT_TITLE_MAX = 120;

const EN_DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|next week|end of (?:the )?(?:day|week|month)|eod|eow";

/** Leading phrases dropped from the title (the commitment itself stays). */
const EN_LEADS: RegExp[] = [
  /^(?:ok(?:ay)?|so|and|also|then|right|alright)[,\s]+/i,
  /^(?:todo|to-do|to do|action item|action|next step)s?\s*[:\-–]\s*/i,
  /^(?:i|we)\s*(?:'ll|’ll| will| am going to|'m going to|’m going to| are going to|'re going to|’re going to)\s+/i,
  /^(?:i|we|you)\s+(?:need|have|has|got)\s+to\s+/i,
  /^(?:we|you)\s+should\s+/i,
  /^let(?:'s|’s| us)\s+/i,
  /^(?:someone|somebody)\s+(?:needs|has)\s+to\s+/i,
  /^(?:don't|don’t|do not)\s+forget\s+to\s+/i,
  /^remember\s+to\s+/i,
];

const EN_TRIGGERS: RegExp[] = [
  /\b(?:i|we)\s*(?:'ll|’ll| will| am going to|'m going to|’m going to| are going to|'re going to|’re going to)\s+\w/i,
  /\b(?:i|we|you)\s+(?:need|have|has|got)\s+to\s+\w/i,
  /\b(?:we|you)\s+should\s+\w/i,
  /\blet(?:'s|’s| us)\s+\w/i,
  /\b(?:todo|to-do|action item|next step)s?\b/i,
  /\b(?:don't|don’t|do not)\s+forget\s+to\b/i,
  /\bremember\s+to\b/i,
  new RegExp(`\\b(?:by|before|until|due)\\s+(?:${EN_DAYS})\\b`, "i"),
];

const HE_LEADS: RegExp[] = [
  /^(?:אז|וגם|גם|טוב|אוקיי)[,\s]+/,
  /^(?:משימה|לעשות|TODO)\s*[:\-–]\s*/i,
  /^(?:אנחנו\s+)?(?:צריך|צריכה|צריכים|צריכות)\s+/,
  /^(?:אני|אנחנו)\s+(?:אעשה|נעשה)\s+(?:את\s+)?/,
  /^(?:אני|אנחנו)\s+/,
  /^(?:בואו|בוא|בואי)\s+/,
  /^(?:לא\s+לשכוח|לזכור)\s+/,
];

const HE_TRIGGERS: RegExp[] = [
  /(?:^|\s)(?:צריך|צריכה|צריכים|צריכות)\s+ל/,
  /(?:^|\s)(?:אני|אנחנו)\s+(?:אעשה|נעשה|אשלח|נשלח|אכין|נכין|אבדוק|נבדוק|אדבר|נדבר|אקבע|נקבע)/,
  /(?:^|\s)(?:בואו|בוא|בואי)\s+נ/,
  /(?:^|\s)עד\s+(?:יום|מחר|סוף|השבוע|ה?\d)/,
  /(?:^|\s)(?:משימה|לא\s+לשכוח|לזכור\s+ל)/,
  /\bTODO\b/i,
];

/** Lines (and sentences inside long lines) of a transcript, trimmed, in order. */
export function transcriptLines(transcript: string): string[] {
  const out: string[] = [];
  for (const raw of transcript.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|\[[0-9:]+\]\s*)/, "").replace(/\s+/g, " ").trim();
    if (!line) continue;
    const sentences = line.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g) ?? [line];
    for (const sentence of sentences) {
      const text = sentence.trim();
      if (text) out.push(text);
    }
  }
  return out;
}

function titleFrom(sentence: string, lang: RecordLang): string {
  let text = sentence.replace(/[.!?。！？]+$/, "").trim();
  const leads = lang === "he" ? [...HE_LEADS, ...EN_LEADS] : EN_LEADS;
  // Leads can stack ("Okay, so I'll…"): drop them until none matches.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = text;
    for (const lead of leads) text = text.replace(lead, "");
    if (text === before) break;
  }
  text = text.trim();
  if (!text) text = sentence.trim();
  if (lang === "en" && /^[a-z]/.test(text)) text = text[0]?.toUpperCase() + text.slice(1);
  if (text.length > EXTRACT_TITLE_MAX) {
    const cut = text.slice(0, EXTRACT_TITLE_MAX);
    const space = cut.lastIndexOf(" ");
    text = `${(space > EXTRACT_TITLE_MAX / 2 ? cut.slice(0, space) : cut).trim()}…`;
  }
  return text;
}

function isAction(sentence: string, lang: RecordLang): boolean {
  const triggers = lang === "he" ? [...HE_TRIGGERS, ...EN_TRIGGERS] : EN_TRIGGERS;
  return triggers.some((trigger) => trigger.test(sentence));
}

/**
 * Task suggestions from a transcript: one per line that sounds like a commitment, in order,
 * without repeats, at most `EXTRACT_MAX_SUGGESTIONS`.
 */
export function extractActions(transcript: string, lang: RecordLang): ActionSuggestion[] {
  const out: ActionSuggestion[] = [];
  const seen = new Set<string>();
  const lines = transcriptLines(transcript);
  for (const [index, sentence] of lines.entries()) {
    if (out.length >= EXTRACT_MAX_SUGGESTIONS) break;
    if (sentence.replace(/[^\p{L}\p{N}]/gu, "").length < 4) continue;
    if (!isAction(sentence, lang)) continue;
    const title = titleFrom(sentence, lang);
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, source: sentence, line: index });
  }
  return out;
}
