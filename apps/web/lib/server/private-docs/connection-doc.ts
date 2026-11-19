export type ConnectionDoc = {
  provider: "executor";
  status:
    | "pending_confirm"
    | "connected"
    | "needs_reauth"
    | "unavailable"
    | "revoking"
    | "disconnected";
  mcpUrl: string;
  issuer: string;
  clientRowId: string;
  scope?: string;
  accountLabel?: string;
  connectedAt: number;
  lastUsedAt?: number;
  lastErrorAt?: number;
  confirmNonceHash?: string;
  confirmExpiresAt?: number;
  startGeneration?: number;
  refreshLeaseUntil?: number;
  refreshLeaseToken?: string;
  revokedAtProvider?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

const CONNECTION_KEYS = new Set<keyof ConnectionDoc>([
  "provider",
  "status",
  "mcpUrl",
  "issuer",
  "clientRowId",
  "scope",
  "accountLabel",
  "connectedAt",
  "lastUsedAt",
  "lastErrorAt",
  "confirmNonceHash",
  "confirmExpiresAt",
  "startGeneration",
  "refreshLeaseUntil",
  "refreshLeaseToken",
  "revokedAtProvider",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const STATUSES = new Set<ConnectionDoc["status"]>([
  "pending_confirm",
  "connected",
  "needs_reauth",
  "unavailable",
  "revoking",
  "disconnected",
]);

const OPTIONAL_STRINGS = ["scope", "accountLabel", "confirmNonceHash", "refreshLeaseToken"] as const;
const REQUIRED_TIMES = ["connectedAt", "createdAt", "updatedAt"] as const;
const OPTIONAL_NUMBERS = [
  "lastUsedAt",
  "lastErrorAt",
  "confirmExpiresAt",
  "startGeneration",
  "refreshLeaseUntil",
  "deletedAt",
] as const;

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateConnectionDoc(
  input: unknown,
): { ok: true; doc: ConnectionDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "connection must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find((key) => !CONNECTION_KEYS.has(key as keyof ConnectionDoc));
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };
  if (value.provider !== "executor") return { ok: false, reason: "invalid provider" };
  if (!STATUSES.has(value.status as ConnectionDoc["status"])) {
    return { ok: false, reason: "invalid status" };
  }
  if (!isHttpsUrl(value.mcpUrl)) return { ok: false, reason: "mcpUrl must be an https URL" };
  if (!isHttpsUrl(value.issuer)) return { ok: false, reason: "issuer must be an https URL" };
  if (typeof value.clientRowId !== "string" || value.clientRowId.length === 0) {
    return { ok: false, reason: "clientRowId must be a non-empty string" };
  }
  for (const key of OPTIONAL_STRINGS) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      return { ok: false, reason: `${key} must be a string` };
    }
  }
  for (const key of REQUIRED_TIMES) {
    if (!isNonNegativeSafeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe non-negative integer` };
    }
  }
  for (const key of OPTIONAL_NUMBERS) {
    if (value[key] !== undefined && !isNonNegativeSafeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe non-negative integer` };
    }
  }
  if (value.revokedAtProvider !== undefined && typeof value.revokedAtProvider !== "boolean") {
    return { ok: false, reason: "revokedAtProvider must be a boolean" };
  }

  return { ok: true, doc: value as ConnectionDoc };
}

export function canUseForCall(doc: ConnectionDoc): boolean {
  return doc.deletedAt === undefined && (doc.status === "connected" || doc.status === "unavailable");
}

export function canConfirm(doc: ConnectionDoc, now: number): boolean {
  return (
    doc.status === "pending_confirm" &&
    doc.deletedAt === undefined &&
    doc.confirmNonceHash !== undefined &&
    doc.confirmExpiresAt !== undefined &&
    doc.confirmExpiresAt > now
  );
}

export type ConnectionView = {
  id: string;
  provider: "executor";
  status: ConnectionDoc["status"];
  accountLabel?: string;
  connectedAt: number;
  lastUsedAt?: number;
  lastErrorAt?: number;
};

export function toConnectionView(id: string, doc: ConnectionDoc): ConnectionView {
  return {
    id,
    provider: doc.provider,
    status: doc.status,
    ...(doc.accountLabel === undefined ? {} : { accountLabel: doc.accountLabel }),
    connectedAt: doc.connectedAt,
    ...(doc.lastUsedAt === undefined ? {} : { lastUsedAt: doc.lastUsedAt }),
    ...(doc.lastErrorAt === undefined ? {} : { lastErrorAt: doc.lastErrorAt }),
  };
}
