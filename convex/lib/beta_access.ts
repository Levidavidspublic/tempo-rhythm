import type { ReturningUserSnapshot, SubscriptionGrantSnapshot } from "./entitlements";
import { GRANTED_SUBSCRIPTION } from "./entitlements";

/** Server-owned account fields only; no request payload supplies grant evidence. */
export type BetaAccount = ReturningUserSnapshot & {
  betaRequestedAt?: number;
  betaApprovedAt?: number;
};

export const BETA_SUBSCRIPTION = { ...GRANTED_SUBSCRIPTION, source: "beta_approval" } as const;

export function betaRequestStatus(user: BetaAccount): "requested" | "approved" | "unavailable" {
  if (user.deletedAt !== undefined || user.isActive === false || user.approvalStatus === "revoked") return "unavailable";
  if (user.approvalStatus === "approved" &&
    (user.betaApprovedAt !== undefined || user.betaAccess === "tester" || user.betaAccess === "founder")) return "approved";
  return "requested";
}

/** A fresh explicit approval can grant access; a repeated status update cannot. */
export function betaApprovalGrant(user: BetaAccount, subscription?: SubscriptionGrantSnapshot | null) {
  if (user.betaRequestedAt === undefined || betaRequestStatus(user) === "unavailable") return null;
  const placeholder = subscription?.source === "beta_signup" && subscription.plan === "none" &&
    subscription.status === "inactive" && subscription.billingCycle === "none";
  const existingGrant = subscription?.plan === "max" && subscription.status === "active" &&
    subscription.billingCycle === "lifetime" &&
    (subscription.source === "open_signup_grant" || subscription.source === "beta_approval");
  const founder = user.betaAccess === "founder" || user.isGodTier === true || user.entitlementTier === "god";
  const independentlyPaid = user.userType === "paid" && user.betaAccess !== "tester" &&
    (user.entitlementTier === "basic" || user.entitlementTier === "pro" || user.entitlementTier === "max");
  // Purchase/cancellation state is authoritative. Approval records the beta decision
  // without replacing somebody's purchase, founder grant or later billing decision.
  if (founder || independentlyPaid || (subscription && !placeholder && !existingGrant)) {
    return { grantAccess: false, writeSubscription: false };
  }
  return { grantAccess: true, writeSubscription: !subscription || placeholder };
}
