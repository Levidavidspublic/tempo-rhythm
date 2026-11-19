import { expect, test } from "bun:test";

import {
  accountAccess,
  accountGatePath,
  canUsePaidRoute,
  isAccountActive,
} from "./account-gate";

test("accountGatePath returns the gate path and rejects invalid account ids", () => {
  expect(accountGatePath("user-123")).toBe("private/user-123/account/gate");

  for (const uid of ["", "a/b", ".", "..", "__reserved__"]) {
    expect(() => accountGatePath(uid)).toThrow(new Error("Invalid account id"));
  }
});

test("a gate without deletion or activation fields is active", () => {
  expect(isAccountActive({})).toBe(true);
});

test("a deletion timestamp or false activation is inactive, while null deletion is active", () => {
  expect(isAccountActive({ deletedAt: 1 })).toBe(false);
  expect(isAccountActive({ isActive: false })).toBe(false);
  expect(isAccountActive({ deletedAt: null })).toBe(true);
});

test("a missing gate has missing access", () => {
  expect(accountAccess(null)).toBe("missing");
  expect(accountAccess(undefined)).toBe("missing");
});

test("an active approved gate is approved, while a deleted approved gate is inactive", () => {
  expect(accountAccess({ approvalStatus: "approved" })).toBe("approved");
  expect(accountAccess({ approvalStatus: "approved", deletedAt: 1 })).toBe("inactive");
});

test("all non-approved statuses are pending and only approved gates can use paid routes", () => {
  for (const approvalStatus of [undefined, "pending", "revoked", "unexpected"]) {
    expect(accountAccess({ approvalStatus })).toBe("pending");
    expect(canUsePaidRoute({ approvalStatus })).toBe(false);
  }
  expect(canUsePaidRoute({ approvalStatus: "approved" })).toBe(true);
});
