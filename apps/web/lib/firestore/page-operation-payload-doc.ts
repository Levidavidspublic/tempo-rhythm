export type PageOperationPayloadDoc = {
  noteId: string;
  operationId: string;
  undoUntilMs: number;
  cleanupDueAtMs: number;
  payload:
    | {
        state: "available";
        splices: Array<{
          startUtf16: number;
          removedText: string;
          insertedText: string;
        }>;
      }
    | { state: "expired"; expiredAtMs: number };
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export type PageOperationPayloadDocCheck =
  | { ok: true; doc: PageOperationPayloadDoc }
  | { ok: false; reason: string };

const documentFields = new Set([
  "noteId",
  "operationId",
  "undoUntilMs",
  "cleanupDueAtMs",
  "payload",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);
const availablePayloadFields = new Set(["state", "splices"]);
const expiredPayloadFields = new Set(["state", "expiredAtMs"]);
const spliceFields = new Set(["startUtf16", "removedText", "insertedText"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyFields(value: Record<string, unknown>, fields: ReadonlySet<string>): boolean {
  return Object.keys(value).every((field) => fields.has(field));
}

function isTime(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function refusal(reason: string): PageOperationPayloadDocCheck {
  return { ok: false, reason };
}

export function checkPageOperationPayloadDoc(input: unknown): PageOperationPayloadDocCheck {
  if (!isRecord(input)) return refusal("Document must be an object");
  if (Object.hasOwn(input, "userId")) return refusal("userId is not a document field");
  if (!hasOnlyFields(input, documentFields)) return refusal("Document has unknown fields");
  if (typeof input.noteId !== "string" || input.noteId.length === 0) {
    return refusal("noteId must be a non-empty string");
  }
  if (typeof input.operationId !== "string" || input.operationId.length === 0) {
    return refusal("operationId must be a non-empty string");
  }

  for (const field of ["undoUntilMs", "cleanupDueAtMs", "createdAt", "updatedAt"] as const) {
    if (!isTime(input[field])) return refusal(`${field} must be a safe nonnegative integer`);
  }
  if (Object.hasOwn(input, "deletedAt") && !isTime(input.deletedAt)) {
    return refusal("deletedAt must be a safe nonnegative integer");
  }
  const cleanupDueAtMs = input.cleanupDueAtMs as number;
  const undoUntilMs = input.undoUntilMs as number;
  if (cleanupDueAtMs < undoUntilMs) {
    return refusal("cleanupDueAtMs must not be earlier than undoUntilMs");
  }

  if (!isRecord(input.payload) || typeof input.payload.state !== "string") {
    return refusal("payload must have a valid state");
  }
  if (input.payload.state === "available") {
    if (!hasOnlyFields(input.payload, availablePayloadFields)) {
      return refusal("Available payload has unknown fields");
    }
    if (!Array.isArray(input.payload.splices)) return refusal("splices must be an array");
    for (const splice of input.payload.splices) {
      if (!isRecord(splice) || !hasOnlyFields(splice, spliceFields)) {
        return refusal("Splice must contain only supported fields");
      }
      if (!isTime(splice.startUtf16))
        return refusal("startUtf16 must be a safe nonnegative integer");
      if (typeof splice.removedText !== "string" || typeof splice.insertedText !== "string") {
        return refusal("Splice text must be a string");
      }
    }
  } else if (input.payload.state === "expired") {
    if (!hasOnlyFields(input.payload, expiredPayloadFields)) {
      return refusal("Expired payload has unknown fields");
    }
    if (!isTime(input.payload.expiredAtMs)) {
      return refusal("expiredAtMs must be a safe nonnegative integer");
    }
  } else {
    return refusal("payload.state is unknown");
  }

  return { ok: true, doc: input as PageOperationPayloadDoc };
}

export function softDeletePageOperationPayloadDoc(
  doc: PageOperationPayloadDoc,
  nowMs: number
): PageOperationPayloadDoc {
  if (!isTime(nowMs)) throw new RangeError("nowMs must be a safe nonnegative integer");
  return { ...doc, deletedAt: nowMs, updatedAt: nowMs };
}
