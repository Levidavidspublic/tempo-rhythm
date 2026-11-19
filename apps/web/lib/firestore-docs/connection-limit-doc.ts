export type ConnectionLimitDoc = {
  connectWindowStartMs?: number;
  connectWindowCount?: number;
  callWindowStartMs?: number;
  callWindowCount?: number;
  disconnectGeneration?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckConnectionLimitDocResult =
  | { ok: true; doc: ConnectionLimitDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof ConnectionLimitDoc>([
  "connectWindowStartMs",
  "connectWindowCount",
  "callWindowStartMs",
  "callWindowCount",
  "disconnectGeneration",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function checkConnectionLimitDocValue(input: unknown): CheckConnectionLimitDocResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: "Connection limit must be a plain object" };
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof ConnectionLimitDoc)) {
      return { ok: false, reason: `Unexpected field: ${key}` };
    }
  }

  for (const field of ["connectWindowCount", "callWindowCount", "disconnectGeneration"] as const) {
    const value = input[field];
    if (value !== undefined && (typeof value !== "number" || !Number.isInteger(value) || value < 0)) {
      return { ok: false, reason: `${field} must be a non-negative integer when present` };
    }
  }

  for (const field of [
    "connectWindowStartMs",
    "callWindowStartMs",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ] as const) {
    const value = input[field];
    if (value === undefined || typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      if (field === "deletedAt" && value === undefined) continue;
      if ((field === "connectWindowStartMs" || field === "callWindowStartMs") && value === undefined) {
        continue;
      }
      return { ok: false, reason: `${field} must be a finite non-negative number` };
    }
  }

  if ((input.connectWindowStartMs === undefined) !== (input.connectWindowCount === undefined)) {
    return { ok: false, reason: "Connect window start and count must appear together" };
  }
  if ((input.callWindowStartMs === undefined) !== (input.callWindowCount === undefined)) {
    return { ok: false, reason: "Call window start and count must appear together" };
  }
  if ((input.updatedAt as number) < (input.createdAt as number)) {
    return { ok: false, reason: "updatedAt must not be before createdAt" };
  }

  return { ok: true, doc: { ...input } as ConnectionLimitDoc };
}

export function checkConnectionLimitDoc(input: unknown): CheckConnectionLimitDocResult {
  try {
    return checkConnectionLimitDocValue(input);
  } catch {
    return { ok: false, reason: "Connection limit could not be read safely" };
  }
}

export function disconnectGenerationOf(doc: ConnectionLimitDoc | null | undefined): number {
  return doc?.disconnectGeneration ?? 0;
}

export function nextDisconnectGeneration(doc: ConnectionLimitDoc | null | undefined): number {
  return disconnectGenerationOf(doc) + 1;
}

export function checkConnectionLimitUpdate(
  previous: ConnectionLimitDoc,
  next: unknown,
): CheckConnectionLimitDocResult {
  const result = checkConnectionLimitDoc(next);
  if (!result.ok) return result;
  if (result.doc.createdAt !== previous.createdAt) {
    return { ok: false, reason: "createdAt cannot change" };
  }
  if (disconnectGenerationOf(result.doc) < disconnectGenerationOf(previous)) {
    return { ok: false, reason: "disconnectGeneration cannot decrease" };
  }
  return result;
}
