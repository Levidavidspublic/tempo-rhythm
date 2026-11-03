/**
 * The starter outlines of the dated pages, in each language. The English bodies are exact copies
 * of `starter:daily-page` and `starter:weekly-page` in convex/lib/templateCatalog.ts (a test keeps
 * them equal). A new dated page for a Hebrew user gets the Hebrew outline only while the template
 * is still that unchanged English starter; any other or edited template is used as written.
 */
import type { Lang } from "@/lib/i18n";

type StarterKind = "daily" | "weekly";

/** An empty checkbox line. Its trailing space is part of the starter, so it is not left to editors. */
const EMPTY_TASK = "- [ ] ";

/** `starter:daily-page` and `starter:weekly-page`, byte for byte. */
export const STARTER_BODIES_EN: Readonly<Record<StarterKind, string>> = {
  daily: `# Today

## Intention
One line for what would make today feel complete.

## Schedule
- [ ] Morning
- [ ] Midday
- [ ] Afternoon

## Notes
`,
  weekly: `# This week

## Focus
Three outcomes that matter this week.

${EMPTY_TASK}
${EMPTY_TASK}
${EMPTY_TASK}

## Days
### Monday
### Tuesday
### Wednesday
### Thursday
### Friday
### Saturday
### Sunday

## Carry forward
What stays open for next week.
`,
};

/**
 * The same outlines in Hebrew: the same heading levels, checkboxes and blank lines. The days run
 * Monday to Sunday, like the ISO week the weekly page covers.
 */
export const STARTER_BODIES_HE: Readonly<Record<StarterKind, string>> = {
  daily: `# היום

## כוונה
שורה אחת על מה שיגרום ליום הזה להרגיש שלם.

## לוח זמנים
- [ ] בוקר
- [ ] צהריים
- [ ] אחר הצהריים

## הערות
`,
  weekly: `# השבוע

## מיקוד
שלושה דברים שחשוב לך להשיג השבוע.

${EMPTY_TASK}
${EMPTY_TASK}
${EMPTY_TASK}

## ימים
### יום שני
### יום שלישי
### יום רביעי
### יום חמישי
### יום שישי
### יום שבת
### יום ראשון

## להמשך
מה נשאר פתוח לשבוע הבא.
`,
};

/**
 * The template body a new dated page is made from, in `lang`. When `body` is the unchanged English
 * starter for `kind` (only trailing whitespace at the very end may differ), a Hebrew page gets the
 * Hebrew starter. Every other body, and every English page, gets `body` exactly as passed.
 */
export function localizedStarterBody(kind: StarterKind, body: string, lang: Lang): string {
  if (lang !== "he") return body;
  return body.trimEnd() === STARTER_BODIES_EN[kind].trimEnd() ? STARTER_BODIES_HE[kind] : body;
}
