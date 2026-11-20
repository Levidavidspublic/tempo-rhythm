// biome-ignore-all lint/style/useNamingConvention: The ticket defines the public OAuth API names.
export type OAuthClientDoc = {
  issuer: string;
  redirectUri: string;
  clientId: string;
  clientSecretCipher?: string;
  keyVersion: number;
  tokenEndpointAuthMethod: "none" | "client_secret_basic" | "client_secret_post";
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  revocationEndpoint?: string;
  codeChallengeS256: true;
  issParameterSupported?: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

type CheckOAuthClientDocResult = { ok: true; doc: OAuthClientDoc } | { ok: false; reason: string };

export type OAuthClientPublicView = Omit<OAuthClientDoc, "clientSecretCipher" | "keyVersion"> & {
  hasClientSecret: boolean;
};

const allowedKeys = new Set<keyof OAuthClientDoc>([
  "issuer",
  "redirectUri",
  "clientId",
  "clientSecretCipher",
  "keyVersion",
  "tokenEndpointAuthMethod",
  "authorizationEndpoint",
  "tokenEndpoint",
  "registrationEndpoint",
  "revocationEndpoint",
  "codeChallengeS256",
  "issParameterSupported",
  "createdAt",
  "updatedAt",
  "deletedAt",
]);

const urlFields = [
  "issuer",
  "redirectUri",
  "authorizationEndpoint",
  "tokenEndpoint",
  "registrationEndpoint",
  "revocationEndpoint",
] as const;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return new URL(value).protocol === "https:";
}

function checkOAuthClientDocValue(input: unknown): CheckOAuthClientDocResult {
  if (!isPlainObject(input)) return { ok: false, reason: "OAuth client must be a plain object" };

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof OAuthClientDoc)) {
      return { ok: false, reason: `Unexpected field: ${key}` };
    }
  }

  for (const field of urlFields) {
    if (
      input[field] === undefined &&
      (field === "registrationEndpoint" || field === "revocationEndpoint")
    ) {
      continue;
    }
    if (!isHttpsUrl(input[field])) {
      return { ok: false, reason: `${field} must be an HTTPS URL` };
    }
  }

  if (typeof input.clientId !== "string" || input.clientId.trim().length === 0) {
    return { ok: false, reason: "clientId must be a non-empty string" };
  }
  if (!Number.isInteger(input.keyVersion) || (input.keyVersion as number) < 1) {
    return { ok: false, reason: "keyVersion must be an integer of at least 1" };
  }
  if (
    input.tokenEndpointAuthMethod !== "none" &&
    input.tokenEndpointAuthMethod !== "client_secret_basic" &&
    input.tokenEndpointAuthMethod !== "client_secret_post"
  ) {
    return { ok: false, reason: "tokenEndpointAuthMethod is invalid" };
  }
  if (input.codeChallengeS256 !== true) {
    return { ok: false, reason: "codeChallengeS256 must be true" };
  }
  if (
    input.issParameterSupported !== undefined &&
    typeof input.issParameterSupported !== "boolean"
  ) {
    return { ok: false, reason: "issParameterSupported must be a boolean when present" };
  }
  if (
    input.clientSecretCipher !== undefined &&
    (typeof input.clientSecretCipher !== "string" || input.clientSecretCipher.length === 0)
  ) {
    return { ok: false, reason: "clientSecretCipher must be a non-empty string when present" };
  }
  if (input.tokenEndpointAuthMethod === "none" && input.clientSecretCipher !== undefined) {
    return { ok: false, reason: "Public OAuth clients must not store a secret cipher" };
  }
  if (
    input.tokenEndpointAuthMethod !== "none" &&
    input.deletedAt === undefined &&
    input.clientSecretCipher === undefined
  ) {
    return { ok: false, reason: "Active confidential OAuth clients require a secret cipher" };
  }
  for (const field of ["createdAt", "updatedAt"] as const) {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field])) {
      return { ok: false, reason: `${field} must be a finite number` };
    }
  }
  if (
    input.deletedAt !== undefined &&
    (typeof input.deletedAt !== "number" || !Number.isFinite(input.deletedAt))
  ) {
    return { ok: false, reason: "deletedAt must be a finite number when present" };
  }
  if ((input.updatedAt as number) < (input.createdAt as number)) {
    return { ok: false, reason: "updatedAt must not be earlier than createdAt" };
  }

  return { ok: true, doc: { ...input } as OAuthClientDoc };
}

export function checkOAuthClientDoc(input: unknown): CheckOAuthClientDocResult {
  try {
    return checkOAuthClientDocValue(input);
  } catch {
    return { ok: false, reason: "OAuth client could not be read safely" };
  }
}

export function oauthClientKey(issuer: string, redirectUri: string): string {
  return `${issuer.trim()}\n${redirectUri.trim()}`;
}

export function oauthClientPublicView(doc: OAuthClientDoc): OAuthClientPublicView {
  const { clientSecretCipher, keyVersion: _keyVersion, ...publicFields } = doc;
  return { ...publicFields, hasClientSecret: clientSecretCipher !== undefined };
}
