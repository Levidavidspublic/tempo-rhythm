/** Optional onboarding goal copy. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  title: "A goal, if you want",
  help: "This is separate from your brain dump. Nothing is added until you choose Add goal.",
  name: "Goal",
  description: "A little more detail (optional)",
  add: "Add goal",
  update: "Save goal changes",
  saving: "Saving goal…",
  saved: "Saved. You can edit this goal in Goals after setup.",
  error: "We couldn't confirm this save. Your words are still here. Check Goals before trying again.",
  open: "Open Goals",
  gallery: "Optional goal preview",
  language: "Preview language",
} as const;

export const he: Record<keyof typeof en, string> = {
  title: "מטרה, אם רוצים",
  help: "זה נפרד מפריקת המחשבות. שום דבר לא נוסף עד שבוחרים בהוספת מטרה.",
  name: "מטרה",
  description: "עוד קצת פרטים (לא חובה)",
  add: "הוספת מטרה",
  update: "שמירת השינויים במטרה",
  saving: "שומרים את המטרה…",
  saved: "נשמר. אפשר לערוך את המטרה במסך המטרות אחרי ההגדרה.",
  error: "לא הצלחנו לאשר שהשמירה הושלמה. הטקסט עדיין כאן. אפשר לבדוק במסך המטרות לפני שמנסים שוב.",
  open: "פתיחת המטרות",
  gallery: "תצוגה מקדימה של מטרה לבחירה",
  language: "שפת התצוגה המקדימה",
};

export type OnboardingGoalLang = "en" | "he";

/** Local dictionary keeps this mounted feature within its three-file scope. */
export function translateOnboardingGoal(lang: OnboardingGoalLang, key: keyof typeof en): string {
  return (lang === "he" ? he : en)[key];
}
