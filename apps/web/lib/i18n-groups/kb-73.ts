/** Landing theme control copy. Hebrew is machine-drafted for native review. */
export const en = {
  switchDark: "Switch to dark mode",
  switchLight: "Switch to light mode",
  galleryTitle: "Landing theme control",
  galleryLanguage: "Language",
  galleryPreference: "Theme preference",
  galleryResolved: "Appearance",
  galleryEnglish: "English",
  galleryHebrew: "עברית",
  system: "System",
  light: "Light",
  dark: "Dark",
} as const;

export const he: Record<keyof typeof en, string> = {
  switchDark: "מעבר למצב כהה",
  switchLight: "מעבר למצב בהיר",
  galleryTitle: "בקרת מראה בדף הבית",
  galleryLanguage: "שפה",
  galleryPreference: "העדפת מראה",
  galleryResolved: "מראה נוכחי",
  galleryEnglish: "English",
  galleryHebrew: "עברית",
  system: "לפי המערכת",
  light: "בהיר",
  dark: "כהה",
};

export type Kb73Key = keyof typeof en;
export function tKb73(lang: "en" | "he", key: Kb73Key): string {
  return (lang === "he" ? he : en)[key];
}
