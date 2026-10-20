type Copy = {
  title: string;
  fictional: string;
  open: string;
  guidance: string;
  confirmTitle: string;
  body: string;
  confirm: string;
  cancel: string;
  pending: string;
  finish: string;
  reject: string;
  success: string;
  error: string;
};

// Hebrew is machine-drafted for native review; keep instructions impersonal.
export const kb78Copy: Record<"en" | "he", Copy> = {
  en: {
    title: "Confirm dialog examples",
    fictional: "A fictional connection. No account is changed.",
    open: "Open confirmation",
    guidance: "Keyboard focus stays in the dialog while the example is waiting.",
    confirmTitle: "Disconnect the fictional connection?",
    body: "This example waits after confirmation so the keyboard controls can be tried.",
    confirm: "Disconnect example",
    cancel: "Keep it connected",
    pending: "Disconnecting example…",
    finish: "Finish example",
    reject: "Show error example",
    success: "The fictional connection is disconnected.",
    error: "The example could not finish. The connection stays as it was.",
  },
  he: {
    title: "דוגמאות לחלון אישור",
    fictional: "חיבור לדוגמה בלבד. לא מתבצע שינוי בחשבון.",
    open: "פתיחת חלון אישור",
    guidance: "מיקוד המקלדת נשאר בחלון בזמן שהדוגמה ממתינה.",
    confirmTitle: "לנתק את החיבור לדוגמה?",
    body: "הדוגמה ממתינה לאחר האישור כדי לאפשר בדיקה של פעולות המקלדת.",
    confirm: "ניתוק לדוגמה",
    cancel: "להשאיר את החיבור",
    pending: "הניתוק לדוגמה מתבצע…",
    finish: "סיום הדוגמה",
    reject: "הצגת דוגמה לשגיאה",
    success: "החיבור לדוגמה נותק.",
    error: "לא ניתן לסיים את הדוגמה. החיבור נשאר כפי שהיה.",
  },
};
