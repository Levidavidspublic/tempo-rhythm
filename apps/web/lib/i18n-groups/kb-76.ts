/** Shared Undo request feedback. Hebrew is machine-drafted for native review. */
export const en = {
  "kb76.pending": "Undoing this change…",
  "kb76.error": "Could not undo this change. Try again while Undo is available.",
  "kb76.retry": "Try Undo again",
  "kb76.galleryTitle": "Undo request gallery",
  "kb76.galleryIntro": "Fictional changes. Each request stays with its own change.",
  "kb76.galleryChanges": "Changes",
  "kb76.galleryRequests": "Waiting requests",
  "kb76.showMaya": "Show Maya’s change",
  "kb76.showDana": "Show Dana’s change",
  "kb76.showLong": "Show a long title",
  "kb76.withoutUndo": "Show a receipt without Undo",
  "kb76.complete": "Complete oldest request",
  "kb76.reject": "Reject oldest request",
  "kb76.maya": "Maya’s task was added",
  "kb76.dana": "Dana’s task was added",
  "kb76.longTitle":
    "Maya, Dana and Yoni planned a quiet afternoon with enough time for reading, a walk, and a long conversation about the week ahead.",
} as const;

export const he: Record<keyof typeof en, string> = {
  "kb76.pending": "מבטלים את השינוי…",
  "kb76.error": "לא ניתן לבטל את השינוי. אפשר לנסות שוב כל עוד הביטול זמין.",
  "kb76.retry": "ניסיון ביטול נוסף",
  "kb76.galleryTitle": "תצוגת בקשות ביטול",
  "kb76.galleryIntro": "שינויים בדיוניים. כל בקשה נשארת קשורה לשינוי שלה.",
  "kb76.galleryChanges": "שינויים",
  "kb76.galleryRequests": "בקשות בהמתנה",
  "kb76.showMaya": "הצגת השינוי של מאיה",
  "kb76.showDana": "הצגת השינוי של דנה",
  "kb76.showLong": "הצגת כותרת ארוכה",
  "kb76.withoutUndo": "הצגת אישור ללא ביטול",
  "kb76.complete": "השלמת הבקשה הוותיקה ביותר",
  "kb76.reject": "דחיית הבקשה הוותיקה ביותר",
  "kb76.maya": "המשימה של מאיה נוספה",
  "kb76.dana": "המשימה של דנה נוספה",
  "kb76.longTitle":
    "מאיה, דנה ויוני תכננו אחר צוהריים שקט עם מספיק זמן לקריאה, לטיול ולשיחה ארוכה על השבוע הקרוב.",
};

export type Kb76Key = keyof typeof en;
export function tKb76(lang: "en" | "he", key: Kb76Key): string {
  return (lang === "he" ? he : en)[key];
}
