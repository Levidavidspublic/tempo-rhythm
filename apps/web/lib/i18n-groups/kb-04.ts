/** Journal pagination copy. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  "kb04.end": "You're up to date with your journal.",
  "kb04.loading": "Loading more days…",
  "kb04.more": "Load more days",
  "kb04.empty": "No earlier days yet.",
  "kb04.error": "These days couldn't load. Try again.",
  "kb04.retry": "Try again",
  "kb04.galleryTitle": "Journal reading gallery",
  "kb04.default": "Entries",
  "kb04.emptyState": "Empty",
  "kb04.loadingState": "Loading",
  "kb04.errorState": "Error",
  "kb04.disabledState": "Disabled",
  "kb04.overflowState": "Long title",
} as const;

export const he: Record<keyof typeof en, string> = {
  "kb04.end": "כל הדפים ביומן מוצגים.",
  "kb04.loading": "טוענים עוד ימים…",
  "kb04.more": "טעינת ימים נוספים",
  "kb04.empty": "אין ימים קודמים עדיין.",
  "kb04.error": "הימים האלה לא נטענו. אפשר לנסות שוב.",
  "kb04.retry": "לנסות שוב",
  "kb04.galleryTitle": "גלריית קריאה ביומן",
  "kb04.default": "רשומות",
  "kb04.emptyState": "ריק",
  "kb04.loadingState": "טעינה",
  "kb04.errorState": "שגיאה",
  "kb04.disabledState": "לא זמין",
  "kb04.overflowState": "כותרת ארוכה",
};

export type Kb04Key = keyof typeof en;
export function kb04t(lang: "en" | "he", key: Kb04Key): string {
  return (lang === "he" ? he : en)[key];
}
