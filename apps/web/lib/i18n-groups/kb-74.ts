// Hebrew copy is machine-drafted for Amit's native-language review.
export const en = {
  "kb74.navigation": "Navigation",
  "kb74.closeNavigation": "Close navigation",
  "kb74.galleryTitle": "Navigation and focus",
  "kb74.galleryHint": "Use the menu button, Ctrl K, or Ctrl J to open the real shell controls.",
  "kb74.switchLanguage": "Switch language",
  "kb74.switchTheme": "Switch theme",
} as const;

export const he: Record<keyof typeof en, string> = {
  "kb74.navigation": "ניווט",
  "kb74.closeNavigation": "סגירת הניווט",
  "kb74.galleryTitle": "ניווט ומיקוד",
  "kb74.galleryHint": "אפשר לפתוח את פקדי המעטפת בעזרת כפתור התפריט, Ctrl K או Ctrl J.",
  "kb74.switchLanguage": "החלפת שפה",
  "kb74.switchTheme": "החלפת ערכת צבעים",
};

export function kb74t(lang: "en" | "he", key: keyof typeof en): string {
  return lang === "he" ? he[key] : en[key];
}
