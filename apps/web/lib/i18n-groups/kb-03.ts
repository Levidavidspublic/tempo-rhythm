/** KB-03 local search copy. Hebrew is machine-drafted and needs Amit's native read. */
export const en = {
  "status.initial": "Type to search your notes, tasks, habits and goals.",
  "status.loading": "Searching…",
  "status.previous": "Searching… Showing the last results for now.",
  "status.none": "No matches for “{q}”. Try another word.",
  "status.noneHere": "No {kind} results for {q}. Clear the filter to see everything.",
  "status.one": "1 result",
  "status.many": "{n} results",
  "status.error": "Search couldn't load. Your content is safe. Try again.",
  "status.disabled": "Search is unavailable right now.",
  "filter.summary": "Showing {n} of {total} in {kind}",
  "filter.clear": "Show all results",
  "gallery.title": "Search states",
  "gallery.language": "עברית",
  "gallery.initial": "Start",
  "gallery.default": "Results",
  "gallery.empty": "No matches",
  "gallery.loading": "Loading",
  "gallery.error": "Error",
  "gallery.disabled": "Disabled",
  "gallery.overflow": "Long results",
  "gallery.retry": "Try again",
} as const;

export const he: Record<keyof typeof en, string> = {
  "status.initial": "אפשר להקליד כדי לחפש בפתקים, במשימות, בהרגלים ובמטרות.",
  "status.loading": "מחפשים…",
  "status.previous": "מחפשים… בינתיים מוצגות התוצאות הקודמות.",
  "status.none": "אין תוצאות עבור {q}. אפשר לנסות מילה אחרת.",
  "status.noneHere": "אין תוצאות מסוג {kind} עבור {q}. אפשר לנקות את המסנן ולראות את כולן.",
  "status.one": "תוצאה אחת",
  "status.many": "{n} תוצאות",
  "status.error": "החיפוש לא נטען. התוכן שלך שמור. אפשר לנסות שוב.",
  "status.disabled": "החיפוש לא זמין כרגע.",
  "filter.summary": "מוצגות {n} מתוך {total} תוצאות מסוג {kind}",
  "filter.clear": "הצגת כל התוצאות",
  "gallery.title": "מצבי חיפוש",
  "gallery.language": "English",
  "gallery.initial": "התחלה",
  "gallery.default": "תוצאות",
  "gallery.empty": "אין תוצאות",
  "gallery.loading": "טוענים",
  "gallery.error": "שגיאה",
  "gallery.disabled": "לא זמין",
  "gallery.overflow": "תוצאות ארוכות",
  "gallery.retry": "לנסות שוב",
};

export type Kb03Key = keyof typeof en;
export function kb03(lang: "en" | "he", key: Kb03Key, values: Record<string, string | number> = {}): string {
  return (lang === "he" ? he[key] : en[key]).replace(/\{(\w+)\}/g, (part, name: string) =>
    name in values ? String(values[name]) : part,
  );
}
