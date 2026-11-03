import { describe, expect, test } from "bun:test";
import {
  CONNECTIONS_KEY_VERSION,
  SecretCryptoError,
  decryptSecret,
  encryptSecret,
  fromBase64,
  loadConnectionsKey,
  parseConnectionsKey,
  randomBase64Url,
  secretAad,
  sha256Base64Url,
  sha256Hex,
  toBase64Url,
} from "./crypto";

/** A synthetic 32-byte test key (not a real secret): bytes 0..31. */
const KEY_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i);
const KEY_B64 = btoa(String.fromCharCode(...KEY_BYTES));
const OTHER_KEY_B64 = btoa(String.fromCharCode(...KEY_BYTES.map((b) => 255 - b)));
const PLAINTEXT = "fake-access-token-PLAINTEXT-123";

async function key(raw = KEY_B64): Promise<CryptoKey> {
  const k = await loadConnectionsKey({ TEMPO_CONNECTIONS_KEY: raw });
  if (!k) throw new Error("test key did not load");
  return k;
}

describe("the connections key", () => {
  test("a missing, blank, malformed or wrong-length key is no key", async () => {
    expect(parseConnectionsKey(undefined)).toBeNull();
    expect(parseConnectionsKey("   ")).toBeNull();
    expect(parseConnectionsKey("not base64 at all!")).toBeNull();
    expect(parseConnectionsKey(btoa("too short"))).toBeNull();
    expect(parseConnectionsKey(btoa(String.fromCharCode(...new Uint8Array(33))))).toBeNull();
    expect(await loadConnectionsKey({})).toBeNull();
    expect(await loadConnectionsKey({ TEMPO_CONNECTIONS_KEY: "short" })).toBeNull();
  });

  test("32 bytes as base64 or base64url, padded or not, load as a key", async () => {
    expect(parseConnectionsKey(KEY_B64)).toEqual(KEY_BYTES);
    const url = toBase64Url(KEY_BYTES);
    expect(parseConnectionsKey(url)).toEqual(KEY_BYTES);
    expect(parseConnectionsKey(`  ${KEY_B64}  `)).toEqual(KEY_BYTES);
    expect(await loadConnectionsKey({ TEMPO_CONNECTIONS_KEY: url })).not.toBeNull();
  });

  test("base64 helpers round-trip", () => {
    const bytes = Uint8Array.from([0, 1, 250, 251, 252, 253, 254, 255]);
    expect(fromBase64(toBase64Url(bytes))).toEqual(bytes);
    expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
    expect(fromBase64("a")).toBeNull();
  });
});

describe("AES-256-GCM secrets", () => {
  test("a value round-trips, and the ciphertext holds no plaintext", async () => {
    const k = await key();
    const aad = secretAad("users:a|executor", "accessToken");
    const cipher = await encryptSecret(k, PLAINTEXT, aad);
    expect(cipher.startsWith("v1.")).toBe(true);
    expect(cipher).not.toContain(PLAINTEXT);
    expect(cipher).not.toContain(btoa(PLAINTEXT).slice(0, 12));
    expect(await decryptSecret(k, cipher, aad)).toBe(PLAINTEXT);
    expect(CONNECTIONS_KEY_VERSION).toBe(1);
  });

  test("every encryption uses a fresh IV", async () => {
    const k = await key();
    const aad = secretAad("users:a|executor", "accessToken");
    const a = await encryptSecret(k, PLAINTEXT, aad);
    const b = await encryptSecret(k, PLAINTEXT, aad);
    expect(a).not.toBe(b);
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]);
  });

  test("another owner, another field, another key or a changed byte does not decrypt", async () => {
    const k = await key();
    const aad = secretAad("users:a|executor", "accessToken");
    const cipher = await encryptSecret(k, PLAINTEXT, aad);
    const [version, iv, sealed] = cipher.split(".") as [string, string, string];
    const flipped = `${sealed.slice(0, 4)}${sealed[4] === "A" ? "B" : "A"}${sealed.slice(5)}`;
    const other = await key(OTHER_KEY_B64);
    const attempts: Array<() => Promise<string>> = [
      () => decryptSecret(k, cipher, secretAad("users:b|executor", "accessToken")),
      () => decryptSecret(k, cipher, secretAad("users:a|executor", "refreshToken")),
      () => decryptSecret(other, cipher, aad),
      () => decryptSecret(k, `${version}.${iv}.${flipped}`, aad),
      () => decryptSecret(k, `v2.${iv}.${sealed}`, aad),
      () => decryptSecret(k, "garbage", aad),
    ];
    for (const attempt of attempts) {
      const error = await attempt().then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(SecretCryptoError);
      // Fixed text: never the plaintext or the ciphertext.
      expect((error as Error).message).toBe("secret could not be decrypted");
    }
  });
});

describe("digests and randomness", () => {
  test("sha256Hex and the S256 transform match node's crypto", async () => {
    const { createHash } = await import("node:crypto");
    expect(await sha256Hex("hello")).toBe(createHash("sha256").update("hello").digest("hex"));
    const verifier = "a-pkce-verifier-of-at-least-43-characters-xyz";
    expect(await sha256Base64Url(verifier)).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  test("random values are base64url of the asked length and differ", () => {
    const a = randomBase64Url(32);
    const b = randomBase64Url(32);
    expect(a).toHaveLength(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });
});
