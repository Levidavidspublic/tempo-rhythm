/** KB-45 sign-up guidance. Hebrew is machine-drafted for Amit's native read. */
export const en = {
  "signup.nextTitle": "What happens next",
  "signup.nextBody": "We email a sign-in link. New accounts wait for Amit's approval after opening it.",
  "signup.waitingTitle": "Waiting for approval",
  "signup.waitingBody": "Amit reviews new accounts by hand. The waiting page shows when to continue.",
  "signup.approvedTitle": "After approval",
  "signup.approvedBody": "Once approved, sign in to continue.",
  "signup.privacyIntro": "By continuing, you agree to the",
  "signup.terms": "Terms of Service",
  "signup.and": "and",
  "signup.privacy": "Privacy Policy",
  "signup.gallery.title": "Sign-up guidance preview",
  "signup.gallery.default": "Default",
  "signup.gallery.empty": "Empty",
  "signup.gallery.loading": "Loading",
  "signup.gallery.error": "Error",
  "signup.gallery.disabled": "Disabled",
  "signup.gallery.overflow": "Long text",
  "signup.gallery.waiting": "Waiting copy",
  "signup.gallery.approved": "Approved copy",
  "signup.gallery.emptyText": "No status to show in this example.",
  "signup.gallery.loadingText": "Loading this example…",
  "signup.gallery.errorText": "This example did not load. Try again.",
  "signup.gallery.disabledText": "This example is unavailable right now.",
  "signup.gallery.retry": "Try again",
  "signup.gallery.longText": "This example uses a longer explanation to check that text wraps inside the sign-up card even on a narrow screen.",
} as const;

export const he: Record<keyof typeof en, string> = {
  "signup.nextTitle": "מה קורה בהמשך",
  "signup.nextBody": "נשלח קישור כניסה בדוא״ל. חשבונות חדשים ממתינים לאישור של עמית לאחר פתיחת הקישור.",
  "signup.waitingTitle": "ממתינים לאישור",
  "signup.waitingBody": "עמית בודק חשבונות חדשים באופן אישי. דף ההמתנה יציג מתי הגישה מוכנה.",
  "signup.approvedTitle": "אחרי האישור",
  "signup.approvedBody": "לאחר האישור, אפשר להיכנס ולהמשיך.",
  "signup.privacyIntro": "בהמשך השימוש, מאשרים את",
  "signup.terms": "תנאי השימוש",
  "signup.and": "ואת",
  "signup.privacy": "מדיניות הפרטיות",
  "signup.gallery.title": "תצוגת הנחיות ההרשמה",
  "signup.gallery.default": "ברירת מחדל",
  "signup.gallery.empty": "ריק",
  "signup.gallery.loading": "בטעינה",
  "signup.gallery.error": "שגיאה",
  "signup.gallery.disabled": "לא זמין",
  "signup.gallery.overflow": "טקסט ארוך",
  "signup.gallery.waiting": "נוסח המתנה",
  "signup.gallery.approved": "נוסח לאחר אישור",
  "signup.gallery.emptyText": "אין מצב להצגה בדוגמה הזו.",
  "signup.gallery.loadingText": "טוענים את הדוגמה…",
  "signup.gallery.errorText": "הדוגמה לא נטענה. אפשר לנסות שוב.",
  "signup.gallery.disabledText": "הדוגמה הזו אינה זמינה כרגע.",
  "signup.gallery.retry": "ניסיון חוזר",
  "signup.gallery.longText": "הדוגמה הזו כוללת הסבר ארוך יותר כדי לבדוק שהטקסט נשאר בתוך כרטיס ההרשמה גם במסך צר.",
};

export type Kb45Key = keyof typeof en;
export type Kb45Lang = "en" | "he";
export function kb45t(lang: Kb45Lang, key: Kb45Key): string {
  return (lang === "he" ? he : en)[key];
}
