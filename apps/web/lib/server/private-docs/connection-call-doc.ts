export type ConnectionCallDoc = {
  connectionId: string;
  kind: "tool_call" | "disconnect";
  tool?: string;
  path?: string;
  decision?: "auto" | "approved" | "rejected" | "blocked";
  outcome:
    | "ok"
    | "error"
    | "approval_required"
    | "timeout"
    | "rate_limited"
    | "unauthorized"
    | "revoked"
    | "not_revoked";
  inputDigest?: string;
  resultBytes?: number;
  durationMs?: number;
  messageId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const CONNECTION_CALL_KEYS = new Set<keyof ConnectionCallDoc>([
  "connectionId",
  "kind",
  "tool",
  "path",
  "decision",
  "outcome",
  "inputDigest",
  "resultBytes",
  "durationMs",
  "messageId",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const KINDS = new Set<ConnectionCallDoc["kind"]>(["tool_call", "disconnect"]);
const DECISIONS = new Set<NonNullable<ConnectionCallDoc["decision"]>>([
  "auto",
  "approved",
  "rejected",
  "blocked",
]);
const OUTCOMES = new Set<ConnectionCallDoc["outcome"]>([
  "ok",
  "error",
  "approval_required",
  "timeout",
  "rate_limited",
  "unauthorized",
  "revoked",
  "not_revoked",
]);

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function validateConnectionCallDoc(
  input: unknown
): { ok: true; doc: ConnectionCallDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "connection call must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(
    (key) => !CONNECTION_CALL_KEYS.has(key as keyof ConnectionCallDoc)
  );
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (typeof value.connectionId !== "string" || value.connectionId.length === 0) {
    return { ok: false, reason: "connectionId must be a non-empty string" };
  }
  if (!KINDS.has(value.kind as ConnectionCallDoc["kind"])) {
    return { ok: false, reason: "invalid kind" };
  }
  if (!isOptionalString(value.tool) || (value.tool?.length ?? 0) > 200) {
    return { ok: false, reason: "tool must be a string no longer than 200 characters" };
  }
  if (value.kind === "tool_call" && (typeof value.tool !== "string" || value.tool.length === 0)) {
    return { ok: false, reason: "tool_call requires a non-empty tool" };
  }
  if (!isOptionalString(value.path) || (value.path?.length ?? 0) > 200) {
    return { ok: false, reason: "path must be a string no longer than 200 characters" };
  }
  if (
    value.decision !== undefined &&
    !DECISIONS.has(value.decision as NonNullable<ConnectionCallDoc["decision"]>)
  ) {
    return { ok: false, reason: "invalid decision" };
  }
  if (!OUTCOMES.has(value.outcome as ConnectionCallDoc["outcome"])) {
    return { ok: false, reason: "invalid outcome" };
  }
  if (
    value.inputDigest !== undefined &&
    (typeof value.inputDigest !== "string" || !/^[0-9a-f]{64}$/.test(value.inputDigest))
  ) {
    return { ok: false, reason: "inputDigest must be 64 lower-case hexadecimal characters" };
  }
  if (!isOptionalString(value.messageId)) {
    return { ok: false, reason: "messageId must be a string" };
  }

  for (const key of [
    "resultBytes",
    "durationMs",
    "deletedAt",
  ] as const satisfies readonly (keyof ConnectionCallDoc)[]) {
    if (value[key] !== undefined && !isSafeNonNegativeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe non-negative integer` };
    }
  }
  for (const key of ["createdAt", "updatedAt"] as const) {
    if (!isSafeNonNegativeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe non-negative integer` };
    }
  }

  return { ok: true, doc: value as ConnectionCallDoc };
}

export type ConnectionCallView = {
  id: string;
  kind: ConnectionCallDoc["kind"];
  tool?: string;
  decision?: ConnectionCallDoc["decision"];
  outcome: ConnectionCallDoc["outcome"];
  durationMs?: number;
  createdAt: number;
};

export function toConnectionCallView(id: string, doc: ConnectionCallDoc): ConnectionCallView {
  return {
    id,
    kind: doc.kind,
    ...(doc.tool === undefined ? {} : { tool: doc.tool }),
    ...(doc.decision === undefined ? {} : { decision: doc.decision }),
    outcome: doc.outcome,
    ...(doc.durationMs === undefined ? {} : { durationMs: doc.durationMs }),
    createdAt: doc.createdAt,
  };
}

export function callViewsNewestFirst(
  rows: readonly { id: string; doc: ConnectionCallDoc }[]
): ConnectionCallView[] {
  return rows
    .filter(({ doc }) => doc.deletedAt === undefined)
    .map(({ id, doc }) => ({ id, doc }))
    .sort(
      (left, right) => right.doc.createdAt - left.doc.createdAt || left.id.localeCompare(right.id)
    )
    .map(({ id, doc }) => toConnectionCallView(id, doc));
}
