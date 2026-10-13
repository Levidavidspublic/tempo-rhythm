/**
 * What's new (docs/design/v3/screens/web/changelog.html): newest entry first; each change is
 * New, Better or Fixed, marked with an icon and a word, never colour alone. Plain language
 * only, no ticket numbers. Every line describes work merged to the app (the PRs are named here,
 * not on the page), so the page never announces something that isn't there.
 */
import type { MessageKey } from "@/lib/i18n";

export type ChangeKind = "new" | "better" | "fixed";

export type ChangelogEntry = {
  /** Matches the app's package version (major.minor). */
  version: string;
  /** ISO date (YYYY-MM-DD) the changes reached the app. */
  date: string;
  changes: readonly { kind: ChangeKind; text: MessageKey }[];
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: "0.1",
    date: "2026-10-13",
    changes: [
      { kind: "new", text: "cl.c01a" }, // #905, #907: CodeMirror live preview over the Markdown body
      { kind: "new", text: "cl.c01b" }, // #913: templates with {{tokens}}
      { kind: "new", text: "cl.c01c" }, // #914: brain dump saved as a page
      { kind: "new", text: "cl.c01d" }, // #903: en/he with RTL
      { kind: "better", text: "cl.c01e" }, // #910: coach panel beside any page
      { kind: "fixed", text: "cl.c01f" }, // #912: English-only pages stay LTR
    ],
  },
];

/** Entries newest first (by date, then version). */
export function sortedEntries(entries: readonly ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version));
}

/** A day in words for the page's language, read as a calendar date (no time zone shift). */
export function changelogDate(isoDate: string, lang: "en" | "he"): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
