import { describe, expect, test } from "bun:test";
import { type CoachProposalDoc, checkCoachProposalDoc } from "./coach-proposal-doc";

const pending: CoachProposalDoc = {
  status: "pending",
  taskIds: ["task-1", "task-2"],
  tenSecondAction: "Open the task list",
  realism: {
    ok: true,
    totalMinutes: 20,
    availableMinutes: 30,
    note: "Fits today",
  },
  createdAt: 1_700_000_000_000,
};

describe("checkCoachProposalDoc", () => {
  test("accepts a valid pending proposal", () => {
    expect(checkCoachProposalDoc(pending)).toEqual({ ok: true, doc: pending });
  });

  test("accepts a valid accepted proposal with decidedAt", () => {
    const accepted: CoachProposalDoc = {
      ...pending,
      status: "accepted",
      decidedAt: pending.createdAt + 1,
    };
    expect(checkCoachProposalDoc(accepted)).toEqual({
      ok: true,
      doc: accepted,
    });
  });

  test("refuses a proposal with userId", () => {
    expect(checkCoachProposalDoc({ ...pending, userId: "user-1" }).ok).toBe(false);
  });

  test("refuses a proposal with an empty-string key", () => {
    expect(checkCoachProposalDoc({ ...pending, "": 1 }).ok).toBe(false);
  });

  test("refuses status applied", () => {
    expect(checkCoachProposalDoc({ ...pending, status: "applied" }).ok).toBe(false);
  });

  test("refuses an accepted proposal without decidedAt", () => {
    expect(checkCoachProposalDoc({ ...pending, status: "accepted" }).ok).toBe(false);
  });

  test("refuses a pending proposal with decidedAt", () => {
    expect(checkCoachProposalDoc({ ...pending, decidedAt: pending.createdAt + 1 }).ok).toBe(false);
  });

  test("refuses a realism object with an extra key", () => {
    expect(
      checkCoachProposalDoc({
        ...pending,
        realism: { ...pending.realism, confidence: 1 },
      }).ok
    ).toBe(false);
  });
});
