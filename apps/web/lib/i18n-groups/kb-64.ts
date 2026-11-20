export const en = {
  removed: "Note removed.",
  undo: "Undo",
  pending: "Undoing…",
  error: "That couldn't be undone. Try again before the Undo window ends.",
  retry: "Try Undo again",
  galleryTitle: "Note Undo",
  galleryNote: "Maya’s reading list: a few pages to read with Dana and Yoni.",
  language: "עברית",
  removeNote: "Remove Maya’s note",
  endWindow: "End the Undo window",
} as const;

// Machine-drafted Hebrew; needs Amit's native read.
export const he: Record<keyof typeof en, string> = {
  removed: "הפתק הוסר.",
  undo: "ביטול ההסרה",
  pending: "ההסרה מתבטלת…",
  error: "לא ניתן היה לבטל את ההסרה. אפשר לנסות שוב לפני שחלון הביטול מסתיים.",
  retry: "ניסיון נוסף לביטול ההסרה",
  galleryTitle: "ביטול הסרת פתק",
  galleryNote: "רשימת הקריאה של מאיה: כמה עמודים לקריאה עם דנה ויוני.",
  language: "English",
  removeNote: "הסרת הפתק של מאיה",
  endWindow: "סיום חלון הביטול",
};

export function kb64t(lang: "en" | "he", key: keyof typeof en): string {
  return (lang === "he" ? he : en)[key];
}
