import { describe, expect, test } from "bun:test";

import { accessRefusal, gateRefusal, refusalBody } from "./access-reply";

describe("account access replies", () => {
  test("refuses a missing account", () => {
    expect(gateRefusal(null, "active")).toEqual({
      httpStatus: 403,
      code: "ACCOUNT_NOT_FOUND",
      copyKey: "access.missing",
    });
  });

  test("refuses inactive accounts marked by deletion or activity", () => {
    const expected = {
      httpStatus: 403,
      code: "ACCOUNT_INACTIVE",
      copyKey: "access.inactive",
    } as const;

    expect(gateRefusal({ deletedAt: 1, isActive: true }, "active")).toEqual(expected);
    expect(gateRefusal({ isActive: false, approvalStatus: "approved" }, "approved")).toEqual(
      expected
    );
  });

  test("refuses pending approval only when approval is needed", () => {
    expect(accessRefusal("pending", "approved")).toEqual({
      httpStatus: 403,
      code: "ACCOUNT_PENDING_APPROVAL",
      copyKey: "access.pending",
    });
    expect(accessRefusal("pending", "active")).toBeNull();
  });

  test("allows approved accounts for both access levels", () => {
    expect(accessRefusal("approved", "active")).toBeNull();
    expect(accessRefusal("approved", "approved")).toBeNull();
  });

  test("returns a refusal body with only the public error fields", () => {
    const refusal = accessRefusal("missing", "approved");
    expect(refusal).not.toBeNull();
    expect(Object.keys(refusalBody(refusal!)).sort()).toEqual(["copyKey", "error"]);
    expect(refusalBody(refusal!)).toEqual({
      error: "ACCOUNT_NOT_FOUND",
      copyKey: "access.missing",
    });
  });
});
