/**
 * Date helpers for the v3 mobile screens. Calendar dates are YYYY-MM-DD strings in the phone's
 * local time; day maths on them is UTC calendar arithmetic, so no time zone shift can move a day.
 * Pure: no React Native imports.
 */
import type { Lang } from "./i18n";

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The phone's local calendar date of `d` as YYYY-MM-DD. */
export function localIsoDate(d: Date): string {
  const year = String(d.getFullYear()).padStart(4, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUtc(iso: string): Date | null {
  const m = ISO_DATE.exec(iso);
  if (!m) return null;
  const date = new Date(Date.UTC(2000, Number(m[2]) - 1, Number(m[3])));
  date.setUTCFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toISOString().slice(0, 10) === iso ? date : null;
}

export function isIsoDate(iso: string): boolean {
  return toUtc(iso) !== null;
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  if (!date) throw new Error(`Not a date: ${iso}`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const date = toUtc(iso);
  if (!date) throw new Error(`Not a date: ${iso}`);
  return date.getUTCDay();
}

/** The Monday that starts the ISO week holding `iso`. */
export function mondayOf(iso: string): string {
  const weekday = weekdayOf(iso) || 7;
  return addDays(iso, 1 - weekday);
}

/** The seven dates of the week that starts on `monday`. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Local midnight (ms) at the start of the calendar date `iso`. */
export function startOfLocalDay(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Not a date: ${iso}`);
  const d = new Date(0);
  d.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** [start, end) of the local calendar day `iso`, in ms. Handles 23- and 25-hour days. */
export function localDayBounds(iso: string): { startMs: number; endMs: number } {
  return { startMs: startOfLocalDay(iso), endMs: startOfLocalDay(addDays(iso, 1)) };
}

/** The dueAt Today's quick add uses (the web does the same): the last millisecond of the day. */
export function endOfDayDueAt(iso: string): number {
  return localDayBounds(iso).endMs - 1;
}

/** True when a dueAt carries no real time of day (the end-of-day value quick add writes). */
export function isEndOfDay(ms: number): boolean {
  const d = new Date(ms);
  return d.getHours() === 23 && d.getMinutes() === 59;
}

/** "08:05" — 24-hour local time, always written left to right. */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Minutes since local midnight for "14:30", or null when it is not a real 24-hour time. */
export function parseClock(text: string): number | null {
  const m = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function locale(lang: Lang): string {
  return lang === "he" ? "he-IL" : "en-GB";
}

function format(iso: string, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  const date = toUtc(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat(locale(lang), { ...options, timeZone: "UTC" }).format(date);
}

/** "Monday, 12 October" / "יום שני, 12 באוקטובר". */
export function longDay(iso: string, lang: Lang): string {
  return format(iso, lang, { weekday: "long", day: "numeric", month: "long" });
}

/** "Thu 15 Oct" / "יום ה׳, 15 באוק׳" (short, for task meta). */
export function shortDay(iso: string, lang: Lang): string {
  return format(iso, lang, { weekday: "short", day: "numeric", month: "short" });
}

/** "3 Oct" / "3 באוק׳". */
export function dayMonth(iso: string, lang: Lang): string {
  return format(iso, lang, { day: "numeric", month: "short" });
}

/** "Sunday" / "יום ראשון". */
export function weekdayName(iso: string, lang: Lang): string {
  return format(iso, lang, { weekday: "long" });
}

/** "12 – 18 October 2026" for the week that starts on `monday`. */
export function weekRange(monday: string, lang: Lang): string {
  const start = toUtc(monday);
  const end = toUtc(addDays(monday, 6));
  if (!start || !end) return monday;
  const fmt = new Intl.DateTimeFormat(locale(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  // formatRange is not in every Hermes build; fall back to two dates joined by a dash.
  const ranged = (fmt as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange;
  return typeof ranged === "function" ? ranged.call(fmt, start, end) : `${fmt.format(start)} – ${fmt.format(end)}`;
}

/** The part of the day a greeting uses. */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = toUtc(fromIso);
  const b = toUtc(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}
