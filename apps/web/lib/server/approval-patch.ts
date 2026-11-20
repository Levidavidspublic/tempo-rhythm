export type ApprovalDecision = "approved" | "revoked";

export type ApprovalPatch = {
  approvalStatus: ApprovalDecision;
  approvalUpdatedAt: number;
  approvalUpdatedBy: string;
  updatedAt: number;
  betaApprovedAt?: number;
};

export type ApprovalPatchResult =
  | { ok: true; patch: ApprovalPatch; changedFields: string[] }
  | { ok: false; reason: "missing" | "deleted" | "admin" | "unchanged" | "bad-input" };

type ApprovalGate = {
  role?: string;
  approvalStatus?: string;
  deletedAt?: number | null;
  betaApprovedAt?: number;
};

export function buildApprovalPatch(input: {
  gate: ApprovalGate | null | undefined;
  targetIsAdmin: boolean;
  decision: ApprovalDecision;
  decidedBy: string;
  now: number;
}): ApprovalPatchResult {
  const decidedBy = typeof input.decidedBy === "string" ? input.decidedBy.trim() : "";
  if (
    (input.decision !== "approved" && input.decision !== "revoked") ||
    decidedBy.length === 0 ||
    decidedBy.length > 254 ||
    !Number.isSafeInteger(input.now) ||
    input.now <= 0
  ) {
    return { ok: false, reason: "bad-input" };
  }

  const { gate } = input;
  if (gate === null || gate === undefined) {
    return { ok: false, reason: "missing" };
  }
  if (typeof gate.deletedAt === "number") {
    return { ok: false, reason: "deleted" };
  }
  if (input.targetIsAdmin || gate.role === "admin") {
    return { ok: false, reason: "admin" };
  }
  if (gate.approvalStatus === input.decision) {
    return { ok: false, reason: "unchanged" };
  }

  const patch: ApprovalPatch = {
    approvalStatus: input.decision,
    approvalUpdatedAt: input.now,
    approvalUpdatedBy: decidedBy,
    updatedAt: input.now,
    ...(input.decision === "approved" && gate.betaApprovedAt === undefined
      ? { betaApprovedAt: input.now }
      : {}),
  };

  return { ok: true, patch, changedFields: Object.keys(patch).sort() };
}
