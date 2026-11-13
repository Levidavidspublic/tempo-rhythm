import { describe, expect, it } from "bun:test";
import {
  buildReturningUserPatch,
  GRANTED_ENTITLEMENT_TIER,
  GRANTED_USER_TYPE,
  newUserFields,
  type ReturningUserSnapshot,
  shouldGrantSubscription,
} from "./entitlements";

const PROFILE = { email: "someone@example.com", emailVerified: true, fullName: "Someone" };
const NOW = 1_700_000_000_000;

/** Convex `db.patch` deletes any field whose value is `undefined`. */
function undefinedKeys(patch: Record<string, unknown>): string[] {
  return Object.entries(patch)
    .filter(([, value]) => value === undefined)
    .map(([key]) => key);
}

describe("newUserFields", () => {
  // Amit 22 Oct: ordinary signup no longer grants free Max access.
  it("creates an ordinary pending account without a paid or tester grant", () => {
    const fields = newUserFields(PROFILE, NOW);
    expect(fields.entitlementTier).toBe("none");
    expect(fields.userType).toBe("free");
    expect(fields.betaAccess).toBe("none");
    expect(fields.approvalStatus).toBe("pending");
    expect(shouldGrantSubscription(null, fields)).toBe(false);
    expect(fields.isActive).toBe(true);
  });

  it("never emits an undefined value", () => {
    expect(undefinedKeys(newUserFields({ email: "a@b.com" }, NOW))).toEqual([]);
  });

  it("does not store the placeholder name User", () => {
    const fields = newUserFields({ email: "a@b.com" }, NOW);
    expect("fullName" in fields).toBe(false);
    const placeholder = newUserFields({ email: "a@b.com", fullName: "User" }, NOW);
    expect("fullName" in placeholder).toBe(false);
  });
});

describe("buildReturningUserPatch", () => {
  it("never emits an undefined value -- this is the bug that stripped accounts", () => {
    const cases: ReturningUserSnapshot[] = [
      {},
      { entitlementTier: "max", userType: "paid", betaAccess: "tester" },
      { entitlementTier: "none" },
      { userType: "free" },
    ];
    for (const existing of cases) {
      expect(undefinedKeys(buildReturningUserPatch(existing, PROFILE, NOW))).toEqual([]);
    }
  });

  it("heals a historically granted tester whose tier was stripped", () => {
    const patch = buildReturningUserPatch({ betaAccess: "tester" }, PROFILE, NOW);
    expect(patch.entitlementTier).toBe(GRANTED_ENTITLEMENT_TIER);
    expect(patch.userType).toBe(GRANTED_USER_TYPE);
  });

  it("normalizes the retired god tier down to max", () => {
    expect(buildReturningUserPatch({ entitlementTier: "god" }, PROFILE, NOW).entitlementTier).toBe(
      GRANTED_ENTITLEMENT_TIER,
    );
  });

  it("keeps the tier across two consecutive sign-ins -- the acceptance test", () => {
    // An existing explicitly granted account, not an ordinary signup.
    let account: ReturningUserSnapshot = {
      entitlementTier: "max",
      userType: "paid",
      betaAccess: "tester",
    };

    // Sign-in #2: apply the patch the way Convex would.
    const patch = buildReturningUserPatch(account, PROFILE, NOW + 1000);
    account = { ...account, ...patch };

    expect(account.entitlementTier).toBe(GRANTED_ENTITLEMENT_TIER);
    expect("entitlementTier" in account).toBe(true);

    // Sign-in #3, because signing in once proves nothing.
    account = { ...account, ...buildReturningUserPatch(account, PROFILE, NOW + 2000) };
    expect(account.entitlementTier).toBe(GRANTED_ENTITLEMENT_TIER);
  });

  it("keeps a real name and omits a missing one", () => {
    expect(buildReturningUserPatch({}, PROFILE, NOW).fullName).toBe("Someone");
    const patch = buildReturningUserPatch({}, { email: "a@b.com", fullName: "User" }, NOW);
    expect("fullName" in patch).toBe(false);
    expect(undefinedKeys(patch)).toEqual([]);
  });

  it("does not stomp a real billing downgrade back to paid", () => {
    const patch = buildReturningUserPatch(
      { entitlementTier: "max", userType: "free", betaAccess: "tester" },
      PROFILE,
      NOW,
    );
    expect("userType" in patch).toBe(false);
  });
});

const BETA_PLACEHOLDER = {
  plan: "none",
  billingCycle: "none",
  status: "inactive",
  source: "beta_signup",
} as const;

describe("shouldGrantSubscription", () => {
  it("requires historical evidence for a missing row; preserves the exact beta placeholder", () => {
    expect(shouldGrantSubscription(null)).toBe(false);
    expect(shouldGrantSubscription(undefined)).toBe(false);
    expect(shouldGrantSubscription(null, { betaAccess: "tester" })).toBe(true);
    expect(shouldGrantSubscription(undefined, { betaAccess: "founder" })).toBe(true);
    expect(shouldGrantSubscription(BETA_PLACEHOLDER)).toBe(true);
  });

  it("does not grant a paid row just because deletion marked it inactive", () => {
    expect(
      shouldGrantSubscription({
        plan: "max",
        billingCycle: "lifetime",
        status: "inactive",
        source: "open_signup_grant",
      }),
    ).toBe(false);
  });

  it("does not grant plan none unless every placeholder field matches", () => {
    expect(shouldGrantSubscription({ plan: "none", status: "inactive" })).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "none",
        billingCycle: "none",
        status: "inactive",
        source: "revenuecat",
      }),
    ).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "none",
        billingCycle: "monthly",
        status: "inactive",
        source: "beta_signup",
      }),
    ).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "none",
        billingCycle: "none",
        status: "cancelled",
        source: "beta_signup",
      }),
    ).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "none",
        billingCycle: "none",
        status: "active",
        source: "beta_signup",
      }),
    ).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "none",
        billingCycle: "none",
        status: "grace",
        source: "beta_signup",
      }),
    ).toBe(false);
  });

  it("leaves a live paid subscription alone", () => {
    expect(
      shouldGrantSubscription({
        plan: "pro",
        billingCycle: "monthly",
        status: "active",
        source: "revenuecat",
      }),
    ).toBe(false);
    expect(
      shouldGrantSubscription({
        plan: "max",
        billingCycle: "lifetime",
        status: "active",
        source: "open_signup_grant",
      }),
    ).toBe(false);
  });
});

describe("account grant precedence", () => {
  it("never promotes ordinary accounts across repeated sign-ins or missing fields", () => {
    for (const original of [{}, newUserFields(PROFILE, NOW), { entitlementTier: "none" as const }]) {
      let account: ReturningUserSnapshot = original;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const patch = buildReturningUserPatch(account, PROFILE, NOW + attempt);
        expect(patch.entitlementTier).toBeUndefined();
        expect(patch.userType).toBeUndefined();
        expect(patch.betaAccess).toBeUndefined();
        account = { ...account, ...patch };
        expect(shouldGrantSubscription(null, account)).toBe(false);
      }
    }
  });

  it("keeps explicit admin-approved creation and founder evidence", () => {
    const admin = newUserFields(PROFILE, NOW, "approved");
    expect(admin.approvalStatus).toBe("approved");
    expect(admin.betaApprovedAt).toBe(NOW);
    expect(shouldGrantSubscription(null, admin)).toBe(true);
    const founder = { betaAccess: "founder" as const };
    const repaired = { ...founder, ...buildReturningUserPatch(founder, PROFILE, NOW) };
    expect(repaired).toMatchObject({ betaAccess: "founder", userType: "paid", entitlementTier: "max" });
    expect(shouldGrantSubscription(null, repaired)).toBe(true);
  });

  it("recognizes an active historical grant without rewriting its subscription", () => {
    const subscription = { plan: "max", status: "active", billingCycle: "lifetime", source: "open_signup_grant" };
    expect(buildReturningUserPatch({}, PROFILE, NOW, subscription)).toMatchObject({
      userType: "paid", entitlementTier: "max", betaAccess: "tester",
    });
    expect(shouldGrantSubscription(subscription)).toBe(false);
  });

  it("repairs the exact old placeholder but not a later explicit downgrade", () => {
    expect(buildReturningUserPatch({}, PROFILE, NOW, BETA_PLACEHOLDER)).toMatchObject({
      entitlementTier: "max", userType: "paid",
    });
    for (const account of [
      { userType: "free" as const, betaAccess: "tester" as const },
      { entitlementTier: "none" as const, betaAccess: "tester" as const },
      { entitlementTier: "basic" as const, betaAccess: "founder" as const },
      { entitlementTier: "pro" as const, userType: "paid" as const },
    ]) {
      const patch = buildReturningUserPatch(account, PROFILE, NOW, BETA_PLACEHOLDER);
      expect(patch.entitlementTier).toBeUndefined();
      expect(patch.userType).toBeUndefined();
      expect(shouldGrantSubscription(BETA_PLACEHOLDER, account)).toBe(false);
      expect(shouldGrantSubscription(null, account)).toBe(false);
    }
  });

  it("preserves purchased entitlements and all independent subscription rows", () => {
    for (const status of ["active", "grace", "cancelled", "inactive"]) {
      const subscription = { plan: "pro", billingCycle: "monthly", source: "revenuecat", status };
      const original = structuredClone(subscription);
      const account = { betaAccess: "tester" as const, userType: "paid" as const, entitlementTier: "pro" as const };
      const patched = { ...account, ...buildReturningUserPatch(account, PROFILE, NOW, subscription) };
      expect(patched).toMatchObject(account);
      expect(shouldGrantSubscription(subscription, account)).toBe(false);
      expect(subscription).toEqual(original);
      // Even damaged user fields are not permission to supersede a real billing row.
      const damaged = buildReturningUserPatch({ betaAccess: "tester" }, PROFILE, NOW, subscription);
      expect(damaged.userType).toBeUndefined();
      expect(damaged.entitlementTier).toBeUndefined();
    }
  });

  it("never reactivates cancelled or inactive historical grants", () => {
    for (const status of ["cancelled", "inactive", "grace"]) {
      const subscription = { plan: "max", billingCycle: "lifetime", source: "open_signup_grant", status };
      const account = { betaAccess: "tester" as const };
      expect(shouldGrantSubscription(subscription, account)).toBe(false);
      expect(buildReturningUserPatch(account, PROFILE, NOW, subscription).userType).toBeUndefined();
    }
  });

  it("does not grant a revoked, deleted or deactivated historical tester", () => {
    for (const state of [{ approvalStatus: "revoked" as const }, { deletedAt: NOW }, { isActive: false }]) {
      const account = { betaAccess: "tester" as const, ...state };
      expect(shouldGrantSubscription(null, account)).toBe(false);
      expect(buildReturningUserPatch(account, PROFILE, NOW).userType).toBeUndefined();
    }
  });
});
