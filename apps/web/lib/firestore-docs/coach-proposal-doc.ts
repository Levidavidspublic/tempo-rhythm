export type CoachProposalDoc = {
  status: "pending" | "accepted" | "rejected";
  taskIds: string[];
  tenSecondAction: string;
  realism: {
    ok: boolean;
    totalMinutes: number;
    availableMinutes: number;
    note: string;
  };
  createdAt: number;
  decidedAt?: number;
  deletedAt?: number;
};

type CoachProposalDocCheck = { ok: true; doc: CoachProposalDoc } | { ok: false; reason: string };

const DOC_KEYS = new Set([
  "status",
  "taskIds",
  "tenSecondAction",
  "realism",
  "createdAt",
  "decidedAt",
  "deletedAt",
]);
const REALISM_KEYS = new Set(["ok", "totalMinutes", "availableMinutes", "note"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactlyAllowedKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
): boolean {
  const keys = Object.keys(value);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCoachProposalDoc(input: unknown): CoachProposalDocCheck {
  if (!isPlainObject(input)) {
    return { ok: false, reason: "Proposal must be a plain object." };
  }

  const keys = Object.keys(input);
  const unexpectedKey = keys.find((key) => !DOC_KEYS.has(key));
  if (unexpectedKey !== undefined) {
    return { ok: false, reason: `Unexpected proposal key: ${unexpectedKey}.` };
  }
  const hasDecidedAt = Object.hasOwn(input, "decidedAt");
  const hasDeletedAt = Object.hasOwn(input, "deletedAt");

  const { status, taskIds, tenSecondAction, realism, createdAt, decidedAt, deletedAt } = input;
  if (status !== "pending" && status !== "accepted" && status !== "rejected") {
    return {
      ok: false,
      reason: "Proposal status must be pending, accepted, or rejected.",
    };
  }
  if (
    !Array.isArray(taskIds) ||
    Array.from(taskIds).some(
      (taskId) => typeof taskId !== "string" || taskId.trim().length === 0
    ) ||
    new Set(Array.from(taskIds)).size !== taskIds.length
  ) {
    return {
      ok: false,
      reason: "taskIds must contain unique, non-empty strings.",
    };
  }
  if (typeof tenSecondAction !== "string" || tenSecondAction.trim().length === 0) {
    return { ok: false, reason: "tenSecondAction must be a non-empty string." };
  }
  if (!isPlainObject(realism) || !hasExactlyAllowedKeys(realism, REALISM_KEYS)) {
    return {
      ok: false,
      reason: "realism must contain exactly its four supported fields.",
    };
  }
  if (typeof realism.ok !== "boolean") {
    return { ok: false, reason: "realism.ok must be a boolean." };
  }
  if (!isFiniteNumber(realism.totalMinutes) || realism.totalMinutes < 0) {
    return {
      ok: false,
      reason: "realism.totalMinutes must be a non-negative finite number.",
    };
  }
  if (!isFiniteNumber(realism.availableMinutes) || realism.availableMinutes < 0) {
    return {
      ok: false,
      reason: "realism.availableMinutes must be a non-negative finite number.",
    };
  }
  if (typeof realism.note !== "string") {
    return { ok: false, reason: "realism.note must be a string." };
  }
  if (!isFiniteNumber(createdAt)) {
    return { ok: false, reason: "createdAt must be a finite number." };
  }
  if (hasDecidedAt && !isFiniteNumber(decidedAt)) {
    return {
      ok: false,
      reason: "decidedAt must be a finite number when present.",
    };
  }
  if (hasDeletedAt && !isFiniteNumber(deletedAt)) {
    return {
      ok: false,
      reason: "deletedAt must be a finite number when present.",
    };
  }
  if (status === "pending" && hasDecidedAt) {
    return { ok: false, reason: "A pending proposal must not have decidedAt." };
  }
  if (status !== "pending" && !hasDecidedAt) {
    return {
      ok: false,
      reason: "An accepted or rejected proposal must have decidedAt.",
    };
  }

  const doc: CoachProposalDoc = {
    status,
    taskIds: [...taskIds],
    tenSecondAction,
    realism: {
      ok: realism.ok,
      totalMinutes: realism.totalMinutes,
      availableMinutes: realism.availableMinutes,
      note: realism.note,
    },
    createdAt,
  };
  if (hasDecidedAt) {
    doc.decidedAt = decidedAt as number;
  }
  if (hasDeletedAt) {
    doc.deletedAt = deletedAt as number;
  }
  return { ok: true, doc };
}

export function checkCoachProposalDoc(input: unknown): CoachProposalDocCheck {
  try {
    return validateCoachProposalDoc(input);
  } catch {
    return { ok: false, reason: "Proposal could not be inspected." };
  }
}
