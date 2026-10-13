/**
 * Shared helpers for the v3 "You" screens (insights, activity, notifications, nags, memory,
 * memory import, modules). Pure, so `bun run test` covers them.
 */

/** PRD §5: every delete and every accepted AI change can be undone for 5 minutes. */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

/** How long a screen may show its skeleton before it offers Retry instead. */
export const LOADING_TIMEOUT_MS = 6_000;

/** "4:05" for the Undo toast countdown. Never negative. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export type ScreenState = "loading" | "signed-out" | "error" | "ready";

export type ScreenStateInput = {
  isAuthLoading: boolean;
  isAuthenticated: boolean;
  /** `undefined` = loading or skipped, `null` = no Convex user row yet. */
  profile: unknown;
  /** The screen's main query: `undefined` while loading. */
  data: unknown;
  /** The query threw, or loading ran past {@link LOADING_TIMEOUT_MS}. */
  failed: boolean;
};

/**
 * One state per screen. Queries that call requireUser only run once the profile exists, so a
 * null profile means signed out (or the users row isn't there yet), never an endless skeleton.
 */
export function deriveScreenState(input: ScreenStateInput): ScreenState {
  const { isAuthLoading, isAuthenticated, profile, data, failed } = input;
  if (failed) return "error";
  if (isAuthLoading) return "loading";
  if (!isAuthenticated) return "signed-out";
  if (profile === undefined) return "loading";
  if (profile === null) return "signed-out";
  if (data === undefined) return "loading";
  return "ready";
}

/** Fills `{name}` placeholders in a translated string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/** Local midnight at the start of the day that holds `ms`. */
export function localDayStart(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `fromDayStart` back to the day that holds `ms` (DST-safe). */
export function daysBefore(fromDayStart: number, ms: number): number {
  const from = new Date(fromDayStart);
  const day = new Date(localDayStart(ms));
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  return Math.round((a - b) / 86_400_000);
}

/** Dates read "Monday 12 October" / "10:42" in English, and the Hebrew calendar words in he. */
export function intlLocale(lang: "en" | "he"): string {
  return lang === "he" ? "he-IL" : "en-GB";
}
