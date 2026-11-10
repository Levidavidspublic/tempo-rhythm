/**
 * Tempo Flow navigation map — single source of truth for Sidebar + ⌘K palette.
 *
 * @source docs/design/claude-export/design-system/app.html (SCREENS object L60-L109)
 * @source docs/design/screen-inventory.md
 */

import type { MessageKey } from "./i18n";

export type TempoCategory =
  | "Flow"
  | "Library"
  | "You"
  | "Settings"
  | "Marketing"
  | "Onboarding"
  | "Mobile";

export type TempoScreen = {
  slug: string;
  /** English name, kept for search: the command bar matches it under a Hebrew label. */
  title: string;
  /** The screen's name in the interface language (the top-bar crumb). Every screen has one. */
  label: MessageKey;
  route: string;
  category: TempoCategory;
  /** Renders without sidebar/topbar (auth, onboarding, template builder/run, daily-note focus). */
  bare?: boolean;
  /** Optional icon name from @tempo/ui/icons. */
  icon?: string;
};

export const TEMPO_SCREENS: readonly TempoScreen[] = [
  // ---- Flow ----------------------------------------------------------------
  { slug: "today", title: "Today", label: "nav.today", route: "/today", category: "Flow", icon: "Home" },
  { slug: "daily-note", title: "Daily note", label: "crumb.dailyNote", route: "/daily-note", category: "Flow", bare: true, icon: "Notebook" },
  { slug: "brain-dump", title: "Brain dump", label: "nav.inbox", route: "/brain-dump", category: "Flow", icon: "Sparkles" },
  { slug: "coach", title: "Coach", label: "nav.coach", route: "/coach", category: "Flow", icon: "Heart" },
  { slug: "plan", title: "Planning", label: "nav.plan", route: "/plan", category: "Flow", icon: "Layout" },

  // ---- Library -------------------------------------------------------------
  { slug: "tasks", title: "Tasks", label: "nav.tasks", route: "/tasks", category: "Library", icon: "CheckSquare" },
  { slug: "notes", title: "Notes", label: "nav.notes", route: "/notes", category: "Library", icon: "BookOpen" },
  { slug: "journal", title: "Journal", label: "nav.journal", route: "/journal", category: "Library", icon: "Book" },
  { slug: "calendar", title: "Calendar", label: "nav.calendar", route: "/calendar", category: "Library", icon: "Calendar" },
  { slug: "habits", title: "Habits", label: "nav.habits", route: "/habits", category: "Library", icon: "Flame" },
  { slug: "routines", title: "Routines", label: "nav.routines", route: "/routines", category: "Library", icon: "Repeat" },
  { slug: "goals", title: "Goals", label: "nav.goals", route: "/goals", category: "Library", icon: "Target" },
  { slug: "projects", title: "Projects", label: "nav.projects", route: "/projects", category: "Library", icon: "Folder" },

  // ---- You -----------------------------------------------------------------
  { slug: "analytics", title: "Insights", label: "nav.insights", route: "/insights", category: "You", icon: "Chart" },
  { slug: "history", title: "Conversation history", label: "nav.history", route: "/history", category: "You", icon: "Book" },
  { slug: "activity", title: "Recent activity", label: "nav.activity", route: "/activity", category: "You", icon: "Clock" },
  { slug: "tracking", title: "Session tracking", label: "crumb.tracking", route: "/tracking", category: "You", icon: "Chart" },
  { slug: "templates", title: "Templates", label: "nav.templates", route: "/templates", category: "You", icon: "Layers" },
  { slug: "search", title: "Search", label: "nav.search", route: "/search", category: "You", icon: "Search" },
  { slug: "modules", title: "Modules", label: "md.title", route: "/modules", category: "You", icon: "Layers" },
  { slug: "empty-states", title: "Empty states", label: "crumb.emptyStates", route: "/empty-states", category: "You", icon: "Leaf" },

  // ---- Settings ------------------------------------------------------------
  { slug: "settings", title: "Profile", label: "set.nav.profile", route: "/settings/profile", category: "Settings", icon: "User" },
  { slug: "settings-prefs", title: "Preferences", label: "set.nav.prefs", route: "/settings/preferences", category: "Settings", icon: "Settings" },
  { slug: "settings-integrations", title: "Integrations", label: "set.nav.integ", route: "/settings/integrations", category: "Settings", icon: "Link" },
  { slug: "settings-privacy", title: "Privacy", label: "set.nav.privacy", route: "/settings/privacy", category: "Settings", icon: "Shield" },
  { slug: "settings-nags", title: "Nags", label: "nav.nags", route: "/settings/nags", category: "Settings", icon: "Bell" },
  { slug: "settings-memory", title: "Memory", label: "nav.memory", route: "/settings/memory", category: "Settings", icon: "Sparkles" },
  { slug: "billing", title: "Plan and billing", label: "set.nav.billing", route: "/billing", category: "Settings", icon: "Star" },
  { slug: "notifications", title: "Notifications", label: "set.nav.notif", route: "/notifications", category: "Settings", icon: "Bell" },
  { slug: "ask-founder", title: "Ask the founder", label: "set.nav.founder", route: "/ask-founder", category: "Settings", icon: "Mail" },

  // ---- Bare routes (no shell) ---------------------------------------------
  { slug: "sign-in", title: "Sign in", label: "mk.signin", route: "/sign-in", category: "Onboarding", bare: true },
  { slug: "onboarding", title: "Onboarding", label: "crumb.onboarding", route: "/onboarding", category: "Onboarding", bare: true },
  { slug: "template-builder", title: "Template builder", label: "tb.title", route: "/templates/builder", category: "You", bare: true },
  { slug: "template-run", title: "Template run", label: "crumb.templateRun", route: "/templates/run", category: "You", bare: true },
  { slug: "trial-end", title: "Trial ended", label: "crumb.trialEnd", route: "/billing/trial-end", category: "Settings", bare: true },

  // ---- Marketing (bare: own layout) ---------------------------------------
  { slug: "landing", title: "Landing", label: "crumb.home", route: "/", category: "Marketing", bare: true },
  { slug: "about", title: "About", label: "mk.about", route: "/about", category: "Marketing", bare: true },
  { slug: "changelog", title: "Changelog", label: "cl.eyebrow", route: "/changelog", category: "Marketing", bare: true },
];

export const CATEGORIES: readonly TempoCategory[] = [
  "Flow",
  "Library",
  "You",
  "Settings",
];

export function screensByCategory(category: TempoCategory): TempoScreen[] {
  return TEMPO_SCREENS.filter(
    (s) => s.category === category && !s.bare,
  );
}

export function findScreen(slug: string): TempoScreen | undefined {
  return TEMPO_SCREENS.find((s) => s.slug === slug);
}
