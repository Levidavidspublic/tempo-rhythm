import {
  COACH_SETTINGS_DEFAULTS,
  type CoachSettingsDoc,
  CoachSettingsDocError,
  parseCoachSettingsDoc,
} from "../firestore-docs/coach-settings-doc";

type CoachSettingsEdits = {
  dial?: number;
  taskLoad?: number;
};

export function planCoachSettingsSave(
  stored: CoachSettingsDoc | null,
  edits: CoachSettingsEdits,
  now: number
) {
  if (Object.keys(edits).some((key) => key !== "dial" && key !== "taskLoad")) {
    return { ok: false as const, reason: "unknown-setting" as const };
  }

  if (stored?.deletedAt !== undefined) {
    return { ok: false as const, reason: "deleted" as const };
  }

  if (stored !== null) {
    try {
      parseCoachSettingsDoc(stored);
    } catch (error) {
      if (error instanceof CoachSettingsDocError) {
        return { ok: false as const, reason: "invalid" as const };
      }
      throw error;
    }
  }

  const dial = Object.hasOwn(edits, "dial") ? edits.dial : undefined;
  const taskLoad = Object.hasOwn(edits, "taskLoad") ? edits.taskLoad : undefined;
  const snapshot = {
    ...(dial !== undefined ? { dial } : {}),
    ...(taskLoad !== undefined ? { taskLoad } : {}),
  };

  const candidate = {
    ...(stored ?? COACH_SETTINGS_DEFAULTS),
    ...snapshot,
    updatedAt: now,
  };

  try {
    parseCoachSettingsDoc(candidate);
  } catch (error) {
    if (error instanceof CoachSettingsDocError) {
      return { ok: false as const, reason: "invalid" as const };
    }
    throw error;
  }

  if (stored === null) {
    return { ok: true as const, kind: "create" as const, doc: candidate };
  }

  const patch: Partial<Pick<CoachSettingsDoc, "dial" | "taskLoad" | "updatedAt">> = {};
  if (dial !== undefined && dial !== stored.dial) patch.dial = dial;
  if (taskLoad !== undefined && taskLoad !== stored.taskLoad) patch.taskLoad = taskLoad;

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, reason: "no-change" as const };
  }

  patch.updatedAt = now;
  const changed = Object.keys(patch).sort();
  return { ok: true as const, kind: "update" as const, patch, changed };
}
