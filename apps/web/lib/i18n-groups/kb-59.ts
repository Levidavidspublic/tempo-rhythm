type Kb59Copy = {
  saving: string;
  error: string;
  galleryTitle: string;
  galleryBody: string;
  nextSave: string;
  success: string;
  showError: string;
  stored: string;
};

// Hebrew is machine-drafted for native review; wording stays plural/impersonal.
export const kb59Copy: Record<"en" | "he", Kb59Copy> = {
  en: {
    saving: "Saving this choice… You can change it again.",
    error:
      "This choice could not be saved. The stored choice is shown. Change the switch to try again.",
    galleryTitle: "Coach web search",
    galleryBody: "Choose how the next save responds, then change the switch.",
    nextSave: "Next save",
    success: "Save succeeds",
    showError: "Show save error",
    stored: "Stored choice:",
  },
  he: {
    saving: "הבחירה נשמרת… אפשר לשנות אותה שוב.",
    error: "לא ניתן לשמור את הבחירה. מוצגת הבחירה השמורה. אפשר לשנות את המתג כדי לנסות שוב.",
    galleryTitle: "חיפוש ברשת עם המלווה",
    galleryBody: "אפשר לבחור כיצד השמירה הבאה תגיב, ואז לשנות את המתג.",
    nextSave: "השמירה הבאה",
    success: "שמירה מוצלחת",
    showError: "הצגת שגיאת שמירה",
    stored: "הבחירה השמורה:",
  },
};
