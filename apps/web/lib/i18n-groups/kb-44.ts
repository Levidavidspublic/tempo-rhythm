/** Onboarding progress and resume copy. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  "summary": "Step {step} of {total}",
  "summary.aria": "Onboarding progress: step {step} of {total}",
  "resume.title": "Welcome back to step {step}.",
  "resume.body": "After a refresh, check earlier choices before finishing.",
  "resume.review": "Review earlier steps",
  "optional": "This step is optional. You can change it later.",
  "gallery.title": "Onboarding preview",
  "gallery.language": "Preview language",
  "gallery.state": "Preview state",
  "gallery.default": "Default",
  "gallery.empty": "Empty",
  "gallery.loading": "Loading",
  "gallery.error": "Error",
  "gallery.disabled": "Disabled",
  "gallery.overflow": "Long input",
  "gallery.resume": "Resume",
  "gallery.pendingState": "Pending",
  "gallery.name": "Name for the coach",
  "gallery.next": "Continue",
  "gallery.back": "Back",
  "gallery.pending": "Saving…",
  "gallery.errorTitle": "That didn't save.",
  "gallery.errorBody": "What you entered is still here. Try again.",
  "gallery.retry": "Try again",
  "gallery.loadingLabel": "Loading setup preview",
  "gallery.feedback": "Action: {action}",
} as const;

// Machine-drafted Hebrew; needs Amit's native read.
export const he: Record<keyof typeof en, string> = {
  "summary": "שלב {step} מתוך {total}",
  "summary.aria": "התקדמות ההגדרה: שלב {step} מתוך {total}",
  "resume.title": "חזרה לשלב {step}.",
  "resume.body": "אחרי רענון, כדאי לבדוק את הבחירות הקודמות לפני הסיום.",
  "resume.review": "בדיקת השלבים הקודמים",
  "optional": "השלב הזה אינו חובה. אפשר לשנות אותו אחר כך.",
  "gallery.title": "תצוגה מקדימה של ההגדרה",
  "gallery.language": "שפת התצוגה המקדימה",
  "gallery.state": "מצב התצוגה המקדימה",
  "gallery.default": "רגיל",
  "gallery.empty": "ריק",
  "gallery.loading": "טעינה",
  "gallery.error": "שגיאה",
  "gallery.disabled": "לא זמין",
  "gallery.overflow": "טקסט ארוך",
  "gallery.resume": "חזרה",
  "gallery.pendingState": "בהמתנה",
  "gallery.name": "שם למלווה",
  "gallery.next": "המשך",
  "gallery.back": "חזרה",
  "gallery.pending": "שומרים…",
  "gallery.errorTitle": "השמירה לא הצליחה.",
  "gallery.errorBody": "מה שנכתב עדיין כאן. אפשר לנסות שוב.",
  "gallery.retry": "לנסות שוב",
  "gallery.loadingLabel": "טוענים את תצוגת ההגדרה",
  "gallery.feedback": "פעולה: {action}",
};

export type Kb44Lang = "en" | "he";
export type Kb44Key = keyof typeof en;

export function translateKb44(lang: Kb44Lang, key: Kb44Key, values: Record<string, string | number> = {}) {
  return (lang === "he" ? he : en)[key].replace(/\{(\w+)\}/g, (_match, field: string) => String(values[field] ?? ""));
}
