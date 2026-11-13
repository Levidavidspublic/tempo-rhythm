import type { Doc } from "../_generated/dataModel";

/**
 * Single source of truth for what an account is granted at sign-up.
 *
 * Ordinary signup creates a pending account without a paid entitlement. These helpers are
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
  isGodTier?: boolean;
  isActive?: boolean;
  deletedAt?: number;
  approvalStatus?: "pending" | "approved" | "revoked";
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
 * Pending is account state, not a free product plan. Only the existing explicit
 * admin-approved creation path retains its grant; ordinary signup grants nothing.
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
    userType: approvalStatus === "approved" ? GRANTED_USER_TYPE : "free" as const,
    betaAccess: approvalStatus === "approved" ? GRANTED_BETA_ACCESS : "none" as const,
    entitlementTier: approvalStatus === "approved" ? GRANTED_ENTITLEMENT_TIER : "none" as const,
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
 * Repairs require persisted historical grant evidence. Missing fields alone
 * authorize nothing. Explicit downgrades and independent billing rows win.
 */
export function buildReturningUserPatch(
  existing: ReturningUserSnapshot,
  profile: SignInProfile,
  now: number,
  subscription?: SubscriptionGrantSnapshot | null,
): ReturningUserPatch {
  const fullName = storedFullName(profile.fullName);
  const patch: ReturningUserPatch = {
    email: profile.email,
    emailVerified: profile.emailVerified ?? false,
    updatedAt: now,
    ...(fullName ? { fullName } : {}),
  };

  if (!canPreserveGrant(existing, subscription)) return patch;

  // Only missing fields, or the retired tier, are repaired. An explicit none,
  // basic, pro or free is never promoted on login, even for a former tester.
  const tier = existing.entitlementTier;
  if (tier === undefined || tier === "god") {
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

function isBetaPlaceholder(existing: SubscriptionGrantSnapshot): boolean {
  return existing.plan === BETA_PLACEHOLDER.plan &&
    existing.status === BETA_PLACEHOLDER.status &&
    existing.billingCycle === BETA_PLACEHOLDER.billingCycle &&
    existing.source === BETA_PLACEHOLDER.source;
}

/** Historical evidence is not permission to reverse a later billing decision. */
function canPreserveGrant(
  user: ReturningUserSnapshot,
  subscription?: SubscriptionGrantSnapshot | null,
): boolean {
  if (user.isActive === false || user.deletedAt !== undefined || user.approvalStatus === "revoked") return false;
  if (user.userType === "free" ||
    (user.entitlementTier !== undefined && user.entitlementTier !== "max" && user.entitlementTier !== "god")) {
    return false;
  }
  const placeholder = subscription !== undefined && subscription !== null && isBetaPlaceholder(subscription);
  const activeGrant = subscription?.source === "open_signup_grant" &&
    subscription.plan === "max" && subscription.status === "active" && subscription.billingCycle === "lifetime";
  // Never turn an unrelated purchase, cancellation or deletion into a grant.
  if (subscription && !placeholder && !activeGrant) return false;
  return user.betaAccess === "tester" || user.betaAccess === "founder" ||
    user.entitlementTier === "god" || user.isGodTier === true || placeholder || activeGrant;
}

/**
 * Only restore a historical grant's missing row or exact beta placeholder.
 * Existing subscriptions, including inactive/cancelled ones, are never replaced.
 */
export function shouldGrantSubscription(
  existing?: SubscriptionGrantSnapshot | null,
  user: ReturningUserSnapshot = {},
): boolean {
  return canPreserveGrant(user, existing) && (!existing || isBetaPlaceholder(existing));
}
