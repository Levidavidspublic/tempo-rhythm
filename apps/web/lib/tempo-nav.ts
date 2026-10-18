/**
 * Tempo Flow navigation map — single source of truth for Sidebar + ⌘K palette.
 *
 * @source docs/design/claude-export/design-system/app.html (SCREENS object L60-L109)
 * @source docs/design/screen-inventory.md
 */

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
  title: string;
  route: string;
  category: TempoCategory;
  /** Renders without sidebar/topbar (auth, onboarding, template builder/run, daily-note focus). */
  bare?: boolean;
  /** Optional icon name from @tempo/ui/icons. */
  icon?: string;
};

export const TEMPO_SCREENS: readonly TempoScreen[] = [
  // ---- Flow ----------------------------------------------------------------
  { slug: "today", title: "Today", route: "/today", category: "Flow", icon: "Home" },
  { slug: "daily-note", title: "Daily note", route: "/daily-note", category: "Flow", bare: true, icon: "Notebook" },
  { slug: "brain-dump", title: "Brain dump", route: "/brain-dump", category: "Flow", icon: "Sparkles" },
  { slug: "coach", title: "Coach", route: "/coach", category: "Flow", icon: "Heart" },
  { slug: "plan", title: "Planning", route: "/plan", category: "Flow", icon: "Layout" },

  // ---- Library -------------------------------------------------------------
  { slug: "tasks", title: "Tasks", route: "/tasks", category: "Library", icon: "CheckSquare" },
  { slug: "notes", title: "Notes", route: "/notes", category: "Library", icon: "BookOpen" },
  { slug: "journal", title: "Journal", route: "/journal", category: "Library", icon: "Book" },
  { slug: "calendar", title: "Calendar", route: "/calendar", category: "Library", icon: "Calendar" },
  { slug: "habits", title: "Habits", route: "/habits", category: "Library", icon: "Flame" },
  { slug: "routines", title: "Routines", route: "/routines", category: "Library", icon: "Repeat" },
  { slug: "goals", title: "Goals", route: "/goals", category: "Library", icon: "Target" },
  { slug: "projects", title: "Projects", route: "/projects", category: "Library", icon: "Folder" },
  { slug: "study", title: "Study", route: "/study", category: "Library", icon: "Layers" },

  // ---- You -----------------------------------------------------------------
  { slug: "analytics", title: "Insights", route: "/insights", category: "You", icon: "Chart" },
  { slug: "history", title: "Conversation history", route: "/history", category: "You", icon: "Book" },
  { slug: "activity", title: "Recent activity", route: "/activity", category: "You", icon: "Clock" },
  { slug: "tracking", title: "Session tracking", route: "/tracking", category: "You", icon: "Chart" },
  { slug: "templates", title: "Templates", route: "/templates", category: "You", icon: "Layers" },
  { slug: "search", title: "Search", route: "/search", category: "You", icon: "Search" },
  { slug: "modules", title: "Modules", route: "/modules", category: "You", icon: "Layers" },
  { slug: "empty-states", title: "Empty states", route: "/empty-states", category: "You", icon: "Leaf" },

  // ---- Settings ------------------------------------------------------------
  { slug: "settings", title: "Profile", route: "/settings/profile", category: "Settings", icon: "User" },
  { slug: "settings-prefs", title: "Preferences", route: "/settings/preferences", category: "Settings", icon: "Settings" },
  { slug: "settings-integrations", title: "Integrations", route: "/settings/integrations", category: "Settings", icon: "Link" },
  { slug: "settings-privacy", title: "Privacy", route: "/settings/privacy", category: "Settings", icon: "Shield" },
  { slug: "settings-nags", title: "Nags", route: "/settings/nags", category: "Settings", icon: "Bell" },
  { slug: "settings-memory", title: "Memory", route: "/settings/memory", category: "Settings", icon: "Sparkles" },
  { slug: "billing", title: "Plan and billing", route: "/billing", category: "Settings", icon: "Star" },
  { slug: "notifications", title: "Notifications", route: "/notifications", category: "Settings", icon: "Bell" },
  { slug: "ask-founder", title: "Ask the founder", route: "/ask-founder", category: "Settings", icon: "Mail" },

  // ---- Bare routes (no shell) ---------------------------------------------
  { slug: "sign-in", title: "Sign in", route: "/sign-in", category: "Onboarding", bare: true },
  { slug: "onboarding", title: "Onboarding", route: "/onboarding", category: "Onboarding", bare: true },
  { slug: "template-builder", title: "Template builder", route: "/templates/builder", category: "You", bare: true },
  { slug: "template-run", title: "Template run", route: "/templates/run", category: "You", bare: true },
  { slug: "trial-end", title: "Trial ended", route: "/billing/trial-end", category: "Settings", bare: true },

  // ---- Marketing (bare: own layout) ---------------------------------------
  { slug: "landing", title: "Landing", route: "/", category: "Marketing", bare: true },
  { slug: "about", title: "About", route: "/about", category: "Marketing", bare: true },
  { slug: "changelog", title: "Changelog", route: "/changelog", category: "Marketing", bare: true },
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
