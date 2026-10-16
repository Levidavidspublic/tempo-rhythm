/**
 * Pure helpers for the v3 TempoShell (rail, top bar, tab bar). Kept out of the components so
 * `bun run test` (which covers apps/web/lib) can test them.
 */
import type { MessageKey } from "./i18n";

/** A nav link is current on its own route and on any route below it. */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Route prefix → crumb label. Routes not listed fall back to the nav map title. */
const CRUMBS: readonly [string, MessageKey][] = [
  ["/today", "nav.today"],
  ["/brain-dump", "nav.inbox"],
  ["/coach", "nav.coach"],
  ["/plan", "nav.plan"],
  ["/notes", "rail.pages"],
  ["/tasks", "nav.tasks"],
  ["/journal", "nav.journal"],
  ["/calendar", "nav.calendar"],
  ["/habits", "nav.habits"],
  ["/routines", "nav.routines"],
  ["/goals", "nav.goals"],
  ["/projects", "nav.projects"],
  ["/study", "nav.study"],
  ["/templates", "nav.templates"],
  ["/insights", "nav.insights"],
  ["/search", "nav.search"],
  ["/history", "nav.history"],
  ["/activity", "nav.activity"],
  ["/settings/memory", "nav.memory"],
  ["/settings/nags", "nav.nags"],
  ["/settings", "nav.settings"],
];

export function crumbKey(pathname: string): MessageKey | null {
  const hit = CRUMBS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}

/** Up to two initials from the person's name or email. Never a placeholder like "User". */
export function initialsFor(profile: { greetingName?: string; email?: string } | null | undefined): string {
  const name = profile?.greetingName?.trim();
  const source = name && name !== "User" ? name : profile?.email?.split("@")[0]?.trim();
  if (!source) return "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

