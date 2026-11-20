import { describe, expect, test } from "bun:test";
import { buildApprovalPatch, type ApprovalDecision } from "./approval-patch";

describe("buildApprovalPatch", () => {
  test("approves a pending gate with the approval timestamp", () => {
    expect(
      buildApprovalPatch({
        gate: { approvalStatus: "pending" },
        targetIsAdmin: false,
        decision: "approved",
        decidedBy: "  admin@example.com  ",
        now: 100,
      })
    ).toEqual({
      ok: true,
      patch: {
        approvalStatus: "approved",
        approvalUpdatedAt: 100,
        approvalUpdatedBy: "admin@example.com",
        updatedAt: 100,
        betaApprovedAt: 100,
      },
      changedFields: [
        "approvalStatus",
        "approvalUpdatedAt",
        "approvalUpdatedBy",
        "betaApprovedAt",
        "updatedAt",
      ],
    });
  });

  test("preserves an existing approval timestamp", () => {
    const result = buildApprovalPatch({
      gate: { approvalStatus: "pending", betaApprovedAt: 50 },
      targetIsAdmin: false,
      decision: "approved",
      decidedBy: "admin@example.com",
      now: 100,
    });

    expect(result.ok && result.patch).toEqual({
      approvalStatus: "approved",
      approvalUpdatedAt: 100,
      approvalUpdatedBy: "admin@example.com",
      updatedAt: 100,
    });
    expect(result.ok && result.changedFields).not.toContain("betaApprovedAt");
  });

  test("revokes an approved gate without an approval timestamp", () => {
    expect(
      buildApprovalPatch({
        gate: { approvalStatus: "approved", betaApprovedAt: 50 },
        targetIsAdmin: false,
        decision: "revoked",
        decidedBy: "admin@example.com",
        now: 100,
      })
    ).toEqual({
      ok: true,
      patch: {
        approvalStatus: "revoked",
        approvalUpdatedAt: 100,
        approvalUpdatedBy: "admin@example.com",
        updatedAt: 100,
      },
      changedFields: ["approvalStatus", "approvalUpdatedAt", "approvalUpdatedBy", "updatedAt"],
    });
  });

  test("refuses admins identified by the gate or caller", () => {
    const base = { decision: "approved" as const, decidedBy: "admin@example.com", now: 100 };
    expect(buildApprovalPatch({ ...base, gate: { role: "admin" }, targetIsAdmin: false })).toEqual({
      ok: false,
      reason: "admin",
    });
    expect(buildApprovalPatch({ ...base, gate: {}, targetIsAdmin: true })).toEqual({
      ok: false,
      reason: "admin",
    });
  });

  test("refuses missing, deleted, and unchanged gates", () => {
    const base = {
      targetIsAdmin: false,
      decision: "approved" as const,
      decidedBy: "admin@example.com",
      now: 100,
    };
    expect(buildApprovalPatch({ ...base, gate: null })).toEqual({ ok: false, reason: "missing" });
    expect(buildApprovalPatch({ ...base, gate: { deletedAt: 50 } })).toEqual({
      ok: false,
      reason: "deleted",
    });
    expect(buildApprovalPatch({ ...base, gate: { approvalStatus: "approved" } })).toEqual({
      ok: false,
      reason: "unchanged",
    });
  });

  test("refuses a bad decision, blank decider, and non-integer time", () => {
    const base = {
      gate: {},
      targetIsAdmin: false,
      decision: "approved" as ApprovalDecision,
      decidedBy: "admin@example.com",
      now: 100,
    };
    expect(buildApprovalPatch({ ...base, decision: "pending" as ApprovalDecision })).toEqual({
      ok: false,
      reason: "bad-input",
    });
    expect(buildApprovalPatch({ ...base, decidedBy: "  " })).toEqual({
      ok: false,
      reason: "bad-input",
    });
    expect(buildApprovalPatch({ ...base, now: 100.5 })).toEqual({
      ok: false,
      reason: "bad-input",
    });
  });
});
