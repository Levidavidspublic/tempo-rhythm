/**
 * The command bar's model (docs/design/v3/screens/web/command.html): groups of rows, a title
 * filter, and wrapping keyboard moves. Pure, so the Ctrl K dialog and the /command page share
 * one behaviour and the tests can pin it.
 */
import type { MessageKey } from "@/lib/i18n";
import { TEMPO_SCREENS, type TempoScreen } from "@/lib/tempo-nav";

// Ask the founder still renders ScaffoldScreen and Empty states is an internal reference, so
// the command bar leaves both out. Journal, Routines and Goals are built, so they stay in.
export const SCAFFOLD_ROUTES: ReadonlySet<string> = new Set(["/ask-founder", "/empty-states"]);

/** Every screen the command bar can jump to: the shell routes that are built. */
export const REAL_SCREENS: readonly TempoScreen[] = TEMPO_SCREENS.filter(
  (screen) => !screen.bare && !SCAFFOLD_ROUTES.has(screen.route),
);

/** Shown under "Jump to" before anything is typed (command.html @data jumpTargets). */
export const DEFAULT_JUMP_SLUGS: readonly string[] = [
  "today",
  "tasks",
  "calendar",
  "coach",
  "notes",
  "templates",
  "search",
  "settings",
];

/** Screen names the UI already translates; other screens keep their English title. */
export const SCREEN_LABEL: Readonly<Record<string, MessageKey>> = {
  today: "nav.today",
  "brain-dump": "nav.inbox",
  coach: "nav.coach",
  plan: "nav.plan",
  tasks: "nav.tasks",
  notes: "nav.notes",
  journal: "nav.journal",
  calendar: "nav.calendar",
  habits: "nav.habits",
  routines: "nav.routines",
  goals: "nav.goals",
  projects: "nav.projects",
  study: "nav.study",
  templates: "nav.templates",
  analytics: "nav.insights",
  search: "nav.search",
  history: "nav.history",
  activity: "nav.activity",
  "settings-memory": "nav.memory",
  "settings-nags": "nav.nags",
  settings: "nav.settings",
};

export type CommandGroup = "recent" | "jump" | "act";

export type CommandRow = {
  id: string;
  group: CommandGroup;
  /** The words the filter matches and the row shows. */
  name: string;
  /** Other words the filter also matches (a screen's English title under a Hebrew name). */
  alt?: string;
  hint?: string;
  /** Where Enter goes, or the action it runs. */
  href?: string;
  action?: "theme" | "font" | "new-page";
  /** "Search everything" stays visible whatever is typed. */
  always?: boolean;
};

/**
 * Rows whose name (or alt) holds the typed text (any case), in their given order. The
 * always-shown row stays. Matching names only, never hints, keeps results predictable: "t"
 * finds Today, then Tasks.
 */
export function filterRows<T extends CommandRow>(rows: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (row) =>
      row.always || row.name.toLocaleLowerCase().includes(q) || (row.alt ?? "").toLocaleLowerCase().includes(q),
  );
}

/** The next active row for a key, wrapping at both ends; -1 when there are no rows. */
export function moveActive(
  index: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
  length: number,
): number {
  if (length <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  const step = key === "ArrowDown" ? 1 : -1;
  const from = index < 0 ? (step > 0 ? -1 : 0) : index;
  return (from + step + length) % length;
}

/** "Search everything for …" opens the search page with the words already in it. */
export function searchHref(query: string): string {
  const q = query.trim();
  return q ? `/search?q=${encodeURIComponent(q)}` : "/search";
}

/** The rail pages newest first, at most `limit` (the Recent group). */
export function recentPages<T extends { updatedAt: number }>(pages: readonly T[] | undefined, limit = 4): T[] {
  if (!pages) return [];
  return [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}
