export type ConnectionSecretDoc = {
  connectionId: string;
  accessTokenCipher?: string;
  refreshTokenCipher?: string;
  accessTokenExpiresAt?: number;
  keyVersion: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckConnectionSecretDocResult =
  | { ok: true; doc: ConnectionSecretDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof ConnectionSecretDoc>([
  "connectionId",
  "accessTokenCipher",
  "refreshTokenCipher",
  "accessTokenExpiresAt",
  "keyVersion",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function checkConnectionSecretDocValue(input: unknown): CheckConnectionSecretDocResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: "Connection secret must be a plain object" };
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof ConnectionSecretDoc)) {
      return { ok: false, reason: `Unexpected field: ${key}` };
    }
  }

  if (!isNonEmptyString(input.connectionId)) {
    return { ok: false, reason: "connectionId must be a non-empty string" };
  }
  for (const field of ["accessTokenCipher", "refreshTokenCipher"] as const) {
    if (input[field] !== undefined && !isNonEmptyString(input[field])) {
      return { ok: false, reason: `${field} must be a non-empty string when present` };
    }
  }
  if (!Number.isInteger(input.keyVersion) || (input.keyVersion as number) < 1) {
    return { ok: false, reason: "keyVersion must be an integer of at least 1" };
  }
  for (const field of ["accessTokenExpiresAt", "deletedAt"] as const) {
    if (input[field] !== undefined && !isNonNegativeFiniteNumber(input[field])) {
      return { ok: false, reason: `${field} must be a finite non-negative number when present` };
    }
  }
  const createdAt = input.createdAt;
  const updatedAt = input.updatedAt;
  if (!isNonNegativeFiniteNumber(createdAt) || !isNonNegativeFiniteNumber(updatedAt)) {
    return { ok: false, reason: "createdAt and updatedAt must be finite non-negative numbers" };
  }
  if (updatedAt < createdAt) {
    return { ok: false, reason: "updatedAt must not be earlier than createdAt" };
  }
  if (
    input.deletedAt !== undefined &&
    (input.accessTokenCipher !== undefined || input.refreshTokenCipher !== undefined)
  ) {
    return { ok: false, reason: "A deleted connection secret must not contain ciphertext" };
  }

  return { ok: true, doc: { ...input } as ConnectionSecretDoc };
}

export function checkConnectionSecretDoc(input: unknown): CheckConnectionSecretDocResult {
  try {
    return checkConnectionSecretDocValue(input);
  } catch {
    return { ok: false, reason: "Connection secret could not be read safely" };
  }
}

export function scrubConnectionSecretPatch(nowMs: number) {
  return {
    clear: ["accessTokenCipher", "refreshTokenCipher", "accessTokenExpiresAt"],
    set: { deletedAt: nowMs, updatedAt: nowMs },
  } as const;
}

export function isConnectionSecretUsable(doc: ConnectionSecretDoc): boolean {
  return (
    doc.deletedAt === undefined &&
    (doc.accessTokenCipher !== undefined || doc.refreshTokenCipher !== undefined)
  );
}
