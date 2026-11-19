export type PageProposalDoc = {
  kind: "add_task_to_today";
  schemaVersion: 1;
  noteId: string;
  localDate: string;
  conversationId: string;
  sourceRequestKey: string;
  sourceAgentPromptId?: string;
  proposalRevision: number;
  expectedPageRevision: number;
  blockId: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "expired";
  proposalExpiresAtMs: number;
  cleanupDueAtMs: number;
  metadataExpiresAtMs: number;
  payload:
    | { state: "available"; task: { title: string; durationMin: number } }
    | { state: "expired"; expiredAtMs: number };
  decidedAtMs?: number;
  confirmedOperationId?: string;
  confirmDigest?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckResult = { ok: true; doc: PageProposalDoc } | { ok: false; reason: string };

const TOP_LEVEL_KEYS = new Set([
  "kind",
  "schemaVersion",
  "noteId",
  "localDate",
  "conversationId",
  "sourceRequestKey",
  "sourceAgentPromptId",
  "proposalRevision",
  "expectedPageRevision",
  "blockId",
  "status",
  "proposalExpiresAtMs",
  "cleanupDueAtMs",
  "metadataExpiresAtMs",
  "payload",
  "decidedAtMs",
  "confirmedOperationId",
  "confirmDigest",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const STATUSES = new Set(["pending", "confirmed", "rejected", "cancelled", "expired"]);
const SOURCE_REQUEST_KEY = /^[A-Za-z0-9_-]{1,128}$/;
const BLOCK_ID = /^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const LOWERCASE_SHA_256 = /^[0-9a-f]{64}$/;
const MAX_TASK_TITLE_LENGTH = 500;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function hasOnlyKeys(input: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(input).every((key) => allowed.has(key));
}

function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && !value.includes("/");
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRealLocalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function checkPayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (payload.state === "available") {
    if (!hasOnlyKeys(payload, new Set(["state", "task"])) || !isRecord(payload.task)) return false;
    if (!hasOnlyKeys(payload.task, new Set(["title", "durationMin"]))) return false;
    if (
      typeof payload.task.title !== "string" ||
      payload.task.title.trim() === "" ||
      payload.task.title.length > MAX_TASK_TITLE_LENGTH ||
      [...payload.task.title].length > MAX_TASK_TITLE_LENGTH
    ) {
      return false;
    }
    return (
      Number.isInteger(payload.task.durationMin) &&
      (payload.task.durationMin as number) >= 1 &&
      (payload.task.durationMin as number) <= 1440
    );
  }
  if (payload.state === "expired") {
    return (
      hasOnlyKeys(payload, new Set(["state", "expiredAtMs"])) &&
      isSafeNonnegativeInteger(payload.expiredAtMs)
    );
  }
  return false;
}

export function checkPageProposalDoc(input: unknown): CheckResult {
  if (!isRecord(input)) return { ok: false, reason: "proposal must be an object" };
  if (!hasOnlyKeys(input, TOP_LEVEL_KEYS)) {
    return { ok: false, reason: "proposal has an unknown key" };
  }
  if (input.kind !== "add_task_to_today") return { ok: false, reason: "kind is invalid" };
  if (input.schemaVersion !== 1) return { ok: false, reason: "schemaVersion is invalid" };
  if (!isDocumentId(input.noteId) || !isDocumentId(input.conversationId)) {
    return { ok: false, reason: "document id is invalid" };
  }
  if (!isRealLocalDate(input.localDate)) return { ok: false, reason: "localDate is invalid" };
  if (
    typeof input.sourceRequestKey !== "string" ||
    !SOURCE_REQUEST_KEY.test(input.sourceRequestKey)
  ) {
    return { ok: false, reason: "sourceRequestKey is invalid" };
  }
  if (
    "sourceAgentPromptId" in input &&
    (typeof input.sourceAgentPromptId !== "string" ||
      input.sourceAgentPromptId.length < 1 ||
      input.sourceAgentPromptId.length > 256)
  ) {
    return { ok: false, reason: "sourceAgentPromptId is invalid" };
  }
  if (
    !isSafeNonnegativeInteger(input.proposalRevision) ||
    !isSafeNonnegativeInteger(input.expectedPageRevision)
  ) {
    return { ok: false, reason: "revisions must be safe nonnegative integers" };
  }
  if (typeof input.blockId !== "string" || !BLOCK_ID.test(input.blockId)) {
    return { ok: false, reason: "blockId is invalid" };
  }
  if (typeof input.status !== "string" || !STATUSES.has(input.status)) {
    return { ok: false, reason: "status is invalid" };
  }
  if (!checkPayload(input.payload)) return { ok: false, reason: "payload is invalid" };
  if ("confirmedOperationId" in input && !isDocumentId(input.confirmedOperationId)) {
    return { ok: false, reason: "confirmedOperationId is invalid" };
  }
  if (
    "confirmDigest" in input &&
    (typeof input.confirmDigest !== "string" || !LOWERCASE_SHA_256.test(input.confirmDigest))
  ) {
    return { ok: false, reason: "confirmDigest is invalid" };
  }

  const timestampKeys = [
    "proposalExpiresAtMs",
    "cleanupDueAtMs",
    "metadataExpiresAtMs",
    "createdAt",
    "updatedAt",
  ] as const;
  if (timestampKeys.some((key) => !isSafeNonnegativeInteger(input[key]))) {
    return { ok: false, reason: "timestamps must be safe nonnegative integers" };
  }
  if (
    ("decidedAtMs" in input && !isSafeNonnegativeInteger(input.decidedAtMs)) ||
    ("deletedAt" in input && !isSafeNonnegativeInteger(input.deletedAt))
  ) {
    return { ok: false, reason: "timestamps must be safe nonnegative integers" };
  }
  if ((input.updatedAt as number) < (input.createdAt as number)) {
    return { ok: false, reason: "updatedAt must not be earlier than createdAt" };
  }

  return { ok: true, doc: input as PageProposalDoc };
}

export function softDeletePageProposal(doc: PageProposalDoc, nowMs: number): PageProposalDoc {
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
