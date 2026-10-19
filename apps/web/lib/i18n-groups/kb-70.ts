/** KB-70 local copy. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  pending: "Marking notifications as read…",
  "gallery.title": "Notification action preview",
  "gallery.language": "Preview language",
  "gallery.states": "Preview state",
  "gallery.default": "Default",
  "gallery.pending": "Pending",
  "gallery.success": "Success",
  "gallery.error": "Error",
  "gallery.disabled": "Disabled",
  "gallery.empty": "Empty",
  "gallery.overflow": "Long title",
  "gallery.maya": "Maya shared an update",
  "gallery.mayaBody": "A short fictional notification for the preview.",
  "gallery.dana": "Dana has a reminder",
  "gallery.danaBody": "There is time to look at this later.",
  "gallery.yoni": "Yoni's account note",
  "gallery.yoniBody": "A fictional account message.",
  "gallery.longTitle": "Maya, Dana and Yoni shared a very long fictional notification title that needs to wrap on a narrow phone screen without hiding the action or pushing the page sideways",
} as const;

export const he: Record<keyof typeof en, string> = {
  pending: "מסמנים את ההתראות כנקראו…",
  "gallery.title": "תצוגה מקדימה של פעולות בהתראות",
  "gallery.language": "שפת התצוגה המקדימה",
  "gallery.states": "מצב התצוגה המקדימה",
  "gallery.default": "רגיל",
  "gallery.pending": "בהמתנה",
  "gallery.success": "הצלחה",
  "gallery.error": "שגיאה",
  "gallery.disabled": "לא זמין",
  "gallery.empty": "ריק",
  "gallery.overflow": "כותרת ארוכה",
  "gallery.maya": "עדכון ממאיה",
  "gallery.mayaBody": "התראה קצרה ובדויה לתצוגה המקדימה.",
  "gallery.dana": "תזכורת מדנה",
  "gallery.danaBody": "אפשר לעיין בה גם אחר כך.",
  "gallery.yoni": "הודעת חשבון מיוני",
  "gallery.yoniBody": "הודעת חשבון בדויה.",
  "gallery.longTitle": "מאיה, דנה ויוני שיתפו כותרת ארוכה מאוד של התראה בדויה, והיא צריכה להישבר לשורות במסך טלפון צר בלי להסתיר את הפעולה או להרחיב את הדף לצדדים",
};

export type Kb70Lang = "en" | "he";
export type Kb70Key = keyof typeof en;
export function translateKb70(lang: Kb70Lang, key: Kb70Key): string {
  return (lang === "he" ? he : en)[key];
}
