/**
 * Local task suggestions from a meeting or lecture transcript (kitchen T8, S7 RecordSession).
 *
 * The fallback when the runtime model isn't available: a line that sounds like the speaker's own
 * commitment ("I'll…", "TODO", "remember to…", "don't forget", a deadline such as "by Friday",
 * and Hebrew equivalents such as "אני אעשה", "לא לשכוח", "עד יום") becomes a suggestion, with the
 * line it came from. We / you forms ("we will…", "you need to…", "let's…", "צריך ל", "בואו נ")
 * are how a lecture talks, so they count only when the same sentence has a deadline. Pure and
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

const EN_MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/**
 * A deadline: by / before / until / due + a day, a date or a time ("by Friday", "due next week",
 * "before the 12th", "until 3pm", "by 10/12").
 */
const EN_DEADLINE = new RegExp(
  `\\b(?:by|before|until|till|due)\\s+(?:(?:on|the|this|next|at)\\s+)*(?:${EN_DAYS}|week|month|noon|midnight|\\d{1,2}(?:st|nd|rd|th)\\b(?!\\s+centur)|\\d{1,2}[/.]\\d{1,2}\\b|\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b|\\d{1,2}:\\d{2}\\b|(?:${EN_MONTHS})\\b)`,
  "i",
);

/**
 * Commitments that stand on their own: the speaker's own "I'll / I will / I'm going to / I need
 * to", "TODO", "remember to", "don't forget", and a deadline line ("Report goes out by Friday").
 */
const EN_TRIGGERS: RegExp[] = [
  /\bi\s*(?:'ll|’ll| will| am going to|'m going to|’m going to)\s+\w/i,
  /\bi\s+(?:need|have|got)\s+to\s+\w/i,
  /\b(?:todo|to-do|action item|next step)s?\b/i,
  /\b(?:don't|don’t|do not)\s+forget\s+(?:to\b|that\b|about\b)/i,
  /\bremember\s+to\b/i,
  EN_DEADLINE,
];

/**
 * We / you forms ("we will…", "we're going to…", "you need to…", "we should…", "let's…") are how
 * a lecture talks, so they count only when the same sentence carries a deadline.
 */
const EN_SOFT_TRIGGERS: RegExp[] = [
  /\b(?:we|you)\s*(?:'ll|’ll| will| are going to|'re going to|’re going to)\s+\w/i,
  /\b(?:we|you)\s+(?:need|have|got)\s+to\s+\w/i,
  /\b(?:we|you)\s+should\s+\w/i,
  /\blet(?:'s|’s| us)\s+\w/i,
  /\b(?:someone|somebody)\s+(?:needs|has)\s+to\s+\w/i,
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

/** Hebrew deadline: עד / לפני + a day ("עד יום חמישי", "עד מחר", "לפני סוף השבוע", "עד ה־12"). */
const HE_DEADLINE = /(?:^|\s)(?:(?:עד|לפני)\s+(?:יום|מחר|סוף|השבוע)|עד\s+ה?[־-]?\d{1,2}(?![\d,]|\.\d))/;

/** Hebrew commitments that stand on their own: first person singular, "לא לשכוח", "לזכור ל", TODO. */
const HE_TRIGGERS: RegExp[] = [
  /(?:^|\s)אני\s+(?:אעשה|אשלח|אכין|אבדוק|אדבר|אקבע|אכתוב|אסיים|אתקשר)/,
  /(?:^|\s)אני\s+(?:צריך|צריכה)\s+ל/,
  /(?:^|\s)(?:משימה|לא\s+לשכוח|אל\s+תשכחו|לזכור\s+ל)/,
  /\bTODO\b/i,
  HE_DEADLINE,
];

/** Hebrew we / you / impersonal forms: they count only with a deadline in the same sentence. */
const HE_SOFT_TRIGGERS: RegExp[] = [
  /(?:^|\s)(?:צריך|צריכה|צריכים|צריכות)\s+ל/,
  /(?:^|\s)(?:אתם|אתן|אנחנו)\s+(?:חייבים|חייבות|צריכים|צריכות)\s+ל/,
  /(?:^|\s)אנחנו\s+(?:נעשה|נשלח|נכין|נבדוק|נדבר|נקבע|נכתוב|נלמד|נעבור|נראה)/,
  /(?:^|\s)(?:בואו|בוא|בואי)\s+נ/,
  /(?:^|\s)(?:כדאי|מומלץ)\s+ל/,
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
  if (triggers.some((trigger) => trigger.test(sentence))) return true;
  const soft = lang === "he" ? [...HE_SOFT_TRIGGERS, ...EN_SOFT_TRIGGERS] : EN_SOFT_TRIGGERS;
  if (!soft.some((trigger) => trigger.test(sentence))) return false;
  return EN_DEADLINE.test(sentence) || (lang === "he" && HE_DEADLINE.test(sentence));
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
