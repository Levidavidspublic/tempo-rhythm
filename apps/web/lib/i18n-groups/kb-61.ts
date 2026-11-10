type Kb61Copy = {
  saving: string;
  closing: string;
  error: string;
  retry: string;
  galleryTitle: string;
  galleryOpen: string;
  galleryNext: string;
  gallerySuccess: string;
  galleryError: string;
  gallerySaved: string;
};

// Hebrew is machine-drafted for native review; wording stays plural/impersonal.
export const kb61Copy: Record<"en" | "he", Kb61Copy> = {
  en: {
    saving: "Saving habit…",
    closing: "Closing this sheet does not cancel the save.",
    error: "Could not save the habit. Your draft is still here. Try saving again.",
    retry: "Try saving again",
    galleryTitle: "Habit sheet",
    galleryOpen: "Open habit sheet",
    galleryNext: "Next save",
    gallerySuccess: "Save succeeds",
    galleryError: "Show save error",
    gallerySaved: "Habits saved",
  },
  he: {
    saving: "ההרגל נשמר…",
    closing: "סגירת החלונית אינה מבטלת את השמירה.",
    error: "לא ניתן לשמור את ההרגל. הטיוטה עדיין כאן. אפשר לנסות לשמור שוב.",
    retry: "ניסיון שמירה נוסף",
    galleryTitle: "חלונית הרגל",
    galleryOpen: "פתיחת חלונית הרגל",
    galleryNext: "השמירה הבאה",
    gallerySuccess: "שמירה מוצלחת",
    galleryError: "הצגת שגיאת שמירה",
    gallerySaved: "הרגלים שנשמרו",
  },
};
