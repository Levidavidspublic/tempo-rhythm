import { describe, expect, test } from "bun:test";
import {
  hasPaidAccess,
  newSubscriptionState,
  type SubscriptionStateDoc,
  validateSubscriptionStateDoc,
} from "./subscription-state-doc";

const validState: SubscriptionStateDoc = {
  plan: "pro",
  billingCycle: "annual",
  status: "active",
  trialUsed: true,
  source: "billing_sync",
  createdAt: 100,
  updatedAt: 200,
};

describe("subscription state document", () => {
  test("accepts a valid state", () => {
    expect(validateSubscriptionStateDoc(validState)).toEqual({ ok: true, doc: validState });
  });

  test("refuses unknown keys, including userId", () => {
    expect(validateSubscriptionStateDoc({ ...validState, extra: true })).toEqual({
      ok: false,
      reason: "unknown key: extra",
    });
    expect(validateSubscriptionStateDoc({ ...validState, userId: "user-1" })).toEqual({
      ok: false,
      reason: "unknown key: userId",
    });
  });

  test("refuses each invalid enum", () => {
    expect(validateSubscriptionStateDoc({ ...validState, plan: "enterprise" }).ok).toBe(false);
    expect(validateSubscriptionStateDoc({ ...validState, billingCycle: "weekly" }).ok).toBe(false);
    expect(validateSubscriptionStateDoc({ ...validState, status: "paused" }).ok).toBe(false);
  });

  test("refuses invalid times and an update before creation", () => {
    for (const time of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(validateSubscriptionStateDoc({ ...validState, createdAt: time }).ok).toBe(false);
      expect(validateSubscriptionStateDoc({ ...validState, updatedAt: time }).ok).toBe(false);
    }
    expect(validateSubscriptionStateDoc({ ...validState, createdAt: 201 }).ok).toBe(false);
  });

  test("builds a valid unpaid state for a new sign-up", () => {
    const state = newSubscriptionState(300);

    expect(validateSubscriptionStateDoc(state)).toEqual({ ok: true, doc: state });
    expect(hasPaidAccess(state)).toBe(false);
  });

  test("grants access only to active or grace paid plans", () => {
    expect(hasPaidAccess(validState)).toBe(true);
    expect(hasPaidAccess({ ...validState, status: "grace" })).toBe(true);
    expect(hasPaidAccess({ ...validState, status: "cancelled" })).toBe(false);
    expect(hasPaidAccess({ ...validState, status: "inactive" })).toBe(false);
    expect(hasPaidAccess({ ...validState, plan: "none" })).toBe(false);
  });
});
