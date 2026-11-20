import { checkCoachProposalDoc } from "../firestore-docs/coach-proposal-doc";

type ProposalDecisionPlan =
  | {
      ok: true;
      patch: {
        status: "accepted" | "rejected";
        decidedAt: number;
      };
      changedFields: ["status", "decidedAt"];
    }
  | {
      ok: false;
      reason:
        | "invalid-proposal"
        | "already-decided"
        | "deleted"
        | "invalid-decision"
        | "invalid-now";
    };

export function planProposalDecision(
  stored: unknown,
  decision: "accept" | "reject",
  now: number
): ProposalDecisionPlan {
  const checked = checkCoachProposalDoc(stored);
  if (!checked.ok) {
    return { ok: false, reason: "invalid-proposal" };
  }

  if (checked.doc.deletedAt !== undefined) {
    return { ok: false, reason: "deleted" };
  }

  if (checked.doc.status !== "pending") {
    return { ok: false, reason: "already-decided" };
  }

  if (decision !== "accept" && decision !== "reject") {
    return { ok: false, reason: "invalid-decision" };
  }

  if (!Number.isFinite(now) || now <= 0) {
    return { ok: false, reason: "invalid-now" };
  }

  return {
    ok: true,
    patch: {
      status: decision === "accept" ? "accepted" : "rejected",
      decidedAt: now,
    },
    changedFields: ["status", "decidedAt"],
  };
}
