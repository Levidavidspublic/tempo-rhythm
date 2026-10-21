/** Goal progress table copy. Hebrew is machine-drafted and needs Amit's native read. */
export const en = {
  "kb07.range": "{start} – {end}",
  "kb07.table.show": "Show weekly values",
  "kb07.table.week": "Week starting",
  "kb07.table.steps": "Small steps done",
  "kb07.table.empty": "There are no weeks to show yet.",
  "kb07.gallery.title": "Goal progress states",
  "kb07.gallery.default": "Progress",
  "kb07.gallery.empty": "No steps yet",
  "kb07.gallery.loading": "Loading",
  "kb07.gallery.error": "Error",
  "kb07.gallery.disabled": "Unavailable",
  "kb07.gallery.overflow": "More weeks",
  "kb07.gallery.retry": "Try again",
  "kb07.gallery.errorText": "Couldn't load progress. Your data is safe.",
  "kb07.gallery.loadingText": "Loading your progress…",
  "kb07.gallery.disabledText": "Progress is unavailable right now.",
  "kb07.gallery.range4": "4 weeks",
  "kb07.gallery.range8": "8 weeks",
  "kb07.gallery.language": "Language",
  "kb07.gallery.otherLanguage": "עברית",
} as const;

export const he: Record<keyof typeof en, string> = {
  "kb07.range": "{start} – {end}",
  "kb07.table.show": "הצגת נתונים לפי שבוע",
  "kb07.table.week": "השבוע שמתחיל ב־",
  "kb07.table.steps": "צעדים קטנים שבוצעו",
  "kb07.table.empty": "עדיין אין שבועות להצגה.",
  "kb07.gallery.title": "מצבי התקדמות המטרות",
  "kb07.gallery.default": "התקדמות",
  "kb07.gallery.empty": "עדיין אין צעדים",
  "kb07.gallery.loading": "בטעינה",
  "kb07.gallery.error": "שגיאה",
  "kb07.gallery.disabled": "לא זמין",
  "kb07.gallery.overflow": "שבועות נוספים",
  "kb07.gallery.retry": "לנסות שוב",
  "kb07.gallery.errorText": "לא הצלחנו לטעון את ההתקדמות. הנתונים שלך בטוחים.",
  "kb07.gallery.loadingText": "טוענים את ההתקדמות שלך…",
  "kb07.gallery.disabledText": "ההתקדמות לא זמינה כרגע.",
  "kb07.gallery.range4": "4 שבועות",
  "kb07.gallery.range8": "8 שבועות",
  "kb07.gallery.language": "שפה",
  "kb07.gallery.otherLanguage": "English",
};

export type Kb07Key = keyof typeof en;
export type Kb07Lang = "en" | "he";

export function translateKb07(lang: Kb07Lang, key: Kb07Key, values: Record<string, string> = {}): string {
  const template: string = (lang === "he" ? he : en)[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`);
}
