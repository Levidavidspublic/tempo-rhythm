import type { Lang } from "@/lib/i18n";

/** Hebrew is machine-drafted and needs Amit's native read. */
export const en = {
  showing: "Showing",
  of: "of",
  more: "Show older",
  end: "All currently available activity is shown.",
  galleryControls: "Activity examples",
  galleryItems: "items",
  galleryInsert: "New activity arrived",
  galleryError: "Error example",
  galleryErrorBody: "Activity is unavailable right now.",
  galleryLanguage: "עברית",
  galleryEmpty: "No recent activity",
  galleryEmptyBody: "Recent changes will appear here.",
  galleryRegion: "Recent activity",
} as const;

export const he: Record<keyof typeof en, string> = {
  showing: "מוצגים",
  of: "מתוך",
  more: "הצגת ישנים יותר",
  end: "כל הפעילות הזמינה כרגע מוצגת.",
  galleryControls: "דוגמאות לפעילות",
  galleryItems: "פריטים",
  galleryInsert: "נוספה פעילות חדשה",
  galleryError: "דוגמה לשגיאה",
  galleryErrorBody: "הפעילות לא זמינה כרגע.",
  galleryLanguage: "English",
  galleryEmpty: "אין פעילות מהזמן האחרון",
  galleryEmptyBody: "שינויים מהזמן האחרון יופיעו כאן.",
  galleryRegion: "פעילות אחרונה",
};

export const activityCopy: Record<Lang, Record<keyof typeof en, string>> = { en, he };
