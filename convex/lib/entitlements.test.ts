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
  it("grants the max tier to every new account", () => {
    const fields = newUserFields(PROFILE, NOW);
    expect(fields.entitlementTier).toBe(GRANTED_ENTITLEMENT_TIER);
    expect(fields.userType).toBe(GRANTED_USER_TYPE);
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

  it("heals an account whose tier was already stripped", () => {
    const patch = buildReturningUserPatch({}, PROFILE, NOW);
    expect(patch.entitlementTier).toBe(GRANTED_ENTITLEMENT_TIER);
    expect(patch.userType).toBe(GRANTED_USER_TYPE);
  });

  it("normalizes the retired god tier down to max", () => {
    expect(buildReturningUserPatch({ entitlementTier: "god" }, PROFILE, NOW).entitlementTier).toBe(
      GRANTED_ENTITLEMENT_TIER,
    );
  });

  it("keeps the tier across two consecutive sign-ins -- the acceptance test", () => {
    // Sign-in #1: brand new account.
    let account: ReturningUserSnapshot = {
      entitlementTier: newUserFields(PROFILE, NOW).entitlementTier,
      userType: newUserFields(PROFILE, NOW).userType,
      betaAccess: newUserFields(PROFILE, NOW).betaAccess,
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
  it("grants a missing row and the exact pre-open-signup placeholder", () => {
    expect(shouldGrantSubscription(null)).toBe(true);
    expect(shouldGrantSubscription(undefined)).toBe(true);
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
