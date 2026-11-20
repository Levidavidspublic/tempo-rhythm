export const GRANTED_ENTITLEMENT_TIER = "max";
export const GRANTED_USER_TYPE = "paid";
export const GRANTED_BETA_ACCESS = "tester";

type ExistingGate = {
  entitlementTier?: string;
  userType?: string;
  betaAccess?: string;
};

type SignInProfile = {
  email: string;
  emailVerified?: boolean;
  fullName?: string;
};

type ReturningSignInPatches = {
  gate: Record<string, string | number | boolean>;
  profile: { fullName?: string };
};

export function returningSignInPatches(
  existing: ExistingGate,
  profile: SignInProfile,
  now: number,
): ReturningSignInPatches {
  const gate: ReturningSignInPatches["gate"] = {
    email: profile.email,
    emailVerified: profile.emailVerified ?? false,
    updatedAt: now,
  };

  if (
    existing.entitlementTier === undefined ||
    existing.entitlementTier === "none" ||
    existing.entitlementTier === "god"
  ) {
    gate.entitlementTier = GRANTED_ENTITLEMENT_TIER;
  }

  if (existing.userType === undefined) {
    gate.userType = GRANTED_USER_TYPE;
  }

  if (existing.betaAccess === undefined) {
    gate.betaAccess = GRANTED_BETA_ACCESS;
  }

  const fullName = profile.fullName?.trim();
  const profilePatch =
    fullName && fullName !== "User" ? { fullName } : {};

  return { gate, profile: profilePatch };
}
