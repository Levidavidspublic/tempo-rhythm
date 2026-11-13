import { describe, expect, test } from "bun:test";
import * as approval from "./approval";
import { betaApprovalGrant, betaRequestStatus } from "./lib/beta_access";

type Row = Record<string, unknown> & { _id: string };

function world() {
  const rows = new Map<string, Row>();
  let count = 0;
  const queryReads: Array<{ index: string; limit?: number }> = [];
  const seed = (id: string, fields: Record<string, unknown>) => {
    rows.set(id, { _id: id, _creationTime: 1, ...fields });
    return id;
  };
  seed("users:admin", { email: "admin@example.invalid", role: "admin", approvalStatus: "approved" });
  seed("users:alice", { email: "alice@example.invalid", approvalStatus: "pending", betaAccess: "none", userType: "free", entitlementTier: "none" });
  seed("users:bob", { email: "bob@example.invalid", approvalStatus: "pending", betaAccess: "none" });
  const db = {
    normalizeId: (_table: string, id: string) => rows.has(id) ? id : null,
    get: async (id: string) => rows.get(id) ?? null,
    patch: async (id: string, patch: Record<string, unknown>) => {
      const row = rows.get(id);
      if (!row) throw new Error("Missing row");
      const next = { ...row, ...patch };
      for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
      rows.set(id, next);
    },
    insert: async (table: string, fields: Record<string, unknown>) => seed(`${table}:${++count}`, fields),
    query: (table: string) => {
      let selected = [...rows.values()].filter((row) => row._id.startsWith(`${table}:`));
      const read = { index: "", limit: undefined as number | undefined };
      const builder = {
        withIndex: (index: string, configure: (q: unknown) => unknown) => {
          read.index = index;
          const range = {
            eq: (field: string, value: unknown) => { selected = selected.filter((row) => row[field] === value); return range; },
            gt: (field: string, value: number) => { selected = selected.filter((row) => typeof row[field] === "number" && (row[field] as number) > value); return range; },
          };
          configure(range);
          return builder;
        },
        order: (_direction: string) => {
          selected.sort((a, b) => Number(a.betaRequestedAt ?? 0) - Number(b.betaRequestedAt ?? 0));
          return builder;
        },
        unique: async () => selected[0] ?? null,
        take: async (n: number) => selected.slice(0, n),
        paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
          read.limit = numItems;
          queryReads.push(read);
          const offset = Number(cursor ?? 0);
          return { page: selected.slice(offset, offset + numItems), continueCursor: String(offset + numItems), isDone: offset + numItems >= selected.length };
        },
      };
      return builder;
    },
  };
  const as = (id: string | null) => ({ db, auth: { getUserIdentity: async () => id ? { subject: `${id}|session` } : null } });
  return { rows, seed, db, as, queryReads };
}

// Registered Convex handlers are executed with a small in-memory DB and synthetic auth.
type Handler = { _handler: (ctx: unknown, args: unknown) => Promise<unknown> };
function run(fn: unknown, ctx: unknown, args: unknown = {}) {
  return (fn as Handler)._handler(ctx, args);
}

describe("beta request ownership and queue", () => {
  test("anonymous requests fail and an authenticated request only changes its owner", async () => {
    const w = world();
    await expect(run(approval.requestBetaAccess, w.as(null))).rejects.toThrow("Not authenticated");
    expect(await run(approval.requestBetaAccess, w.as("users:alice"))).toEqual({ status: "requested" });
    expect(w.rows.get("users:alice")).toMatchObject({ approvalStatus: "pending", userType: "free", entitlementTier: "none", betaAccess: "none" });
    expect(w.rows.get("users:bob")?.betaRequestedAt).toBeUndefined();
    expect([...w.rows.keys()].filter((key) => key.startsWith("subscriptionStates:"))).toEqual([]);
  });

  test("repeating a request keeps its original timestamp", async () => {
    const w = world();
    await run(approval.requestBetaAccess, w.as("users:alice"));
    const first = structuredClone(w.rows.get("users:alice"));
    await run(approval.requestBetaAccess, w.as("users:alice"));
    expect(w.rows.get("users:alice")).toEqual(first);
  });

  test("revoked, deleted and deactivated owners cannot reopen requests", async () => {
    for (const state of [{ approvalStatus: "revoked" }, { deletedAt: 5 }, { isActive: false }]) {
      const w = world();
      await w.db.patch("users:alice", state);
      expect(await run(approval.requestBetaAccess, w.as("users:alice"))).toEqual({ status: "unavailable" });
      expect(w.rows.get("users:alice")?.betaRequestedAt).toBeUndefined();
    }
  });

  test("only the existing admin authorization can list or decide another account", async () => {
    const w = world();
    await expect(run(approval.listBetaRequests, w.as(null), { cursor: null, numItems: 10 })).rejects.toThrow();
    await expect(run(approval.listBetaRequests, w.as("users:alice"), { cursor: null, numItems: 10 })).rejects.toThrow("Access denied");
    await expect(run(approval.setStatus, w.as("users:alice"), { userId: "users:bob", status: "approved" })).rejects.toThrow("Access denied");
    await expect(run(approval.setStatus, w.as("users:alice"), { userId: "users:alice", status: "approved" })).rejects.toThrow("Access denied");
    expect(w.rows.get("users:bob")?.approvalStatus).toBe("pending");
  });

  test("the queue paginates the correct index at 50 rows and preserves continuation", async () => {
    const w = world();
    for (let i = 0; i < 60; i += 1) w.seed(`users:request${i}`, { email: `fixture${i}@example.invalid`, approvalStatus: "pending", betaRequestedAt: i + 1 });
    w.seed("users:deleted", { deletedAt: 2, betaRequestedAt: 1 });
    const first = await run(approval.listBetaRequests, w.as("users:admin"), { cursor: null, numItems: 50 }) as { page: unknown[]; continueCursor: string; isDone: boolean };
    expect(first.page).toHaveLength(50);
    expect(first.isDone).toBe(false);
    const last = await run(approval.listBetaRequests, w.as("users:admin"), { cursor: first.continueCursor, numItems: 50 }) as typeof first;
    expect(last.page).toHaveLength(10);
    expect(last.isDone).toBe(true);
    expect(w.queryReads).toEqual([{ index: "by_deletedAt_betaRequestedAt", limit: 50 }, { index: "by_deletedAt_betaRequestedAt", limit: 50 }]);
    for (const numItems of [0, 51, 1.5, Number.NaN]) {
      await expect(run(approval.listBetaRequests, w.as("users:admin"), { cursor: null, numItems })).rejects.toThrow();
    }
  });

  test("filtering an unavailable row does not lose the underlying bounded page cursor", async () => {
    const w = world();
    w.seed("users:revoked", { approvalStatus: "revoked", betaRequestedAt: 1 });
    w.seed("users:waiting", { email: "waiting@example.invalid", approvalStatus: "pending", betaRequestedAt: 2 });
    const first = await run(approval.listBetaRequests, w.as("users:admin"), { cursor: null, numItems: 1 }) as { page: unknown[]; continueCursor: string; isDone: boolean };
    expect(first).toEqual({ page: [], continueCursor: "1", isDone: false });
    const next = await run(approval.listBetaRequests, w.as("users:admin"), { cursor: first.continueCursor, numItems: 1 }) as typeof first;
    expect(next.page).toEqual([{ id: "users:waiting", email: "waiting@example.invalid", name: null, requestedAt: 2 }]);
  });
});

describe("explicit admin beta approval", () => {
  test("approval grants Max once in the account and canonical subscription", async () => {
    const w = world();
    await run(approval.requestBetaAccess, w.as("users:alice"));
    await run(approval.setStatus, w.as("users:admin"), { userId: "users:alice", status: "approved" });
    expect(w.rows.get("users:alice")).toMatchObject({ approvalStatus: "approved", betaAccess: "tester", userType: "paid", entitlementTier: "max" });
    expect(w.rows.get("users:alice")?.betaRequestedAt).toBeUndefined();
    const subscriptions = [...w.rows.values()].filter((row) => row._id.startsWith("subscriptionStates:"));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ plan: "max", status: "active", billingCycle: "lifetime", source: "beta_approval", userId: "users:alice" });
    expect(await run(approval.requestBetaAccess, w.as("users:alice"))).toEqual({ status: "approved" });
    await w.db.patch("users:alice", { userType: "free", entitlementTier: "none" });
    await w.db.patch(subscriptions[0]?._id as string, { status: "cancelled" });
    await run(approval.setStatus, w.as("users:admin"), { userId: "users:alice", status: "approved" });
    expect(w.rows.get("users:alice")).toMatchObject({ userType: "free", entitlementTier: "none" });
    expect(w.rows.get(subscriptions[0]?._id as string)?.status).toBe("cancelled");
    expect([...w.rows.keys()].filter((key) => key.startsWith("subscriptionStates:"))).toHaveLength(1);
  });

  test("ordinary admin approval without an explicit beta request creates no grant", async () => {
    const w = world();
    await run(approval.setStatus, w.as("users:admin"), { userId: "users:alice", status: "approved" });
    expect(w.rows.get("users:alice")).toMatchObject({ approvalStatus: "approved", userType: "free", entitlementTier: "none" });
    expect(w.rows.get("users:alice")?.betaApprovedAt).toBeUndefined();
  });

  test("the internal email decision uses the same explicit grant policy", async () => {
    const w = world();
    await run(approval.requestBetaAccess, w.as("users:alice"));
    await run(approval.setStatusByEmail, w.as(null), { email: " ALICE@example.invalid ", status: "approved" });
    expect(w.rows.get("users:alice")).toMatchObject({ betaAccess: "tester", entitlementTier: "max", approvalUpdatedBy: "cli" });
  });

  test("pending or revoked decisions consume the request without a grant", async () => {
    for (const status of ["pending", "revoked"]) {
      const w = world();
      await run(approval.requestBetaAccess, w.as("users:alice"));
      await run(approval.setStatus, w.as("users:admin"), { userId: "users:alice", status });
      expect(w.rows.get("users:alice")).toMatchObject({ approvalStatus: status, userType: "free", entitlementTier: "none" });
      expect(w.rows.get("users:alice")?.betaRequestedAt).toBeUndefined();
      expect([...w.rows.keys()].filter((key) => key.startsWith("subscriptionStates:"))).toHaveLength(0);
    }
  });

  test("a paid purchase and a founder account survive approval unchanged", async () => {
    for (const account of [{ betaAccess: "none", entitlementTier: "pro", userType: "paid" }, { betaAccess: "founder", entitlementTier: "max", userType: "paid" }]) {
      const w = world();
      await w.db.patch("users:alice", account);
      const sub = w.seed("subscriptionStates:paid", { userId: "users:alice", plan: "pro", status: "active", billingCycle: "annual", source: "revenuecat" });
      const original = structuredClone(w.rows.get(sub));
      await run(approval.requestBetaAccess, w.as("users:alice"));
      await run(approval.setStatus, w.as("users:admin"), { userId: "users:alice", status: "approved" });
      expect(w.rows.get("users:alice")).toMatchObject(account);
      expect(w.rows.get(sub)).toEqual(original);
      expect(w.rows.get("users:alice")?.betaApprovedAt).toBeNumber();
    }
  });

  test("existing approved testers keep Max and never acquire another subscription", async () => {
    const w = world();
    await w.db.patch("users:alice", { approvalStatus: "approved", betaAccess: "tester", entitlementTier: "max", userType: "paid" });
    const before = structuredClone(w.rows.get("users:alice"));
    expect(await run(approval.requestBetaAccess, w.as("users:alice"))).toEqual({ status: "approved" });
    expect(w.rows.get("users:alice")).toEqual(before);
  });

  test("only the exact old placeholder is replaced, never cancelled billing", async () => {
    const applicant = { betaRequestedAt: 1, userType: "free" as const, entitlementTier: "none" as const };
    expect(betaApprovalGrant(applicant, { plan: "none", status: "inactive", billingCycle: "none", source: "beta_signup" })).toEqual({ grantAccess: true, writeSubscription: true });
    expect(betaApprovalGrant(applicant, { plan: "max", status: "cancelled", billingCycle: "lifetime", source: "open_signup_grant" })).toEqual({ grantAccess: false, writeSubscription: false });
    expect(betaApprovalGrant({ ...applicant, deletedAt: 1 })).toBeNull();
    expect(betaRequestStatus({ approvalStatus: "revoked", betaApprovedAt: 1 })).toBe("unavailable");
  });
});
