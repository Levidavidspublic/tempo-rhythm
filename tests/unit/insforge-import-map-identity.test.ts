import { expect, test } from "bun:test";
import { mapIdentity } from "../../tools/convex-import/map-identity";

const user = { _id: "user1", _creationTime: 1_700_000_000_000.25, email: "Hello@Example.test" };
const subscription = {
  _id: "sub1",
  _creationTime: 1_700_000_000_005,
  userId: user._id,
  plan: "basic",
  billingCycle: "monthly",
  status: "active",
  trialUsed: false,
  updatedAt: 1_700_000_000_009,
};

test("emits auth before trigger-row reconciliation and preserves the approval default", () => {
  const { sql, rejected, counts } = mapIdentity([user], [subscription]);
  expect(rejected).toEqual([]);
  expect(counts).toEqual({
    users: { exported: 1, transformed: 1, rejected: 0 },
    subscriptionStates: { exported: 1, transformed: 1, rejected: 0 },
  });
  expect(sql.indexOf("INSERT INTO auth.users")).toBeLessThan(
    sql.indexOf("INSERT INTO public.account_gate")
  );
  expect(sql.indexOf("UPDATE public.account_gate")).toBeLessThan(
    sql.indexOf("INSERT INTO public.account_gate")
  );
  expect(sql.indexOf("UPDATE public.subscription_states")).toBeLessThan(
    sql.indexOf("INSERT INTO public.subscription_states")
  );
  expect(sql).toContain("E'hello@example.test'");
  expect(sql).toContain("pg_catalog.lower(email)");
  expect(sql).toContain("E'approved', NULL, NULL, E'user1', 1700000000000, 1700000000000, NULL");
  expect(sql).toContain(
    "E'basic', E'monthly', E'active', FALSE, NULL, E'sub1', 1700000000005, 1700000000009"
  );
  expect(sql.match(/ON CONFLICT \(legacy_convex_id\)/g)).toHaveLength(2);
  expect(sql.match(/WHERE excluded.updated_at >= target.updated_at/g)).toHaveLength(3);
  expect(sql).toContain("updated_at = created_at AND approval_status = 'pending'");
  expect(sql).toContain(
    "updated_at = created_at AND source = 'open_signup_grant' AND plan = 'max'"
  );
});

test("maps explicit account flags, profile fields, and epoch-ms timestamps", () => {
  const { sql, rejected } = mapIdentity(
    [
      {
        ...user,
        emailVerified: true,
        emailVerificationTime: 1_700_000_000_001,
        role: "admin",
        userType: "paid",
        betaAccess: "founder",
        entitlementTier: "god",
        isGodTier: true,
        betaApprovedAt: 1_700_000_000_002,
        isActive: false,
        approvalStatus: "revoked",
        approvalUpdatedAt: 1_700_000_000_003,
        approvalUpdatedBy: "cli",
        name: "Name",
        fullName: "Full Name",
        onboardedAt: 1_700_000_000_004,
        createdAt: 1_700_000_000_005,
        updatedAt: 1_700_000_000_006,
        deletedAt: 1_700_000_000_007,
      },
    ],
    []
  );
  expect(rejected).toEqual([]);
  expect(sql).toContain(
    "E'hello@example.test', TRUE, 1700000000001, E'admin', E'paid', E'founder', E'god', TRUE"
  );
  expect(sql).toContain("1700000000002, FALSE, E'revoked', 1700000000003, E'cli'");
  expect(sql).toContain("E'user1', 1700000000005, 1700000000006, 1700000000007");
  expect(sql).toContain("E'Name', E'Full Name', 1700000000004, 1700000000005, 1700000000006");
});

test("rejects all owners of duplicate emails, missing email, and orphaned subscriptions", () => {
  const result = mapIdentity(
    [
      user,
      { ...user, _id: "duplicate", email: " hello@EXAMPLE.test " },
      { _id: "missing", _creationTime: 1 },
    ],
    [subscription]
  );
  expect(result.rejected).toEqual([
    { table: "users", id: "user1", reason: "duplicate email (case-insensitive)" },
    { table: "users", id: "duplicate", reason: "duplicate email (case-insensitive)" },
    { table: "users", id: "missing", reason: "missing email" },
    { table: "subscriptionStates", id: "sub1", reason: "unresolved userId" },
  ]);
  expect(result.sql).toBe("BEGIN;\nCOMMIT;\n");
});

test("quotes source text and IDs as data and rejects text Postgres cannot store", () => {
  const hostile = "O'Brien\\path$$";
  const { sql, rejected } = mapIdentity(
    [
      { ...user, _id: hostile, name: hostile },
      { ...user, _id: "nul", email: "other@example.test", name: "before\0after" },
    ],
    [{ ...subscription, _id: hostile, userId: hostile, source: hostile }]
  );
  expect(rejected).toEqual([
    { table: "users", id: "nul", reason: "name must be text without null bytes" },
  ]);
  expect(sql).toContain(String.raw`E'O''Brien\\path$$'`);
  expect(sql).not.toContain(hostile);
  expect(sql).not.toContain("\0");
  expect(sql).not.toContain("other@example.test");
});

test("rejects malformed subscriptions without losing a valid user", () => {
  const { sql, rejected } = mapIdentity([user], [{ ...subscription, trialUsed: "false" }]);
  expect(rejected).toEqual([
    { table: "subscriptionStates", id: "sub1", reason: "trialUsed must be boolean" },
  ]);
  expect(sql).toContain("INSERT INTO auth.users");
  expect(sql).not.toContain("INSERT INTO public.subscription_states");
});
