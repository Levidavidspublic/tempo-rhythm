/**
 * Secrets at rest for connected accounts (TEMPO-B07-07, #989; research doc §3.2).
 *
 * - AES-256-GCM through Web Crypto (`crypto.subtle`), a fresh 12-byte IV per value. No library
 *   (HARD_RULES §2). UNKNOWN (doc §7.1 item 21): whether `crypto.subtle.encrypt` with AES-GCM runs
 *   in Convex's default runtime. Tempo already uses `crypto.subtle.digest` there; if encrypt is
 *   missing, every call fails closed (no plaintext is ever stored) and the fallback is a
 *   `"use node"` action with `node:crypto`.
 * - The key is the Convex env var `TEMPO_CONNECTIONS_KEY` (EXTRAPOLATED name): 32 random bytes,
 *   base64 or base64url. A missing or malformed key means the feature is unavailable.
 * - Every ciphertext carries its format version (`v1.`) and every row stores `keyVersion`, so a
 *   later ticket can rotate the key. `TEMPO_CONNECTIONS_KEY_PREVIOUS` (doc §3.2) is not read yet.
 * - Additional authenticated data binds a ciphertext to its owner and field (`secretAad`), so a
 *   value copied into another person's row or another field does not decrypt.
 * - Errors carry fixed text only: never the key, the plaintext or the ciphertext.
 */

/** The `keyVersion` written with every ciphertext today. */
export const CONNECTIONS_KEY_VERSION = 1;

const CIPHER_PREFIX = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

/** A value could not be encrypted or decrypted. The message is fixed text. */
export class SecretCryptoError extends Error {
  constructor(operation: "encrypt" | "decrypt") {
    super(`secret could not be ${operation === "encrypt" ? "encrypted" : "decrypted"}`);
    this.name = "SecretCryptoError";
  }
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

/** Bytes as unpadded base64url. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64 or base64url (padded or not) to bytes; null when it is not valid base64. */
export function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  const clean = text.trim().replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean) || clean.length % 4 === 1) return null;
  let binary: string;
  try {
    binary = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  } catch {
    return null;
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** The raw key bytes when `raw` is base64 of exactly 32 bytes, else null. Never logs. */
export function parseConnectionsKey(raw: string | undefined): Uint8Array<ArrayBuffer> | null {
  if (!raw?.trim()) return null;
  const bytes = fromBase64(raw);
  return bytes && bytes.length === KEY_BYTES ? bytes : null;
}

/**
 * The AES-GCM key from `TEMPO_CONNECTIONS_KEY`, imported as non-extractable, or null when the
 * variable is missing or malformed. Actions only.
 */
export async function loadConnectionsKey(
  env: Record<string, string | undefined> = process.env,
): Promise<CryptoKey | null> {
  const bytes = parseConnectionsKey(env.TEMPO_CONNECTIONS_KEY);
  if (!bytes) return null;
  try {
    return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch {
    return null;
  }
}

/** What a ciphertext is bound to: `tempo-connections|<owner>|<field>`. */
export function secretAad(owner: string, field: string): string {
  return `tempo-connections|${owner}|${field}`;
}

/** `v1.<iv>.<ciphertext+tag>`, both base64url. */
export async function encryptSecret(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const sealed = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: utf8(aad) },
      key,
      utf8(plaintext),
    );
    return `${CIPHER_PREFIX}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(sealed))}`;
  } catch {
    throw new SecretCryptoError("encrypt");
  }
}

/** The plaintext of an `encryptSecret` value with the same key and `aad`. Throws a fixed error otherwise. */
export async function decryptSecret(key: CryptoKey, cipher: string, aad: string): Promise<string> {
  const parts = cipher.split(".");
  const iv = parts.length === 3 && parts[0] === CIPHER_PREFIX ? fromBase64(parts[1] ?? "") : null;
  const sealed = iv ? fromBase64(parts[2] ?? "") : null;
  if (!iv || iv.length !== IV_BYTES || !sealed || sealed.length < 16) {
    throw new SecretCryptoError("decrypt");
  }
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: utf8(aad) },
      key,
      sealed,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new SecretCryptoError("decrypt");
  }
}

/** Lowercase SHA-256 hex of the UTF-8 text. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", utf8(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of the UTF-8 text as unpadded base64url (the PKCE S256 transform). */
export async function sha256Base64Url(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(text))));
}

/** `bytes` random bytes as unpadded base64url. */
export function randomBase64Url(bytes: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
