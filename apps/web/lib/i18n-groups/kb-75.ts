export type Kb75Lang = "en" | "he";
export type Kb75Status = "pending" | "approved" | "revoked";

type Kb75Copy = {
  title: string;
  loading: string;
  loadingAccounts: string;
  adminsOnly: string;
  adminsOnlyDetail: string;
  empty: string;
  shownCount: (pending: number, shown: number) => string;
  status: Record<Kb75Status, string>;
  admin: string;
  joined: string;
  approve: string;
  revoke: string;
  reset: string;
  retry: string;
  saving: (status: Kb75Status) => string;
  saved: (status: Kb75Status) => string;
  saveError: (status: Kb75Status) => string;
  actionName: (action: string, email: string) => string;
  galleryControls: string;
  galleryModes: Record<"loading" | "empty" | "loaded", string>;
  galleryKinds: Record<"pending" | "success" | "error", string>;
};

// Hebrew is machine-drafted for native review. Keep plurals impersonal.
export const kb75Copy: Record<Kb75Lang, Kb75Copy> = {
  en: {
    title: "Account approvals",
    loading: "Loading account approvals…",
    loadingAccounts: "Loading accounts…",
    adminsOnly: "Admins only",
    adminsOnlyDetail: "This page is for the Tempo admin.",
    empty: "No accounts are shown yet.",
    shownCount: (pending, shown) =>
      `${pending} waiting for approval among ${shown} accounts shown (up to 500).`,
    status: { pending: "Pending", approved: "Approved", revoked: "Revoked" },
    admin: "admin",
    joined: "Joined",
    approve: "Approve",
    revoke: "Revoke",
    reset: "Back to pending",
    retry: "Try again",
    saving: (status) => `Saving ${kb75Copy.en.status[status].toLowerCase()} choice for`,
    saved: (status) => `${kb75Copy.en.status[status]} choice saved for`,
    saveError: (status) => `Could not save ${kb75Copy.en.status[status].toLowerCase()} choice for`,
    actionName: (action, email) => `${action} ${email}`,
    galleryControls: "Gallery controls",
    galleryModes: { loading: "Loading", empty: "Empty", loaded: "Loaded" },
    galleryKinds: { pending: "Saving", success: "Saved", error: "Could not save" },
  },
  he: {
    title: "אישורי חשבונות",
    loading: "אישורי החשבונות בטעינה…",
    loadingAccounts: "החשבונות בטעינה…",
    adminsOnly: "למנהלי מערכת בלבד",
    adminsOnlyDetail: "העמוד הזה מיועד למנהלי Tempo.",
    empty: "עדיין לא מוצגים חשבונות.",
    shownCount: (pending, shown) =>
      `ממתינים לאישור: ${pending} מתוך ${shown} חשבונות מוצגים (עד 500).`,
    status: { pending: "ממתין", approved: "מאושר", revoked: "הגישה בוטלה" },
    admin: "מנהל מערכת",
    joined: "תאריך הצטרפות",
    approve: "אישור",
    revoke: "ביטול גישה",
    reset: "החזרה להמתנה",
    retry: "ניסיון חוזר",
    saving: (status) => `השינוי למצב ${kb75Copy.he.status[status]} מתבצע עבור`,
    saved: (status) => `השינוי למצב ${kb75Copy.he.status[status]} נשמר עבור`,
    saveError: (status) => `לא ניתן לשמור שינוי למצב ${kb75Copy.he.status[status]} עבור`,
    actionName: (action, email) => `${action} עבור ${email}`,
    galleryControls: "בקרות תצוגה",
    galleryModes: { loading: "בטעינה", empty: "ריק", loaded: "מוצג" },
    galleryKinds: { pending: "בשמירה", success: "נשמר", error: "לא ניתן לשמור" },
  },
};
