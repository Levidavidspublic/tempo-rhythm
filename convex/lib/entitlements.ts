import type { Doc } from "../_generated/dataModel";

/**
 * Single source of truth for what an account is granted at sign-up.
 *
 * Signup is open: every account gets the top entitlement tier. These helpers are
 * deliberately PURE (no `ctx`, no `db`) so both write paths -- the Convex Auth
 * `createOrUpdateUser` callback in `convex/auth.ts` and the `createOrUpdateUser`
 * mutation in `convex/users.ts` -- share them and cannot drift apart again, and
 * so the regression test can call them directly.
 */

export type EntitlementTier = NonNullable<Doc<"users">["entitlementTier"]>;
export type UserType = NonNullable<Doc<"users">["userType"]>;
export type BetaAccess = NonNullable<Doc<"users">["betaAccess"]>;

// Annotated, not `satisfies`: `const x = "max" satisfies EntitlementTier` widens
// the declared type to `string`, which Convex's insert validator rejects.
export const GRANTED_ENTITLEMENT_TIER: EntitlementTier = "max";
export const GRANTED_USER_TYPE: UserType = "paid";
export const GRANTED_BETA_ACCESS: BetaAccess = "tester";

/**
 * The subscription row that backs the grant. `entitlementTier` alone unlocks
 * nothing -- `PremiumGate` reads `userType` and billing reads `subscriptionStates`.
 */
export const GRANTED_SUBSCRIPTION = {
  plan: "max",
  billingCycle: "lifetime",
  status: "active",
  trialUsed: true,
  source: "open_signup_grant",
} as const;

/** The identity fields both write paths receive from the auth provider. */
export type SignInProfile = {
  email: string;
  emailVerified?: boolean;
  fullName?: string;
};

/** Only the entitlement fields the returning-user rules need to look at. */
export type ReturningUserSnapshot = {
  entitlementTier?: EntitlementTier;
  userType?: UserType;
  betaAccess?: BetaAccess;
};

export type ReturningUserPatch = {
  email: string;
  emailVerified: boolean;
  /** Omitted when the provider has no real name. Never the placeholder "User". */
  fullName?: string;
  updatedAt: number;
  entitlementTier?: EntitlementTier;
  userType?: UserType;
  betaAccess?: BetaAccess;
};

/** A blank name, or the old placeholder "User", is not a name we store. */
function storedFullName(fullName: string | undefined): string | undefined {
  const trimmed = fullName?.trim();
  if (!trimmed || trimmed === "User") {
    return undefined;
  }
  return trimmed;
}

/**
 * Field set for a brand-new account. Everyone gets `max`, but the account starts
 * `approvalStatus: "pending"` (sign-up approval gate, convex/lib/approval.ts) unless
 * the caller passes "approved" (admin emails from TEMPO_ADMIN_EMAILS).
 */
export function newUserFields(
  profile: SignInProfile,
  now: number,
  approvalStatus: "pending" | "approved" = "pending",
) {
  const fullName = storedFullName(profile.fullName);
  return {
    email: profile.email,
    emailVerified: profile.emailVerified ?? false,
    ...(fullName ? { fullName } : {}),
    role: "user" as const,
    userType: GRANTED_USER_TYPE,
    betaAccess: GRANTED_BETA_ACCESS,
    entitlementTier: GRANTED_ENTITLEMENT_TIER,
    approvalStatus,
    approvalUpdatedAt: now,
    ...(approvalStatus === "approved" ? { betaApprovedAt: now } : {}),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Build the patch applied to a user who is signing in again.
 *
 * !! THE INVARIANT THIS FILE EXISTS FOR: this function must never return a key
 * whose value is `undefined`. Convex `db.patch` treats an `undefined` value as
 * "delete this field", so `{ entitlementTier: undefined }` silently strips a
 * paid account on its SECOND sign-in -- the first one looks perfect. Keys are
 * added conditionally, never assigned a possibly-undefined value.
 *
 * It also self-heals accounts already damaged by that bug, and normalizes the
 * retired `"god"` tier down to `"max"`. A real, already-granted value is left
 * alone so a RevenueCat/Polar downgrade is not stomped back to `paid` on
 * every sign-in.
 */
export function buildReturningUserPatch(
  existing: ReturningUserSnapshot,
  profile: SignInProfile,
  now: number,
): ReturningUserPatch {
  const fullName = storedFullName(profile.fullName);
  const patch: ReturningUserPatch = {
    email: profile.email,
    emailVerified: profile.emailVerified ?? false,
    updatedAt: now,
    ...(fullName ? { fullName } : {}),
  };

  // Missing (stripped by the patch-undefined bug), never granted, or on the
  // retired "god" tier -> bring it up to the granted tier.
  const tier = existing.entitlementTier;
  if (tier === undefined || tier === "none" || tier === "god") {
    patch.entitlementTier = GRANTED_ENTITLEMENT_TIER;
  }

  // Only fill a MISSING value. An explicit "free" is a real downgrade decision
  // made by the billing webhook and must survive sign-in.
  if (existing.userType === undefined) {
    patch.userType = GRANTED_USER_TYPE;
  }

  if (existing.betaAccess === undefined) {
    patch.betaAccess = GRANTED_BETA_ACCESS;
  }

  return patch;
}

/**
 * Fields `shouldGrantSubscription` reads. Callers may pass the full
 * `subscriptionStates` document; extra keys are ignored.
 */
export type SubscriptionGrantSnapshot = {
  plan: string;
  status: string;
  billingCycle?: string;
  source?: string;
};

/**
 * The pre-open-signup non-founder row. Founders already had plan `max`.
 * Account deletion later sets `status` to `inactive` on a real plan and does
 * not change `source`, so status alone is not this placeholder.
 */
const BETA_PLACEHOLDER = {
  plan: "none",
  billingCycle: "none",
  status: "inactive",
  source: "beta_signup",
} as const;

/**
 * True only for a legitimate grant:
 * - no subscription row yet (open signup inserts `GRANTED_SUBSCRIPTION`)
 * - the exact pre-open-signup placeholder above
 *
 * A cancelled, grace, or unpaid row, and a paid row marked inactive by
 * account deletion, must not be rewritten to lifetime Max on the next login.
 * `buildReturningUserPatch` still heals a missing or `"none"` entitlement
 * tier; that field does not unlock billing. `PremiumGate` reads `userType`,
 * and an explicit `"free"` is left alone.
 */
export function shouldGrantSubscription(
  existing?: SubscriptionGrantSnapshot | null,
): boolean {
  if (!existing) return true;
  return (
    existing.plan === BETA_PLACEHOLDER.plan &&
    existing.status === BETA_PLACEHOLDER.status &&
    existing.billingCycle === BETA_PLACEHOLDER.billingCycle &&
    existing.source === BETA_PLACEHOLDER.source
  );
}
