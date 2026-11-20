import { describe, expect, test } from "bun:test";

import { returningSignInPatches } from "./returning-sign-in";

describe("returningSignInPatches", () => {
  test("a healthy account only refreshes sign-in gate fields", () => {
    expect(
      returningSignInPatches(
        { entitlementTier: "max", userType: "paid", betaAccess: "tester" },
        { email: "person@example.com", emailVerified: true },
        123
      )
    ).toEqual({
      gate: {
        email: "person@example.com",
        emailVerified: true,
        updatedAt: 123,
      },
      profile: {},
    });
  });

  test("missing, none, and god tiers heal to max", () => {
    for (const entitlementTier of [undefined, "none", "god"]) {
      const { gate } = returningSignInPatches(
        { entitlementTier, userType: "paid", betaAccess: "tester" },
        { email: "person@example.com" },
        123
      );

      expect(gate.entitlementTier).toBe("max");
    }
  });

  test("an explicit free user type survives while missing gate fields are filled", () => {
    const { gate } = returningSignInPatches(
      { entitlementTier: "max", userType: "free" },
      { email: "person@example.com" },
      123
    );

    expect(gate).toEqual({
      email: "person@example.com",
      emailVerified: false,
      updatedAt: 123,
      betaAccess: "tester",
    });

    expect(
      returningSignInPatches(
        { entitlementTier: "max", betaAccess: "tester" },
        { email: "person@example.com" },
        123
      ).gate.userType
    ).toBe("paid");
  });

  test("only a real full name is trimmed into the profile patch", () => {
    const realName = returningSignInPatches(
      { entitlementTier: "max", userType: "paid", betaAccess: "tester" },
      { email: "person@example.com", fullName: "  Ada Lovelace  " },
      123
    );

    expect(realName.profile).toEqual({ fullName: "Ada Lovelace" });
    expect(realName.gate).not.toHaveProperty("fullName");

    for (const fullName of ["  ", "User"]) {
      const patches = returningSignInPatches(
        { entitlementTier: "max", userType: "paid", betaAccess: "tester" },
        { email: "person@example.com", fullName },
        123
      );

      expect(patches.profile).toEqual({});
      expect(patches.gate).not.toHaveProperty("fullName");
    }
  });

  test("neither patch contains undefined values", () => {
    const cases = [
      returningSignInPatches(
        { entitlementTier: "max", userType: "paid", betaAccess: "tester" },
        { email: "healthy@example.com", emailVerified: true },
        1
      ),
      ...[undefined, "none", "god"].map((entitlementTier) =>
        returningSignInPatches(
          { entitlementTier },
          { email: "healed@example.com", fullName: "Ada Lovelace" },
          2
        )
      ),
      returningSignInPatches(
        { entitlementTier: "max", userType: "free" },
        { email: "free@example.com", fullName: "User" },
        3
      ),
    ];

    for (const patches of cases) {
      expect(Object.values(patches.gate)).not.toContain(undefined);
      expect(Object.values(patches.profile)).not.toContain(undefined);
    }
  });
});
