import { expect, test } from "bun:test";

import { planProposalDecision } from "./proposal-decision";

function pendingProposal() {
  return {
    status: "pending" as const,
    taskIds: ["task-1"],
    tenSecondAction: "Open the document",
    realism: {
      ok: true,
      totalMinutes: 20,
      availableMinutes: 30,
      note: "Fits the available time.",
    },
    createdAt: 100,
  };
}

test("plans accepting a pending proposal", () => {
  expect(planProposalDecision(pendingProposal(), "accept", 200)).toEqual({
    ok: true,
    patch: { status: "accepted", decidedAt: 200 },
    changedFields: ["status", "decidedAt"],
  });
});

test("plans rejecting a pending proposal", () => {
  expect(planProposalDecision(pendingProposal(), "reject", 201)).toEqual({
    ok: true,
    patch: { status: "rejected", decidedAt: 201 },
    changedFields: ["status", "decidedAt"],
  });
});

test("refuses an already accepted proposal", () => {
  expect(
    planProposalDecision(
      { ...pendingProposal(), status: "accepted", decidedAt: 150 },
      "reject",
      200
    )
  ).toEqual({ ok: false, reason: "already-decided" });
});

test("refuses a deleted proposal", () => {
  expect(planProposalDecision({ ...pendingProposal(), deletedAt: 150 }, "accept", 200)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("refuses an invalid stored document", () => {
  expect(planProposalDecision({ status: "pending" }, "accept", 200)).toEqual({
    ok: false,
    reason: "invalid-proposal",
  });
});

test("refuses an invalid decision", () => {
  expect(planProposalDecision(pendingProposal(), "later" as "accept", 200)).toEqual({
    ok: false,
    reason: "invalid-decision",
  });
});

test("refuses invalid now values without mutating the input", () => {
  const stored = pendingProposal();
  const before = structuredClone(stored);

  for (const now of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(planProposalDecision(stored, "accept", now)).toEqual({
      ok: false,
      reason: "invalid-now",
    });
  }
  expect(stored).toEqual(before);
});
