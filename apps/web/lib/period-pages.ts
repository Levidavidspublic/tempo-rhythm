/**
 * Dated pages (v3 OVERNIGHT-RUN.md decision 6): the daily page for a local date and the weekly
 * page for an ISO week are ordinary Markdown pages made from a template with {{tokens}}.
 * Pure date math on YYYY-MM-DD strings (UTC calendar arithmetic, no time zone involved).
 */
import { applyTemplateTokens, dayTokens } from "@/lib/editor/markdown-model";
import type { Lang } from "@/lib/i18n";

export type PeriodKind = "daily" | "weekly";

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The local calendar date of `d` as YYYY-MM-DD (late evenings keep today's date). */
export function localIsoDate(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUtc(iso: string): Date | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  // Date.UTC reads years 0-99 as 1900-1999, so the year is set on its own.
  const date = new Date(Date.UTC(2000, Number(m[2]) - 1, Number(m[3])));
  date.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toISOString().slice(0, 10) === iso ? date : null;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(iso: string): boolean {
  return toUtc(iso) !== null;
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  if (!date) throw new Error(`Not a date: ${iso}`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** The Monday that starts the ISO week holding `iso`. */
export function mondayOf(iso: string): string {
  const date = toUtc(iso);
  if (!date) throw new Error(`Not a date: ${iso}`);
  const weekday = date.getUTCDay() || 7;
  return addDays(iso, 1 - weekday);
}

/** The ISO week number of a Thursday, by day-of-year arithmetic that keeps four-digit years. */
function weekOfThursday(thursday: string): number {
  const date = toUtc(thursday);
  const jan1 = toUtc(`${thursday.slice(0, 4)}-01-01`);
  if (!date || !jan1) throw new Error(`Not a date: ${thursday}`);
  return Math.floor((date.getTime() - jan1.getTime()) / DAY_MS / 7) + 1;
}

/** The ISO week key ("2026-W42") of the week holding `iso`. The year is the ISO week-year. */
export function weekKey(iso: string): string {
  // The week belongs to the year of its Thursday.
  const thursday = addDays(mondayOf(iso), 3);
  return `${thursday.slice(0, 4)}-W${String(weekOfThursday(thursday)).padStart(2, "0")}`;
}

/** The Monday of an ISO week key such as "2026-W42", or null when there is no such week. */
export function mondayOfWeekKey(key: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Year 0 would need dates before year 1, which ISO strings here do not write.
  if (year < 1 || week < 1 || week > 53) return null;
  // January 4th is always in week 1. Dates outside years 1-9999 have no YYYY-MM-DD form here,
  // so a week that reaches them does not exist.
  try {
    const monday = addDays(mondayOf(`${m[1]}-01-04`), (week - 1) * 7);
    return isIsoDate(monday) && weekKey(monday) === key ? monday : null;
  } catch {
    return null;
  }
}

/** Token values for the week that starts on `monday`. */
export function weekTokens(monday: string, lang: Lang = "en"): Record<string, string> {
  const start = toUtc(monday);
  if (!start) throw new Error(`Not a date: ${monday}`);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const range = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).formatRange(
    start,
    end,
  );
  const week = String(weekOfThursday(addDays(monday, 3)));
  return {
    date: monday,
    week,
    range,
    year: weekKey(monday).slice(0, 4),
    title: lang === "he" ? `שבוע ${week}` : `Week ${week}`,
  };
}

/** Drops the template's own top heading: the page title already shows the day or week. */
function withoutTopHeading(body: string): string {
  const m = /^(?:[ \t]*\n)*# [^\n]*(?:\n|$)(?:[ \t]*\n)?/.exec(body);
  return m ? body.slice(m[0].length) : body;
}

/**
 * The title and body of a new dated page made from `templateBody`. Known {{tokens}} are filled
 * (date, weekday, day, week, range, year, title); unknown ones stay as typed.
 */
export function periodPageDraft(
  kind: PeriodKind,
  iso: string,
  templateBody: string,
  lang: Lang = "en",
): { title: string; body: string } {
  const tokens = kind === "daily" ? dayTokens(iso, lang) : weekTokens(iso, lang);
  return { title: tokens.title ?? iso, body: applyTemplateTokens(withoutTopHeading(templateBody), tokens) };
}
