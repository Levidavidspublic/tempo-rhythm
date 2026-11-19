export const PROFILE_FIELDS = ["name", "fullName", "onboardedAt"] as const;

export const GATE_FIELDS = [
  "email",
  "emailVerificationTime",
  "emailVerified",
  "role",
  "userType",
  "betaAccess",
  "entitlementTier",
  "isGodTier",
  "betaApprovedAt",
  "isActive",
  "approvalStatus",
  "approvalUpdatedAt",
  "approvalUpdatedBy",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const;

export type ProfilePatch = {
  name?: string;
  fullName?: string;
  onboardedAt?: number;
};

type ProfilePatchResult =
  | { ok: true; patch: ProfilePatch }
  | { ok: false; reason: string; field?: string };

const PROFILE_FIELD_SET = new Set<string>(PROFILE_FIELDS);
const GATE_FIELD_SET = new Set<string>(GATE_FIELDS);

export function checkProfilePatch(input: unknown): ProfilePatchResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "invalid-input" };
  }

  try {
    const entries = Object.entries(input);
    if (entries.length === 0) {
      return { ok: false, reason: "empty-patch" };
    }

    const gateEntry = entries.find(([field]) => GATE_FIELD_SET.has(field));
    if (gateEntry) {
      return { ok: false, reason: "gate-field", field: gateEntry[0] };
    }

    const unknownEntry = entries.find(
      ([field]) => !PROFILE_FIELD_SET.has(field),
    );
    if (unknownEntry) {
      return { ok: false, reason: "unknown-field", field: unknownEntry[0] };
    }

    const patch: ProfilePatch = {};
    for (const [field, value] of entries) {
      if (field === "onboardedAt") {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          value <= 0
        ) {
          return { ok: false, reason: "invalid-value", field };
        }
        patch.onboardedAt = value;
        continue;
      }

      if (typeof value !== "string") {
        return { ok: false, reason: "invalid-value", field };
      }
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed.length > 120) {
        return { ok: false, reason: "invalid-value", field };
      }
      if (field === "name") {
        patch.name = trimmed;
      } else {
        patch.fullName = trimmed;
      }
    }

    return { ok: true, patch };
  } catch {
    return { ok: false, reason: "invalid-input" };
  }
}
