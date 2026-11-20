import { expect, test } from "bun:test";

import { type AccountGateDoc, newAccountGate, validateAccountGateDoc } from "./account-gate-doc";

test("a full valid account gate passes", () => {
  const gate: AccountGateDoc = {
    email: "person@example.test",
    emailVerificationTime: 1,
    emailVerified: true,
    role: "admin",
    userType: "paid",
    betaAccess: "founder",
    entitlementTier: "god",
    isGodTier: true,
    betaApprovedAt: 2,
    isActive: true,
    approvalStatus: "approved",
    approvalUpdatedAt: 3,
    approvalUpdatedBy: "system",
    createdAt: 0,
    updatedAt: 4,
    deletedAt: 5,
  };

  expect(validateAccountGateDoc(gate)).toEqual({ ok: true, doc: gate });
});

test("unknown and profile keys are refused", () => {
  for (const key of ["", "unexpected", "name", "fullName", "onboardedAt", "userId"]) {
    expect(validateAccountGateDoc({ email: "person@example.test", [key]: "value" })).toEqual({
      ok: false,
      reason: `unknown key: ${key}`,
    });
  }
});

test("each bad enum value is refused", () => {
  for (const field of ["role", "userType", "betaAccess", "entitlementTier", "approvalStatus"]) {
    expect(validateAccountGateDoc({ email: "person@example.test", [field]: "invalid" }).ok).toBe(
      false
    );
  }
});

test("bad times are refused", () => {
  for (const field of [
    "emailVerificationTime",
    "betaApprovedAt",
    "approvalUpdatedAt",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ]) {
    for (const badTime of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1"]) {
      expect(validateAccountGateDoc({ email: "person@example.test", [field]: badTime }).ok).toBe(
        false
      );
    }
  }
});

test("newAccountGate returns the valid pending active default", () => {
  const gate = newAccountGate("  Person@Example.Test  ", 123);

  expect(gate).toEqual({
    email: "person@example.test",
    role: "user",
    userType: "free",
    betaAccess: "none",
    isActive: true,
    approvalStatus: "pending",
    createdAt: 123,
    updatedAt: 123,
  });
  expect(validateAccountGateDoc(gate)).toEqual({ ok: true, doc: gate });
});

test("newAccountGate throws on a bad email", () => {
  expect(() => newAccountGate("not-an-email", 123)).toThrow(new Error("Invalid email"));
});
