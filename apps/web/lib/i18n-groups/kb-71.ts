/** Hebrew copy is machine-drafted for Amit's native review. */
export const en = {
  title: "Buttons on a phone",
  lede: "Each action has room to tap and a clear keyboard focus.",
  small: "Small action",
  default: "Default action",
  large: "Large action",
  iconName: "Add item",
  destructive: "Remove item",
  ghost: "Quiet action",
  linkStyle: "Text action",
  disabled: "Unavailable action",
  long: "A longer action label that can wrap comfortably on a narrow phone",
  slottedLink: "Open today",
} as const;

export const he: Record<keyof typeof en, string> = {
  title: "כפתורים בטלפון",
  lede: "לכל פעולה יש מקום נוח ללחיצה ומיקוד ברור במקלדת.",
  small: "פעולה קטנה",
  default: "פעולה רגילה",
  large: "פעולה גדולה",
  iconName: "הוספת פריט",
  destructive: "הסרת פריט",
  ghost: "פעולה שקטה",
  linkStyle: "פעולת טקסט",
  disabled: "פעולה לא זמינה",
  long: "תיאור ארוך של פעולה שיכול להישבר לשורות בנוחות בטלפון צר",
  slottedLink: "פתיחת היום",
};

export type Kb71Lang = "en" | "he";
export type Kb71Key = keyof typeof en;

export function kb71t(lang: Kb71Lang, key: Kb71Key): string {
  return (lang === "he" ? he : en)[key];
}
