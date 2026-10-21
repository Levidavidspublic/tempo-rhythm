/** KB-67 selected-nag phrase feedback. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  "phrase.saving": "Saving this phrase…",
  "phrase.savingEarlier": "Finishing an earlier save. Your new words are still here.",
  "phrase.saved": "Phrase added to {label}.",
  "phrase.addedTo": "Phrase added to {label}.",
  "phrase.canEnable": "Phrase added to {label}. You can switch this nag on now.",
  "phrase.error": "That phrase did not save. Your words are still here. Try again.",
  "phrase.earlierError":
    "An earlier phrase for {label} did not save. Your newer words are still here.",
  "suggest.pending": "Looking for suggestions for {label}…",
  "gallery.title": "Phrase editing states",
  "gallery.controls": "Choose a phrase editing state",
  "gallery.default": "Ready",
  "gallery.empty": "No suggestions",
  "gallery.pending": "Pending",
  "gallery.success": "Saved",
  "gallery.error": "Error",
  "gallery.disabled": "Disabled",
  "gallery.overflow": "Long words",
} as const;

export const he: Record<keyof typeof en, string> = {
  "phrase.saving": "שומרים את המשפט…",
  "phrase.savingEarlier": "השמירה הקודמת מסתיימת. המילים החדשות עדיין כאן.",
  "phrase.saved": "המשפט נוסף אל {label}.",
  "phrase.addedTo": "המשפט נוסף אל {label}.",
  "phrase.canEnable": "המשפט נוסף אל {label}. עכשיו אפשר להפעיל את התזכורת.",
  "phrase.error": "המשפט לא נשמר. המילים עדיין כאן, ואפשר לנסות שוב.",
  "phrase.earlierError": "משפט קודם עבור {label} לא נשמר. המילים החדשות עדיין כאן.",
  "suggest.pending": "מחפשים הצעות עבור {label}…",
  "gallery.title": "מצבי עריכת משפטים",
  "gallery.controls": "בחירת מצב לעריכת משפטים",
  "gallery.default": "מוכן",
  "gallery.empty": "אין הצעות",
  "gallery.pending": "בהמתנה",
  "gallery.success": "נשמר",
  "gallery.error": "שגיאה",
  "gallery.disabled": "לא זמין",
  "gallery.overflow": "מילים ארוכות",
};

export type Kb67Lang = "en" | "he";
export type Kb67Key = keyof typeof en;
export function kb67t(
  lang: Kb67Lang,
  key: Kb67Key,
  values?: Readonly<Record<string, string>>
): string {
  const message: string = (lang === "he" ? he : en)[key];
  return values ? message.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "") : message;
}
