import {
  checkProfilePatch,
  PROFILE_FIELDS,
  type ProfilePatch,
} from "../firestore-docs/profile-doc";

export const PROFILE_NAME_MAX = 80;

type StoredProfile = {
  name?: string;
  fullName?: string;
  onboardedAt?: number;
};

type OnboardingFinishPlan =
  | { ok: true; patch: ProfilePatch; changedFields: string[] }
  | { ok: true; kind: "no-change" }
  | { ok: false; reason: "invalid-now" | "invalid-patch" };

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) return undefined;

  let cut = collapsed.slice(0, PROFILE_NAME_MAX);
  const finalCodeUnit = cut.charCodeAt(cut.length - 1);
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut || undefined;
}

export function planOnboardingFinish(
  stored: StoredProfile | null,
  typedName: unknown,
  now: number
): OnboardingFinishPlan {
  if (!Number.isFinite(now) || now <= 0) {
    return { ok: false, reason: "invalid-now" };
  }

  const name = cleanName(typedName);
  const candidate: ProfilePatch = {};

  if (name && name !== stored?.name) candidate.name = name;
  if (name && stored?.fullName === undefined) candidate.fullName = name;
  if (stored?.onboardedAt === undefined) candidate.onboardedAt = now;

  if (Object.keys(candidate).length === 0) {
    return { ok: true, kind: "no-change" };
  }

  const checked = checkProfilePatch(candidate);
  if (!checked.ok) return { ok: false, reason: "invalid-patch" };

  return {
    ok: true,
    patch: checked.patch,
    changedFields: PROFILE_FIELDS.filter((field) => field in checked.patch),
  };
}
