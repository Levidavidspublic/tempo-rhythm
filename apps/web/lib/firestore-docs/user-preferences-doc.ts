export type UserPreferencesDoc = {
  theme: "system" | "light" | "dark";
  locale: "en" | "he";
  weekStartsOn: 0 | 1 | 6;
  timeZone: string;
  emailReminders: boolean;
  inAppNotifications: boolean;
  coachWebSearch?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type UserPreferencesDocCheck =
  | { ok: true; doc: UserPreferencesDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof UserPreferencesDoc>([
  "theme",
  "locale",
  "weekStartsOn",
  "timeZone",
  "emailReminders",
  "inAppNotifications",
  "coachWebSearch",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function check(input: unknown): UserPreferencesDocCheck {
  if (typeof input !== "object" || input === null) {
    return { ok: false, reason: "Preferences must be a plain object" };
  }

  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, reason: "Preferences must be a plain object" };
  }

  const keys = Reflect.ownKeys(input);
  const unknownKey = keys.find(
    (key) => typeof key !== "string" || !allowedKeys.has(key as keyof UserPreferencesDoc),
  );
  if (unknownKey !== undefined) {
    return { ok: false, reason: `Unknown preference field: ${String(unknownKey)}` };
  }

  const doc = input as Record<string, unknown>;
  if (doc.theme !== "system" && doc.theme !== "light" && doc.theme !== "dark") {
    return { ok: false, reason: "Invalid theme" };
  }
  if (doc.locale !== "en" && doc.locale !== "he") {
    return { ok: false, reason: "Invalid locale" };
  }
  if (doc.weekStartsOn !== 0 && doc.weekStartsOn !== 1 && doc.weekStartsOn !== 6) {
    return { ok: false, reason: "Invalid week start" };
  }
  if (typeof doc.timeZone !== "string") {
    return { ok: false, reason: "Invalid time zone" };
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: doc.timeZone });
  } catch {
    return { ok: false, reason: "Invalid time zone" };
  }
  if (typeof doc.emailReminders !== "boolean") {
    return { ok: false, reason: "Invalid email reminders setting" };
  }
  if (typeof doc.inAppNotifications !== "boolean") {
    return { ok: false, reason: "Invalid in-app notifications setting" };
  }
  if ("coachWebSearch" in doc && typeof doc.coachWebSearch !== "boolean") {
    return { ok: false, reason: "Invalid coach web search setting" };
  }
  if (typeof doc.createdAt !== "number" || !Number.isFinite(doc.createdAt)) {
    return { ok: false, reason: "Invalid creation time" };
  }
  if (typeof doc.updatedAt !== "number" || !Number.isFinite(doc.updatedAt)) {
    return { ok: false, reason: "Invalid update time" };
  }
  if ("deletedAt" in doc && (typeof doc.deletedAt !== "number" || !Number.isFinite(doc.deletedAt))) {
    return { ok: false, reason: "Invalid deletion time" };
  }

  return { ok: true, doc: input as UserPreferencesDoc };
}

export function checkUserPreferencesDoc(input: unknown): UserPreferencesDocCheck {
  try {
    return check(input);
  } catch {
    return { ok: false, reason: "Preferences could not be read" };
  }
}

export function defaultUserPreferences(now: number): UserPreferencesDoc {
  return {
    theme: "system",
    locale: "en",
    weekStartsOn: 1,
    timeZone: "UTC",
    emailReminders: true,
    inAppNotifications: true,
    createdAt: now,
    updatedAt: now,
  };
}
