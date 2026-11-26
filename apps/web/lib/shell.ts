/**
 * Pure helpers for the v3 TempoShell (rail, top bar, tab bar). Kept out of the components so
 * `bun run test` (which covers apps/web/lib) can test them.
 */
import type { MessageKey } from "./i18n";
import { TEMPO_SCREENS } from "./tempo-nav";

/** A nav link is current on its own route and on any route below it. */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The top bar's last crumb: a translated screen name, or a page's own title as written. */
export type Crumb = { key: MessageKey } | { text: string };

/** Top-bar breadcrumb. `section` is the first crumb (hidden at phone width); null leaves it out. */
export type Crumbs = { section: MessageKey | null; current: Crumb };

const PAGES_SECTION: MessageKey = "top.crumb";
const SETTINGS_SECTION: MessageKey = "nav.settings";

type CrumbRoute = { route: string; label: MessageKey; settings: boolean };

/** Shell routes that are not screens in the nav map. */
const EXTRA_ROUTES: readonly CrumbRoute[] = [
  { route: "/settings", label: "nav.settings", settings: true },
  { route: "/week", label: "nav.week", settings: false },
  { route: "/command", label: "cmd.page.title", settings: false },
  { route: "/admin/approvals", label: "crumb.approvals", settings: false },
];

const CRUMB_ROUTES: readonly CrumbRoute[] = [
  ...TEMPO_SCREENS.map((s) => ({ route: s.route, label: s.label, settings: s.category === "Settings" })),
  ...EXTRA_ROUTES,
];

/** The page id when the path shows one page (/notes/<id>, or its /p/<id> alias), else null. */
export function pageIdFor(pathname: string): string | null {
  const match = /^\/(?:notes|p)\/([^/]+)\/?$/.exec(pathname);
  return match ? match[1]! : null;
}

/** The deepest known route at or above `pathname` ("/goals/abc" → "/goals"). */
function routeFor(pathname: string): CrumbRoute | null {
  let best: CrumbRoute | null = null;
  for (const entry of CRUMB_ROUTES) {
    if (!isCurrent(pathname, entry.route)) continue;
    if (!best || entry.route.length > best.route.length) best = entry;
  }
  return best;
}

/**
 * The top-bar breadcrumb for a path (weekly-page.html "Pages › Week 42", settings-prefs.html
 * "Settings / Preferences"):
 * - a page: Pages › its title, or Untitled. `pageTitle` is undefined while the page loads and null
 *   when it can't be shown; both show the section name alone, so the bar never waits.
 * - a Settings screen: Settings › its name ("Settings" alone on the settings index).
 * - any other screen: Pages › its name.
 */
export function crumbsFor(pathname: string, pageTitle?: string | null): Crumbs {
  if (pageIdFor(pathname) !== null) {
    if (pageTitle === undefined || pageTitle === null) return { section: null, current: { key: PAGES_SECTION } };
    const title = pageTitle.trim();
    return { section: PAGES_SECTION, current: title ? { text: title } : { key: "page.untitled" } };
  }
  const hit = routeFor(pathname);
  if (!hit) return { section: null, current: { key: PAGES_SECTION } };
  const section = hit.settings ? SETTINGS_SECTION : PAGES_SECTION;
  return { section: section === hit.label ? null : section, current: { key: hit.label } };
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

