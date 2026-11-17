// Server only: node:crypto deliberately prevents this verifier from being a browser auth helper.
import {
  constants,
  createPublicKey,
  type KeyObject,
  verify as verifySignature,
} from "node:crypto";
import type { VerifiedFirebaseIdentity } from "../auth-contract";

/**
 * Firebase's official verification contract and certificate URL:
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens
 * https://github.com/firebase/firebase-admin-node/blob/main/src/auth/token-verifier.ts
 * https://github.com/firebase/firebase-admin-node/blob/main/src/utils/jwt.ts
 * No emulator bypass, custom-token acceptance, or token-provided key URL is supported.
 */
export const FIREBASE_ID_TOKEN_CERTIFICATES_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

const MAX_TOKEN_BYTES = 16 * 1024;
const MAX_CERTIFICATE_BYTES = 64 * 1024;
const CERTIFICATE_TIMEOUT_MS = 5_000;
const MAX_CERTIFICATE_CACHE_MS = 6 * 60 * 60 * 1_000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const KEY_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type FirebaseAuthConfig = Readonly<{ projectId: string }>;
export type FirebaseAuthErrorCode =
  | "invalid_token"
  | "expired_token"
  | "verification_unavailable"
  | "not_configured";

/** Safe to translate to an API error; it never contains token, claim, or upstream response data. */
export class FirebaseAuthError extends Error {
  readonly status: 401 | 503;

  constructor(readonly code: FirebaseAuthErrorCode) {
    super(
      code === "not_configured" || code === "verification_unavailable"
        ? "Sign-in verification is temporarily unavailable."
        : "Please sign in again."
    );
    this.name = "FirebaseAuthError";
    this.status = code === "not_configured" || code === "verification_unavailable" ? 503 : 401;
  }
}

/** Use the server project as authority; a different public Firebase project fails closed. */
export function readFirebaseAuthConfig(
  env: Record<string, string | undefined> = process.env
): FirebaseAuthConfig | null {
  const projectId = env.GCP_PROJECT_ID?.trim();
  const publicProjectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId || !PROJECT_ID.test(projectId)) return null;
  if (publicProjectId && publicProjectId !== projectId) return null;
  return Object.freeze({ projectId });
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
type Dependencies = { fetch?: FetchLike; now?: () => number };
type Claims = Record<string, unknown>;
type CertificateCache = { keys: Map<string, KeyObject>; expiresAt: number };

function invalidToken(): never {
  throw new FirebaseAuthError("invalid_token");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodePart(part: string): unknown {
  if (!BASE64URL.test(part) || part.length % 4 === 1) return invalidToken();
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) return invalidToken();
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return invalidToken();
  }
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateClaims(claims: Claims, projectId: string, nowSeconds: number): void {
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) {
    invalidToken();
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 128) {
    invalidToken();
  }
  if (!timestamp(claims.exp) || !timestamp(claims.iat) || !timestamp(claims.auth_time)) {
    invalidToken();
  }
  if (claims.exp <= nowSeconds) throw new FirebaseAuthError("expired_token");
  if (
    claims.iat > nowSeconds ||
    claims.auth_time > nowSeconds ||
    claims.auth_time > claims.iat ||
    claims.exp <= claims.iat
  ) {
    invalidToken();
  }
  if (claims.nbf !== undefined && (!timestamp(claims.nbf) || claims.nbf > nowSeconds)) {
    invalidToken();
  }
  if (
    claims.email !== undefined &&
    (typeof claims.email !== "string" ||
      claims.email.length === 0 ||
      claims.email.length > 254 ||
      Array.from(claims.email).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }))
  ) {
    invalidToken();
  }
  if (claims.email_verified !== undefined && typeof claims.email_verified !== "boolean") {
    invalidToken();
  }
  if (claims.email_verified === true && typeof claims.email !== "string") invalidToken();
  // This app has no tenant-aware UID namespace. Reject tenant tokens instead of conflating UIDs.
  if (
    claims.firebase !== undefined &&
    (!isObject(claims.firebase) || claims.firebase.tenant !== undefined)
  ) {
    invalidToken();
  }
}

async function readCertificates(response: Response): Promise<Map<string, KeyObject>> {
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_CERTIFICATE_BYTES) {
    throw new FirebaseAuthError("verification_unavailable");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new FirebaseAuthError("verification_unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CERTIFICATE_BYTES) {
        await reader.cancel();
        throw new FirebaseAuthError("verification_unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!isObject(body)) throw new FirebaseAuthError("verification_unavailable");
  const entries = Object.entries(body);
  if (entries.length === 0 || entries.length > 100) {
    throw new FirebaseAuthError("verification_unavailable");
  }
  const keys = new Map<string, KeyObject>();
  for (const [id, certificate] of entries) {
    if (!KEY_ID.test(id) || typeof certificate !== "string") {
      throw new FirebaseAuthError("verification_unavailable");
    }
    const key = createPublicKey(certificate);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
      throw new FirebaseAuthError("verification_unavailable");
    }
    keys.set(id, key);
  }
  return keys;
}

function cacheLifetime(response: Response): number {
  const directives = response.headers.get("cache-control") ?? "";
  if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(directives)) return 0;
  const maxAge = /(?:^|,)\s*max-age=(\d+)\s*(?:,|$)/i.exec(directives);
  const age = Number(response.headers.get("age") ?? "0");
  if (!maxAge || !Number.isFinite(age) || age < 0) return 0;
  return Math.min(MAX_CERTIFICATE_CACHE_MS, Math.max(0, Number(maxAge[1]) - age) * 1000);
}

/**
 * Verifies Google signature and Firebase ID-token claims, not a Firebase session cookie.
 * It does not check account disablement or token revocation with Firebase Auth. Callers must
 * separately enforce current server-owned approval and authorization on every protected operation.
 * Each verifier owns its certificate cache; use one instance per server/project.
 */
export function createFirebaseIdTokenVerifier(
  config: FirebaseAuthConfig,
  dependencies: Dependencies = {}
): (token: string) => Promise<VerifiedFirebaseIdentity> {
  if (!config || typeof config.projectId !== "string" || !PROJECT_ID.test(config.projectId)) {
    throw new FirebaseAuthError("not_configured");
  }
  const projectId = config.projectId;
  const doFetch = dependencies.fetch ?? ((url, init) => fetch(url, init));
  const now = dependencies.now ?? Date.now;
  let cache: CertificateCache | null = null;
  let loading: Promise<CertificateCache> | null = null;

  async function certificates(): Promise<CertificateCache> {
    if (cache && cache.expiresAt > now()) return cache;
    if (loading) return loading;
    loading = (async () => {
      try {
        const response = await doFetch(FIREBASE_ID_TOKEN_CERTIFICATES_URL, {
          method: "GET",
          headers: { accept: "application/json" },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(CERTIFICATE_TIMEOUT_MS),
        });
        if (!response.ok) throw new FirebaseAuthError("verification_unavailable");
        const keys = await readCertificates(response);
        cache = { keys, expiresAt: now() + cacheLifetime(response) };
        return cache;
      } catch {
        // Upstream errors may include request/response content; expose none of it.
        throw new FirebaseAuthError("verification_unavailable");
      }
    })();
    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  return async (token: string): Promise<VerifiedFirebaseIdentity> => {
    if (typeof token !== "string" || token.length > MAX_TOKEN_BYTES) return invalidToken();
    const parts = token.split(".");
    if (parts.length !== 3) return invalidToken();
    const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];
    const header = decodePart(encodedHeader);
    const claims = decodePart(encodedClaims);
    if (
      !isObject(header) ||
      !isObject(claims) ||
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      !KEY_ID.test(header.kid) ||
      (header.typ !== undefined && header.typ !== "JWT") ||
      ["crit", "b64", "jku", "jwk", "x5u", "x5c"].some((name) => name in header)
    ) {
      return invalidToken();
    }
    if (!BASE64URL.test(encodedSignature) || encodedSignature.length % 4 === 1) {
      return invalidToken();
    }
    const signature = Buffer.from(encodedSignature, "base64url");
    if (signature.toString("base64url") !== encodedSignature) return invalidToken();
    const clock = now();
    if (!Number.isFinite(clock)) throw new FirebaseAuthError("verification_unavailable");
    validateClaims(claims, projectId, Math.floor(clock / 1000));
    const key = (await certificates()).keys.get(header.kid);
    if (!key) return invalidToken();
    let verified = false;
    try {
      verified = verifySignature(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedClaims}`, "utf8"),
        { key, padding: constants.RSA_PKCS1_PADDING },
        signature
      );
    } catch {
      return invalidToken();
    }
    if (!verified) return invalidToken();
    // Certificate retrieval may take time; an ID token expiring during the request is not valid.
    validateClaims(claims, projectId, Math.floor(now() / 1000));
    return Object.freeze({
      uid: claims.sub as string,
      projectId,
      email: typeof claims.email === "string" ? claims.email : null,
      emailVerified: claims.email_verified === true,
      issuedAt: claims.iat as number,
      expiresAt: claims.exp as number,
      authTime: claims.auth_time as number,
    }) as VerifiedFirebaseIdentity;
  };
}
