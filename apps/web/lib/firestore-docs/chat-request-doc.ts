export type ChatRequestStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ChatRequestDoc = {
  conversationId: string;
  requestKey: string;
  payloadDigest: string;
  sequence: number;
  status: ChatRequestStatus;
  agentPromptMessageId: string;
  generationEpoch: number;
  createdAt: number;
  updatedAt: number;
  agentResultMessageId?: string;
  generationLeaseExpiresAtMs?: number;
  deletedAt?: number;
};

type CheckResult = { ok: true; doc: ChatRequestDoc } | { ok: false; reason: string };

const REQUIRED_KEYS = [
  "conversationId",
  "requestKey",
  "payloadDigest",
  "sequence",
  "status",
  "agentPromptMessageId",
  "generationEpoch",
  "createdAt",
  "updatedAt",
] as const;

const ALLOWED_KEYS = new Set<string>([
  ...REQUIRED_KEYS,
  "agentResultMessageId",
  "generationLeaseExpiresAtMs",
  "deletedAt",
]);

const STATUSES = new Set<ChatRequestStatus>([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

function isSafeNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function checkChatRequestDoc(input: unknown): CheckResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "Chat request must be an object" };
  }

  const candidate = input as Record<string, unknown>;
  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, reason: `Unknown field: ${key}` };
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (!Object.hasOwn(candidate, key)) {
      return { ok: false, reason: `Missing field: ${key}` };
    }
  }

  if (
    typeof candidate.conversationId !== "string" ||
    candidate.conversationId.trim() === "" ||
    candidate.conversationId.includes("/")
  ) {
    return {
      ok: false,
      reason: "conversationId must be non-blank and contain no slash",
    };
  }
  if (
    typeof candidate.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(candidate.requestKey)
  ) {
    return {
      ok: false,
      reason: "requestKey must be a 1-128 character ASCII identifier",
    };
  }
  if (
    typeof candidate.payloadDigest !== "string" ||
    !/^[0-9a-f]{64}$/.test(candidate.payloadDigest)
  ) {
    return {
      ok: false,
      reason: "payloadDigest must be 64 lowercase hexadecimal characters",
    };
  }
  if (!isSafeNonnegativeInteger(candidate.sequence)) {
    return { ok: false, reason: "sequence must be a safe nonnegative integer" };
  }
  if (
    typeof candidate.status !== "string" ||
    !STATUSES.has(candidate.status as ChatRequestStatus)
  ) {
    return { ok: false, reason: "status is invalid" };
  }
  if (
    typeof candidate.agentPromptMessageId !== "string" ||
    candidate.agentPromptMessageId.trim() === ""
  ) {
    return { ok: false, reason: "agentPromptMessageId must be non-blank" };
  }
  if (!isSafeNonnegativeInteger(candidate.generationEpoch)) {
    return {
      ok: false,
      reason: "generationEpoch must be a safe nonnegative integer",
    };
  }

  for (const key of ["createdAt", "updatedAt"] as const) {
    if (!isSafeNonnegativeInteger(candidate[key])) {
      return { ok: false, reason: `${key} must be a safe nonnegative integer` };
    }
  }
  for (const key of ["generationLeaseExpiresAtMs", "deletedAt"] as const) {
    if (candidate[key] !== undefined && !isSafeNonnegativeInteger(candidate[key])) {
      return { ok: false, reason: `${key} must be a safe nonnegative integer` };
    }
  }
  if ((candidate.updatedAt as number) < (candidate.createdAt as number)) {
    return {
      ok: false,
      reason: "updatedAt must not be earlier than createdAt",
    };
  }
  if (
    candidate.agentResultMessageId !== undefined &&
    typeof candidate.agentResultMessageId !== "string"
  ) {
    return { ok: false, reason: "agentResultMessageId must be a string" };
  }

  return { ok: true, doc: candidate as ChatRequestDoc };
}

export function softDeleteChatRequest(doc: ChatRequestDoc, nowMs: number): ChatRequestDoc {
  if (!isSafeNonnegativeInteger(nowMs) || nowMs < doc.createdAt) {
    throw new RangeError(
      "Deletion timestamp must be a safe nonnegative integer not earlier than createdAt"
    );
  }

  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
