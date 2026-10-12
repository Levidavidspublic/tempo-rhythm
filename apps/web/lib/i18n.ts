/**
 * Tempo v3 i18n — English and Hebrew strings for the shell and the v3 screens.
 * The language is device-local (`tempo-lang`, like tempo.js in docs/design/v3) and can be
 * forced with `?lang=en|he`. Hebrew sets `dir="rtl"` on <html>; numbers and code stay LTR
 * through `.tp-num` / `.tp-mono` (DESIGN.md §10).
 *
 * Hebrew copy is machine-drafted and needs native review (OVERNIGHT-RUN.md hard limits).
 */

export const LANG_STORAGE_KEY = "tempo-lang";

export type Lang = "en" | "he";

export const LANGS: readonly Lang[] = ["en", "he"];

export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "he";
}

export function dirFor(lang: Lang): "ltr" | "rtl" {
  return lang === "he" ? "rtl" : "ltr";
}

/** URL parameter first, then the stored choice, then English. */
export function resolveLang(param: string | null | undefined, stored: string | null | undefined): Lang {
  if (isLang(param)) return param;
  if (isLang(stored)) return stored;
  return "en";
}

const en = {
  "skip": "Skip to page",
  "rail.label": "Pages",
  "rail.search": "Search or jump to",
  "rail.pages": "Pages",
  "rail.library": "Library",
  "rail.you": "You",
  "rail.allPages": "All pages",
  "rail.newPage": "New page",
  "rail.noPages": "No pages yet",
  "nav.today": "Today",
  "nav.inbox": "Brain dump",
  "nav.coach": "Coach",
  "nav.plan": "Plan",
  "nav.week": "This week",
  "nav.tasks": "Tasks",
  "nav.notes": "Notes",
  "nav.journal": "Journal",
  "nav.calendar": "Calendar",
  "nav.habits": "Habits",
  "nav.routines": "Routines",
  "nav.goals": "Goals",
  "nav.projects": "Projects",
  "nav.templates": "Templates",
  "nav.insights": "Insights",
  "nav.search": "Search",
  "nav.history": "Coach history",
  "nav.activity": "Recent activity",
  "nav.memory": "Memory",
  "nav.nags": "Nags",
  "nav.settings": "Settings",
  "nav.dyslexia": "Reading font",
  "nav.language": "עברית",
  "nav.signOut": "Sign out",
  "top.menu": "Open pages",
  "top.crumb": "Pages",
  "top.themeDark": "Dark theme",
  "top.themeLight": "Light theme",
  "coach.open": "Open coach (Ctrl J)",
  "coach.name": "Coach",
  "tab.label": "Main",
  "tab.tasks": "Tasks",
  "tab.cal": "Calendar",
  "tab.more": "More",
  "page.untitled": "Untitled",
  "editor.minutes": "min",
  "editor.remove": "Remove",
  "editor.broken": "This part has a problem. The rest of your page is safe.",
  "editor.template": "Template",
  "editor.done": "Done",
  "editor.placeholder": "Write whatever is on your mind. Type / for blocks, [[ to link a page.",
} as const;

export type MessageKey = keyof typeof en;

const he: Record<MessageKey, string> = {
  "skip": "דלגו לדף",
  "rail.label": "דפים",
  "rail.search": "חיפוש או מעבר אל",
  "rail.pages": "דפים",
  "rail.library": "ספרייה",
  "rail.you": "אני",
  "rail.allPages": "כל הדפים",
  "rail.newPage": "דף חדש",
  "rail.noPages": "עוד אין דפים",
  "nav.today": "היום",
  "nav.inbox": "פריקת מחשבות",
  "nav.coach": "מאמן",
  "nav.plan": "תכנון",
  "nav.week": "השבוע",
  "nav.tasks": "משימות",
  "nav.notes": "פתקים",
  "nav.journal": "יומן",
  "nav.calendar": "לוח שנה",
  "nav.habits": "הרגלים",
  "nav.routines": "שגרות",
  "nav.goals": "מטרות",
  "nav.projects": "פרויקטים",
  "nav.templates": "תבניות",
  "nav.insights": "תובנות",
  "nav.search": "חיפוש",
  "nav.history": "היסטוריית מאמן",
  "nav.activity": "פעילות אחרונה",
  "nav.memory": "זיכרון",
  "nav.nags": "תזכורות",
  "nav.settings": "הגדרות",
  "nav.dyslexia": "גופן קריאה",
  "nav.language": "English",
  "nav.signOut": "התנתקות",
  "top.menu": "פתיחת הדפים",
  "top.crumb": "דפים",
  "top.themeDark": "ערכת צבעים כהה",
  "top.themeLight": "ערכת צבעים בהירה",
  "coach.open": "פתיחת המאמן (Ctrl J)",
  "coach.name": "מאמן",
  "tab.label": "ראשי",
  "tab.tasks": "משימות",
  "tab.cal": "לוח שנה",
  "tab.more": "עוד",
  "page.untitled": "ללא כותרת",
  "editor.minutes": "דק׳",
  "editor.remove": "הסרה",
  "editor.broken": "יש בעיה בחלק הזה. שאר הדף שלך שמור.",
  "editor.template": "תבנית",
  "editor.done": "בוצע",
  "editor.placeholder": "אפשר לכתוב כל מה שעל הלב. / לבלוקים, [[ לקישור לדף.",
};

export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, he };

export function translate(lang: Lang, key: MessageKey): string {
  return MESSAGES[lang][key] ?? MESSAGES.en[key];
}
