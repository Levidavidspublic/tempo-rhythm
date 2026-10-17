/**
 * S31 MemoryManager parity (docs/design/v3/screens/web/memory.html): search, edit, long text and
 * offline export copy for "What Tempo remembers". English and Hebrew (neutral plural); i18n.ts
 * merges both. Strings the design doesn't have are drafted here [EXTRAPOLATED].
 */
export const en = {
  "mem.search.label": "Search your memories",
  "mem.search.placeholder": "Search",
  "mem.search.clear": "Clear search",
  "mem.search.none": 'No memories match "{q}".',
  "mem.search.count": "{n} of {total} shown",
  "mem.search.looking": "Looking through all your memories…",
  "mem.search.all": "{n} found in all your memories",
  "mem.search.allMore": "{n} found. There may be more: add a word to narrow the search.",
  "mem.edit": "Edit",
  "mem.edit.label": "Change the words of this memory",
  "mem.edit.help": "Up to 2,000 characters. Only you can see it.",
  "mem.edit.long": "Keep a memory to 2,000 characters or fewer.",
  "mem.edit.save": "Save",
  "mem.edit.saving": "Saving…",
  "mem.edit.cancel": "Cancel",
  "mem.edit.error": "That change didn't save. Your memory is as it was. Try again?",
  "mem.edited": "Memory updated",
  "mem.more": "Show all",
  "mem.less": "Show less",
  "mem.ex.offline": "Export works when you're back online. Nothing is lost.",
} as const;

export type MemoryCopyKey = keyof typeof en;

export const he: Record<MemoryCopyKey, string> = {
  "mem.search.label": "חיפוש בזיכרונות",
  "mem.search.placeholder": "חיפוש",
  "mem.search.clear": "ניקוי החיפוש",
  "mem.search.none": 'אין זיכרונות שמתאימים ל־"{q}".',
  "mem.search.count": "{n} מתוך {total} מוצגים",
  "mem.search.looking": "מחפשים בכל הזיכרונות…",
  "mem.search.all": "{n} נמצאו בכל הזיכרונות",
  "mem.search.allMore": "{n} נמצאו. ייתכן שיש עוד: הוסיפו מילה כדי לצמצם את החיפוש.",
  "mem.edit": "עריכה",
  "mem.edit.label": "שינוי המילים של הזיכרון הזה",
  "mem.edit.help": "עד 2,000 תווים. רק אתם רואים את זה.",
  "mem.edit.long": "זיכרון של עד 2,000 תווים.",
  "mem.edit.save": "שמירה",
  "mem.edit.saving": "שומרים…",
  "mem.edit.cancel": "ביטול",
  "mem.edit.error": "השינוי לא נשמר. הזיכרון נשאר כמו שהיה. לנסות שוב?",
  "mem.edited": "הזיכרון עודכן",
  "mem.more": "להציג הכול",
  "mem.less": "להציג פחות",
  "mem.ex.offline": "הייצוא יעבוד כשהחיבור יחזור. שום דבר לא הולך לאיבוד.",
};
