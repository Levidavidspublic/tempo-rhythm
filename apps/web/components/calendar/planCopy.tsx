/**
 * Copy and formatting helpers for the T8 grids and the plan screens.
 *
 * The strings live in lib/i18n-groups/plan.ts. These helpers read that group directly, so the
 * grids work (and test) before i18n.ts spreads the group in. Dates are local `YYYY-MM-DD`
 * strings; names of days and months come from Intl, formatted in UTC so the machine's zone never
 * shifts a date.
 */
import { Fragment, type ReactNode } from "react";
import {
  type LocalDate,
  parseLocalDate,
  type Weekday,
} from "../../../../packages/core/plan/calendar-math";
import { en, he } from "@/lib/i18n-groups/plan";

export type PlanLang = "en" | "he";
export type PlanKey = keyof typeof en;
type Vars = Record<string, string | number>;

const TABLES: Record<PlanLang, Record<PlanKey, string>> = { en, he };

/** A plain string with `{name}` filled in. */
export function pt(lang: PlanLang, key: PlanKey, vars: Vars = {}): string {
  const template = TABLES[lang][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}

/**
 * The same, as React nodes: numbers go in `.tp-num`, clock times in `.tp-num.tp-mono.tp-ltr`,
 * user text in `dir="auto"`. Pass `{ text }` for user text and `{ time }` for a clock time.
 */
export function ptNodes(
  lang: PlanLang,
  key: PlanKey,
  vars: Record<string, string | number | { text: string } | { time: string }> = {}
): ReactNode {
  const template = TABLES[lang][key] ?? en[key];
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (!match) return part === "" ? null : <Fragment key={index}>{part}</Fragment>;
    const value = vars[match[1] as string];
    if (value === undefined) return <Fragment key={index}>{part}</Fragment>;
    if (typeof value === "number") {
      return (
        <span className="tp-num" key={index}>
          {value}
        </span>
      );
    }
    if (typeof value === "object" && "time" in value) {
      return (
        <span className="tp-num tp-mono tp-ltr" key={index}>
          {value.time}
        </span>
      );
    }
    if (typeof value === "object" && "text" in value) {
      return (
        <bdi dir="auto" key={index}>
          {value.text}
        </bdi>
      );
    }
    return <Fragment key={index}>{value}</Fragment>;
  });
}

/** "1 item" / "3 items" style counts. */
export function countKey(n: number, one: PlanKey, many: PlanKey): PlanKey {
  return n === 1 ? one : many;
}

/** 0–1439 → "09:30". */
export function formatClock(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "09:30" → 570, or null. */
export function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function utcDate(date: LocalDate): Date {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

const LOCALE: Record<PlanLang, string> = { en: "en-GB", he: "he-IL" };

export function formatDate(
  lang: PlanLang,
  date: LocalDate,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { ...options, timeZone: "UTC" }).format(
    utcDate(date)
  );
}

/** "Tue 20 Oct". */
export function shortDate(lang: PlanLang, date: LocalDate): string {
  return formatDate(lang, date, { weekday: "short", day: "numeric", month: "short" });
}

/** "Tuesday 20 October". */
export function longDate(lang: PlanLang, date: LocalDate): string {
  return formatDate(lang, date, { weekday: "long", day: "numeric", month: "long" });
}

/** "October 2026". */
export function monthTitle(lang: PlanLang, year: number, month: number): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Short weekday name, 0 = Sunday. 2026-10-18 was a Sunday. */
export function weekdayName(
  lang: PlanLang,
  day: Weekday,
  style: "short" | "long" = "short"
): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { weekday: style, timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, 9, 18 + day))
  );
}

/** Hebrew calendars start the week on Sunday; English ones here start on Monday. */
export function weekStartFor(lang: PlanLang): Weekday {
  return lang === "he" ? 0 : 1;
}
