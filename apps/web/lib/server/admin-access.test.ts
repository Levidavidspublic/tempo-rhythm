import { describe, expect, test } from "bun:test";

import { approvalFor, initialApproval, isAdmin, parseAdminEmails } from "./admin-access";

describe("admin access", () => {
  test("parses a mixed admin email list", () => {
    expect(parseAdminEmails(" Admin@Example.COM, second@example.com\ninvalid entry THIRD@EXAMPLE.COM ")).toEqual([
      "admin@example.com",
      "second@example.com",
      "third@example.com",
    ]);
  });

  test("recognizes an admin role", () => {
    expect(isAdmin({ role: "admin" }, [])).toBe(true);
  });

  test("recognizes a listed email regardless of case", () => {
    const admins = ["admin@example.com"];

    expect(isAdmin({ email: "  ADMIN@EXAMPLE.COM " }, admins)).toBe(true);
    expect(isAdmin({ email: "   " }, admins)).toBe(false);
  });

  test("sets initial approval from the admin list", () => {
    const admins = ["admin@example.com"];

    expect(initialApproval("ADMIN@EXAMPLE.COM", admins)).toBe("approved");
    expect(initialApproval("person@example.com", admins)).toBe("pending");
  });

  test("resolves approval with admin precedence and fail-closed defaults", () => {
    const admins = ["admin@example.com"];

    expect(approvalFor({ email: "ADMIN@EXAMPLE.COM", approvalStatus: "revoked" }, admins)).toBe(
      "approved",
    );
    expect(approvalFor({ approvalStatus: "revoked" }, admins)).toBe("revoked");
    expect(approvalFor({ approvalStatus: "approved" }, admins)).toBe("approved");
    expect(approvalFor({}, admins)).toBe("pending");
    expect(approvalFor({ approvalStatus: "unexpected" }, admins)).toBe("pending");
  });
});
