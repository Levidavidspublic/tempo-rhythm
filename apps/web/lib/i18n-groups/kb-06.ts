/** Goal detail polish. Hebrew is machine-drafted and needs Amit's native read. */
export const en = {
  "kb06.progress": "Progress",
  "kb06.complete": "complete",
  "kb06.milestones": "Milestones",
  "kb06.empty": "No milestones to show yet.",
  "kb06.loading": "Loading this goal…",
  "kb06.unavailable": "This goal isn't available.",
  "kb06.unavailableHelp": "Open Goals to choose another.",
  "kb06.offline": "You're offline. Changes may need another try when you're back.",
  "kb06.error": "This goal couldn't load.",
  "kb06.retry": "Try again",
  "kb06.gallery": "Goal detail preview",
  "kb06.galleryDefault": "Goal",
  "kb06.galleryEmpty": "Empty",
  "kb06.galleryLoading": "Loading",
  "kb06.galleryError": "Error",
  "kb06.galleryDisabled": "Disabled",
  "kb06.galleryOverflow": "Long text",
  "kb06.galleryEn": "English",
  "kb06.galleryHe": "עברית",
  "kb06.galleryRetryCount": "Retries: {count}",
  "kb06.galleryGoal": "A calmer home for Maya",
  "kb06.galleryLong": "Find a calm home close to work with enough room to welcome Dana and Yoni, and time to settle in at a comfortable pace",
} as const;

export const he: Record<keyof typeof en, string> = {
  "kb06.progress": "התקדמות",
  "kb06.complete": "הושלמו",
  "kb06.milestones": "אבני דרך",
  "kb06.empty": "אין עדיין אבני דרך להצגה.",
  "kb06.loading": "טוענים את היעד…",
  "kb06.unavailable": "היעד הזה לא זמין.",
  "kb06.unavailableHelp": "אפשר לפתוח את היעדים ולבחור יעד אחר.",
  "kb06.offline": "אין חיבור לרשת. ייתכן שיהיה צורך לנסות לשמור שוב כשיחזור החיבור.",
  "kb06.error": "אי אפשר לטעון את היעד הזה.",
  "kb06.retry": "לנסות שוב",
  "kb06.gallery": "תצוגה מקדימה של יעד",
  "kb06.galleryDefault": "יעד",
  "kb06.galleryEmpty": "ריק",
  "kb06.galleryLoading": "טעינה",
  "kb06.galleryError": "שגיאה",
  "kb06.galleryDisabled": "לא זמין",
  "kb06.galleryOverflow": "טקסט ארוך",
  "kb06.galleryEn": "English",
  "kb06.galleryHe": "עברית",
  "kb06.galleryRetryCount": "ניסיונות חוזרים: {count}",
  "kb06.galleryGoal": "בית רגוע למאיה",
  "kb06.galleryLong": "למצוא בית רגוע קרוב לעבודה, עם מספיק מקום לארח את דנה ואת יוני, וזמן להתמקם בקצב נוח",
};

export type Kb06Key = keyof typeof en;

export function tKb06(lang: "en" | "he", key: Kb06Key, count?: number): string {
  const message = (lang === "he" ? he : en)[key];
  return count === undefined ? message : message.replace("{count}", String(count));
}
