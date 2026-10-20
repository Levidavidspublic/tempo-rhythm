/** Hebrew copy is machine-drafted for Amit's native review. */
export const en = {
  title: "Room to write",
  lede: "Each field has a clear label and room to tap.",
  text: "A small intention",
  time: "Start time",
  invalid: "A name for this plan",
  error: "Add a name when you are ready.",
  disabled: "Not available yet",
  readOnly: "Saved intention",
  long: "A longer intention for a quiet afternoon with Maya, Dana and Yoni, with room for the words to wrap",
  intention: "Read with Maya",
  saved: "Walk with Dana",
  later: "Plan with Yoni",
} as const;

export const he: Record<keyof typeof en, string> = {
  title: "מקום לכתוב",
  lede: "לכל שדה יש תווית ברורה ומקום נוח ללחיצה.",
  text: "כוונה קטנה",
  time: "שעת התחלה",
  invalid: "שם לתוכנית",
  error: "אפשר להוסיף שם כשמתאים.",
  disabled: "עדיין לא זמין",
  readOnly: "כוונה שמורה",
  long: "כוונה ארוכה יותר לאחר צהריים שקטים עם מאיה, דנה ויוני, עם מקום למילים לעבור לשורה הבאה",
  intention: "לקרוא עם מאיה",
  saved: "לצאת להליכה עם דנה",
  later: "לתכנן עם יוני",
};

export type Kb77Lang = "en" | "he";
export type Kb77Key = keyof typeof en;

export function kb77t(lang: Kb77Lang, key: Kb77Key): string {
  return (lang === "he" ? he : en)[key];
}
