import {
  checkUserPreferencesDoc,
  defaultUserPreferences,
  type UserPreferencesDoc,
} from "../firestore-docs/user-preferences-doc";
import { stampUpdate } from "./write-stamps";

export const PREFERENCE_FIELDS = [
  "theme",
  "locale",
  "weekStartsOn",
  "timeZone",
  "emailReminders",
  "inAppNotifications",
  "coachWebSearch",
] as const;

type PreferenceField = (typeof PREFERENCE_FIELDS)[number];

export type PreferencesSavePlan =
  | { ok: true; kind: "create"; doc: UserPreferencesDoc }
  | {
      ok: true;
      kind: "update";
      patch: Partial<UserPreferencesDoc> & { updatedAt: number };
      changedFields: string[];
    }
  | { ok: true; kind: "no-change" }
  | {
      ok: false;
      reason:
        | "invalid-edits"
        | "unknown-field"
        | "invalid-stored"
        | "deleted"
        | "invalid-value"
        | "invalid-now";
      field?: string;
    };

function isPlainObject(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== "object" || value === null) return false;

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

export function planPreferencesSave(
  stored: unknown | null,
  edits: unknown,
  now: number
): PreferencesSavePlan {
  if (!Number.isFinite(now) || now <= 0) return { ok: false, reason: "invalid-now" };
  if (!isPlainObject(edits)) return { ok: false, reason: "invalid-edits" };

  let editKeys: PropertyKey[];
  try {
    editKeys = Reflect.ownKeys(edits);
  } catch {
    return { ok: false, reason: "invalid-edits" };
  }

  const unknownKey = editKeys.find(
    (key) => typeof key !== "string" || !(PREFERENCE_FIELDS as readonly string[]).includes(key)
  );
  if (unknownKey !== undefined) {
    return { ok: false, reason: "unknown-field", field: String(unknownKey) };
  }

  const settings = edits as Partial<Record<PreferenceField, unknown>>;

  if (stored === null) {
    const candidate = { ...defaultUserPreferences(now), ...settings };
    const checked = checkUserPreferencesDoc(candidate);
    return checked.ok
      ? { ok: true, kind: "create", doc: checked.doc }
      : { ok: false, reason: "invalid-value" };
  }

  const checkedStored = checkUserPreferencesDoc(stored);
  if (!checkedStored.ok) return { ok: false, reason: "invalid-stored" };
  if (checkedStored.doc.deletedAt !== undefined) return { ok: false, reason: "deleted" };

  const changes: Partial<Record<PreferenceField, unknown>> = {};
  const changedSettings: PreferenceField[] = [];
  for (const field of PREFERENCE_FIELDS) {
    if (Object.hasOwn(settings, field) && settings[field] !== checkedStored.doc[field]) {
      changes[field] = settings[field];
      changedSettings.push(field);
    }
  }

  if (changedSettings.length === 0) return { ok: true, kind: "no-change" };

  const candidate = { ...checkedStored.doc, ...changes, updatedAt: now };
  if (!checkUserPreferencesDoc(candidate).ok) return { ok: false, reason: "invalid-value" };

  const patch = stampUpdate(changes, now) as Partial<UserPreferencesDoc> & {
    updatedAt: number;
  };
  return {
    ok: true,
    kind: "update",
    patch,
    changedFields: [...changedSettings, "updatedAt"],
  };
}
