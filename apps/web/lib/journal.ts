/**
 * Journal (docs/design/v3/screens/web/journal.html): the Journal is the run of daily pages
 * (decision 6). One gentle, optional prompt a day from a fixed list; "Another prompt" moves on.
 */
import type { Lang, MessageKey } from "@/lib/i18n";

export const JOURNAL_PROMPTS = [
  "journal.p.1",
  "journal.p.2",
  "journal.p.3",
  "journal.p.4",
  "journal.p.5",
  "journal.p.6",
  "journal.p.7",
] as const satisfies readonly MessageKey[];

/** Whole days since 1970-01-01 for a YYYY-MM-DD date (no time zone involved). */
function dayNumber(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 86_400_000);
}

/** The prompt for a day, `shift` prompts further on (wraps around the list). */
export function promptFor(iso: string, shift = 0): MessageKey {
  const n = JOURNAL_PROMPTS.length;
  const index = (((dayNumber(iso) + shift) % n) + n) % n;
  return JOURNAL_PROMPTS[index] as MessageKey;
}

/** "Monday, 12 October 2026" / "יום שני, 12 באוקטובר 2026" for a YYYY-MM-DD date. */
export function journalDate(iso: string, lang: Lang): string {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(ms));
}
