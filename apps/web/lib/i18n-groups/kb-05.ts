/** Goals list polish. Hebrew is machine-drafted for Amit's native-language review. */
export const en = {
  "kb05.progress": "Progress",
  "kb05.zero": "Ready when you are",
  "kb05.partial": "Moving along",
  "kb05.complete": "Complete",
  "kb05.markedDone": "Marked done",
  "kb05.resting": "Resting for now",
  "kb05.empty.title": "A place for what matters",
  "kb05.empty.body": "Start with one goal in your own words. You can shape it later.",
  "kb05.empty.action": "Write a first goal",
  "kb05.gallery.title": "Goals gallery",
  "kb05.gallery.default": "Goals",
  "kb05.gallery.empty": "Empty",
  "kb05.gallery.loading": "Loading",
  "kb05.gallery.error": "Error",
  "kb05.gallery.disabled": "Busy",
  "kb05.gallery.overflow": "Long name",
  "kb05.gallery.create": "Create a goal",
  "kb05.gallery.cancel": "Cancel",
  "kb05.gallery.name": "Goal name",
  "kb05.gallery.required": "Give the goal a name first.",
  "kb05.gallery.saved": "Goal added to this preview.",
  "kb05.gallery.retry": "Try again",
  "kb05.gallery.loadingText": "Loading goals…",
  "kb05.gallery.errorText": "Goals could not be shown. Your data is safe.",
  "kb05.gallery.busyText": "Adding a goal…",
} as const;

// Machine-drafted Hebrew; Amit should review this copy before release.
export const he: Record<keyof typeof en, string> = {
  "kb05.progress": "התקדמות",
  "kb05.zero": "אפשר להתחיל מתי שמתאים",
  "kb05.partial": "מתקדמים בקצב שמתאים",
  "kb05.complete": "הושלם",
  "kb05.markedDone": "סומן כהושלם",
  "kb05.resting": "במנוחה כרגע",
  "kb05.empty.title": "מקום למה שחשוב",
  "kb05.empty.body": "אפשר להתחיל ממטרה אחת במילים פשוטות. תמיד אפשר לשנות אותה אחר כך.",
  "kb05.empty.action": "לכתוב מטרה ראשונה",
  "kb05.gallery.title": "תצוגת מטרות",
  "kb05.gallery.default": "מטרות",
  "kb05.gallery.empty": "ריק",
  "kb05.gallery.loading": "טעינה",
  "kb05.gallery.error": "שגיאה",
  "kb05.gallery.disabled": "עסוק",
  "kb05.gallery.overflow": "שם ארוך",
  "kb05.gallery.create": "יצירת מטרה",
  "kb05.gallery.cancel": "ביטול",
  "kb05.gallery.name": "שם המטרה",
  "kb05.gallery.required": "קודם צריך לתת למטרה שם.",
  "kb05.gallery.saved": "המטרה נוספה לתצוגה המקדימה.",
  "kb05.gallery.retry": "לנסות שוב",
  "kb05.gallery.loadingText": "טוענים מטרות…",
  "kb05.gallery.errorText": "לא ניתן להציג את המטרות. המידע שלך שמור.",
  "kb05.gallery.busyText": "מוסיפים מטרה…",
};

export type Kb05Key = keyof typeof en;
export function kb05t(lang: "en" | "he", key: Kb05Key): string {
  return (lang === "he" ? he : en)[key];
}
