export type McpTokenDoc = {
  name: string;
  tokenHash: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number;
  windowStartMs?: number;
  windowCount?: number;
};

const MCP_TOKEN_KEYS = new Set<keyof McpTokenDoc>([
  "name",
  "tokenHash",
  "prefix",
  "createdAt",
  "lastUsedAt",
  "revokedAt",
  "windowStartMs",
  "windowCount",
]);

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function validateMcpTokenDoc(
  input: unknown
): { ok: true; doc: McpTokenDoc } | { ok: false; reason: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, reason: "MCP token must be an object" };
  }

  const value = input as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(
    (key) => !MCP_TOKEN_KEYS.has(key as keyof McpTokenDoc)
  );
  if (unknownKey) return { ok: false, reason: `unknown key: ${unknownKey}` };

  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    return { ok: false, reason: "name must be a non-empty string" };
  }
  if (value.name.length > 80) {
    return { ok: false, reason: "name must be at most 80 characters" };
  }
  if (typeof value.tokenHash !== "string" || !/^[0-9a-f]{64}$/.test(value.tokenHash)) {
    return { ok: false, reason: "tokenHash must be 64 lower-case hexadecimal characters" };
  }
  if (typeof value.prefix !== "string" || value.prefix.length === 0 || value.prefix.length > 16) {
    return { ok: false, reason: "prefix must be between 1 and 16 characters" };
  }

  for (const key of ["createdAt", "lastUsedAt", "revokedAt", "windowStartMs"] as const) {
    if ((key === "createdAt" || value[key] !== undefined) && !isSafeNonNegativeInteger(value[key])) {
      return { ok: false, reason: `${key} must be a safe non-negative integer` };
    }
  }
  if (value.windowCount !== undefined && !isSafeNonNegativeInteger(value.windowCount)) {
    return { ok: false, reason: "windowCount must be a safe non-negative integer" };
  }

  return { ok: true, doc: value as McpTokenDoc };
}

export type McpTokenView = {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  revoked: boolean;
};

export function toMcpTokenView(id: string, doc: McpTokenDoc): McpTokenView {
  return {
    id,
    name: doc.name,
    prefix: doc.prefix,
    createdAt: doc.createdAt,
    ...(doc.lastUsedAt === undefined ? {} : { lastUsedAt: doc.lastUsedAt }),
    revoked: doc.revokedAt !== undefined,
  };
}

export function isMcpTokenUsable(doc: McpTokenDoc): boolean {
  return doc.revokedAt === undefined;
}
