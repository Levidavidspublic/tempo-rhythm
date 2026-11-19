export const OAUTH_PENDING_TTL_MS = 600_000;

export type OAuthPendingDoc = {
  provider: "executor";
  stateHash: string;
  codeVerifierCipher?: string;
  keyVersion: number;
  issuer: string;
  resource: string;
  redirectUri: string;
  clientRowId: string;
  returnTo: "settings" | "coach";
  expiresAt: number;
  usedAt?: number;
  startGeneration?: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckOAuthPendingDocResult =
  | { ok: true; doc: OAuthPendingDoc }
  | { ok: false; reason: string };

const allowedKeys = new Set<keyof OAuthPendingDoc>([
  "provider",
  "stateHash",
  "codeVerifierCipher",
  "keyVersion",
  "issuer",
  "resource",
  "redirectUri",
  "clientRowId",
  "returnTo",
  "expiresAt",
  "usedAt",
  "startGeneration",
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function checkOAuthPendingDocValue(input: unknown): CheckOAuthPendingDocResult {
  if (!isPlainObject(input)) {
    return { ok: false, reason: "OAuth pending attempt must be a plain object" };
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof OAuthPendingDoc)) {
      return { ok: false, reason: "OAuth pending attempt contains an unexpected field" };
    }
  }

  if (input.provider !== "executor") {
    return { ok: false, reason: "provider must be executor" };
  }
  if (typeof input.stateHash !== "string" || !/^[0-9a-f]{64}$/.test(input.stateHash)) {
    return { ok: false, reason: "stateHash must be 64 lowercase hexadecimal characters" };
  }
  if (input.codeVerifierCipher !== undefined && !isNonEmptyString(input.codeVerifierCipher)) {
    return { ok: false, reason: "codeVerifierCipher must be a non-empty string when present" };
  }
  if (!Number.isInteger(input.keyVersion) || (input.keyVersion as number) < 1) {
    return { ok: false, reason: "keyVersion must be an integer of at least 1" };
  }
  for (const field of ["issuer", "resource", "redirectUri"] as const) {
    if (!isHttpsUrl(input[field])) {
      return { ok: false, reason: `${field} must be a valid HTTPS URL` };
    }
  }
  if (!isNonEmptyString(input.clientRowId)) {
    return { ok: false, reason: "clientRowId must be a non-empty string" };
  }
  if (input.returnTo !== "settings" && input.returnTo !== "coach") {
    return { ok: false, reason: "returnTo must be settings or coach" };
  }
  for (const field of ["createdAt", "updatedAt", "expiresAt"] as const) {
    if (!isFiniteNumber(input[field])) {
      return { ok: false, reason: `${field} must be a finite number` };
    }
  }
  for (const field of ["usedAt", "deletedAt"] as const) {
    if (input[field] !== undefined && !isFiniteNumber(input[field])) {
      return { ok: false, reason: `${field} must be a finite number when present` };
    }
  }
  const startGeneration = input.startGeneration;
  if (
    startGeneration !== undefined &&
    (typeof startGeneration !== "number" ||
      !Number.isInteger(startGeneration) ||
      startGeneration < 0)
  ) {
    return { ok: false, reason: "startGeneration must be a non-negative integer when present" };
  }
  const createdAt = input.createdAt as number;
  const expiresAt = input.expiresAt as number;
  if (expiresAt <= createdAt) {
    return { ok: false, reason: "expiresAt must be later than createdAt" };
  }
  if (expiresAt > createdAt + OAUTH_PENDING_TTL_MS) {
    return { ok: false, reason: "expiresAt must be no more than 10 minutes after createdAt" };
  }
  if (
    input.codeVerifierCipher !== undefined &&
    (input.usedAt !== undefined || input.deletedAt !== undefined)
  ) {
    return { ok: false, reason: "Finished attempts must not retain a verifier cipher" };
  }

  return { ok: true, doc: { ...input } as OAuthPendingDoc };
}

export function checkOAuthPendingDoc(input: unknown): CheckOAuthPendingDocResult {
  try {
    return checkOAuthPendingDocValue(input);
  } catch {
    return { ok: false, reason: "OAuth pending attempt could not be read safely" };
  }
}

export function oauthPendingState(
  doc: OAuthPendingDoc,
  nowMs: number
): "open" | "used" | "expired" | "removed" {
  if (doc.deletedAt !== undefined) return "removed";
  if (doc.usedAt !== undefined) return "used";
  if (nowMs >= doc.expiresAt) return "expired";
  return "open";
}
