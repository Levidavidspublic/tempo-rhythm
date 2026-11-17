import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import {
  createFirebaseIdTokenVerifier,
  FIREBASE_ID_TOKEN_CERTIFICATES_URL,
  FirebaseAuthError,
  readFirebaseAuthConfig,
} from "./firebase-auth";

// All signing material is generated for this process and remains in RAM. No service keys or
// real Firebase accounts/tokens are used, and every certificate request below is a local fake.
const first = generateKeyPairSync("rsa", { modulusLength: 2048 });
const second = generateKeyPairSync("rsa", { modulusLength: 2048 });
const projectId = "tempo-test-project";
const NOW = 1_800_000_000;
const config = { projectId };
const publicPem = (key: KeyObject) => key.export({ type: "spki", format: "pem" }).toString();
const firstCertificates = { first: publicPem(first.publicKey) };

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signedToken(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  signingKey = first.privateKey
): string {
  const encodedHeader = encode({ alg: "RS256", kid: "first", typ: "JWT", ...header });
  const encodedClaims = encode({
    aud: projectId,
    iss: `https://securetoken.google.com/${projectId}`,
    sub: "user_a",
    iat: NOW - 10,
    exp: NOW + 3600,
    auth_time: NOW - 30,
    email: "person@example.test",
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    ...claims,
  });
  const input = `${encodedHeader}.${encodedClaims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), signingKey).toString("base64url")}`;
}

function certificateResponse(
  certificates: unknown = firstCertificates,
  cacheControl = "public, max-age=60",
  extraHeaders: Record<string, string> = {}
) {
  return Response.json(certificates, {
    headers: { "cache-control": cacheControl, ...extraHeaders },
  });
}

function harness(responses: Array<Response | Error> = [certificateResponse()]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const clock = { ms: NOW * 1000 };
  const verify = createFirebaseIdTokenVerifier(config, {
    now: () => clock.ms,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response ?? new Response(null, { status: 503 });
    },
  });
  return { verify, calls, clock };
}

describe("Firebase project authority", () => {
  test("uses server project and accepts a matching public project", () => {
    expect(readFirebaseAuthConfig({ GCP_PROJECT_ID: projectId })).toEqual(config);
    expect(
      readFirebaseAuthConfig({
        GCP_PROJECT_ID: ` ${projectId} `,
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId,
      })
    ).toEqual(config);
  });

  test("missing, malformed and mismatched server/public project configuration fail closed", () => {
    for (const env of [
      {},
      { NEXT_PUBLIC_FIREBASE_PROJECT_ID: projectId },
      { GCP_PROJECT_ID: "project/other" },
      { GCP_PROJECT_ID: projectId, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "another-project" },
    ]) {
      expect(readFirebaseAuthConfig(env)).toBeNull();
    }
    expect(() => createFirebaseIdTokenVerifier({ projectId: "" })).toThrow(FirebaseAuthError);
  });
});

describe("Firebase signed identity", () => {
  test("returns immutable project-scoped identity after verifying a Google-key signature", async () => {
    const { verify, calls } = harness();
    const identity = await verify(signedToken({ role: "admin", approved: true, uid: "forged_uid" }));
    expect(identity as unknown).toEqual({
      uid: "user_a",
      projectId,
      email: "person@example.test",
      emailVerified: true,
      issuedAt: NOW - 10,
      expiresAt: NOW + 3600,
      authTime: NOW - 30,
    });
    expect(Object.isFrozen(identity)).toBe(true);
    expect(identity).not.toHaveProperty("role");
    expect(identity).not.toHaveProperty("approved");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(FIREBASE_ID_TOKEN_CERTIFICATES_URL);
    expect(calls[0]?.init).toMatchObject({ method: "GET", redirect: "error" });
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.init.headers).toEqual({ accept: "application/json" });
  });

  test("never treats an unverified or absent email as verified", async () => {
    const { verify } = harness();
    const unverified = await verify(signedToken({ email_verified: false }));
    expect(unverified.emailVerified).toBe(false);
    const absent = await verify(signedToken({ email: undefined, email_verified: undefined }));
    expect(absent.email).toBeNull();
    expect(absent.emailVerified).toBe(false);
  });

  test("rejects a forged signature even when its decoded claims match", async () => {
    const { verify } = harness();
    await expect(verify(signedToken({}, {}, second.privateKey))).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  test("rejects a changed payload retaining the original signature", async () => {
    const { verify } = harness();
    const parts = signedToken().split(".");
    const payload = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString());
    payload.sub = "user_b";
    parts[1] = encode(payload);
    await expect(verify(parts.join("."))).rejects.toMatchObject({ code: "invalid_token" });
  });

  const badClaims: Array<[string, Record<string, unknown>, string]> = [
    ["wrong project audience", { aud: "another-project" }, "invalid_token"],
    ["audience array", { aud: [projectId] }, "invalid_token"],
    ["wrong issuer", { iss: "https://securetoken.google.com/another-project" }, "invalid_token"],
    ["session-cookie issuer", { iss: `https://session.firebase.google.com/${projectId}` }, "invalid_token"],
    ["missing subject", { sub: undefined }, "invalid_token"],
    ["empty subject", { sub: "" }, "invalid_token"],
    ["numeric subject", { sub: 1 }, "invalid_token"],
    ["oversized subject", { sub: "a".repeat(129) }, "invalid_token"],
    ["missing expiry", { exp: undefined }, "invalid_token"],
    ["string expiry", { exp: String(NOW + 3600) }, "invalid_token"],
    ["expired token", { exp: NOW - 1 }, "expired_token"],
    ["expiry boundary", { exp: NOW }, "expired_token"],
    ["future issue", { iat: NOW + 1 }, "invalid_token"],
    ["missing issue", { iat: undefined }, "invalid_token"],
    ["future authentication", { auth_time: NOW + 1 }, "invalid_token"],
    ["authentication after issue", { auth_time: NOW - 1 }, "invalid_token"],
    ["missing authentication time", { auth_time: undefined }, "invalid_token"],
    ["fractional authentication time", { auth_time: NOW - 30.5 }, "invalid_token"],
    ["future not-before", { nbf: NOW + 1 }, "invalid_token"],
    ["invalid email", { email: 42 }, "invalid_token"],
    ["email control character", { email: "person\n@example.test" }, "invalid_token"],
    ["string verified flag", { email_verified: "true" }, "invalid_token"],
    ["verified without email", { email: undefined }, "invalid_token"],
    ["tenant-scoped UID", { firebase: { tenant: "tenant_a" } }, "invalid_token"],
    ["malformed provider object", { firebase: [] }, "invalid_token"],
  ];
  for (const [name, claims, code] of badClaims) {
    test(`rejects ${name} before fetching keys`, async () => {
      const { verify, calls } = harness();
      await expect(verify(signedToken(claims))).rejects.toMatchObject({ code, status: 401 });
      expect(calls).toHaveLength(0);
    });
  }

  test("rejects malformed JWTs, unsupported algorithms and token-provided key locations", async () => {
    const { verify, calls } = harness();
    const invalid = [
      "",
      "a.b.c",
      "one.two",
      "a".repeat(16 * 1024 + 1),
      signedToken({}, { alg: "none" }),
      signedToken({}, { alg: "HS256" }),
      signedToken({}, { kid: undefined }),
      signedToken({}, { kid: "../other" }),
      signedToken({}, { typ: "OTHER" }),
      signedToken({}, { crit: [] }),
      signedToken({}, { b64: false }),
      signedToken({}, { jku: "https://attacker.example/keys" }),
      signedToken({}, { jwk: {} }),
      signedToken({}, { x5u: "https://attacker.example/cert" }),
      signedToken({}, { x5c: [] }),
    ];
    for (const token of invalid) {
      await expect(verify(token)).rejects.toMatchObject({ code: "invalid_token" });
    }
    expect(calls).toHaveLength(0);
  });

  test("rejects malformed JSON, noncanonical base64url and padded signatures", async () => {
    const { verify, calls } = harness();
    const parts = signedToken().split(".");
    await expect(verify(`${parts[0]}.bm90LWpzb24.${parts[2]}`)).rejects.toMatchObject({
      code: "invalid_token",
    });
    await expect(verify(`${parts[0]}.${parts[1]}.${parts[2]}=`)).rejects.toMatchObject({
      code: "invalid_token",
    });
    await expect(verify(`e31.${parts[1]}.${parts[2]}`)).rejects.toMatchObject({
      code: "invalid_token",
    });
    expect(calls).toHaveLength(0);
  });

  test("rejects a token expiring while certificates are fetched", async () => {
    let clock = NOW * 1000;
    const verify = createFirebaseIdTokenVerifier(config, {
      now: () => clock,
      fetch: async () => {
        clock += 2000;
        return certificateResponse();
      },
    });
    await expect(verify(signedToken({ exp: NOW + 1 }))).rejects.toMatchObject({
      code: "expired_token",
    });
  });
});

describe("Firebase certificate lifecycle", () => {
  test("caches certificates by max-age and refreshes after expiry for rotation", async () => {
    const { verify, calls, clock } = harness([
      certificateResponse(),
      certificateResponse({ rotated: publicPem(second.publicKey) }),
    ]);
    await verify(signedToken());
    await verify(signedToken());
    expect(calls).toHaveLength(1);
    await expect(verify(signedToken({}, { kid: "unknown" }))).rejects.toMatchObject({
      code: "invalid_token",
    });
    expect(calls).toHaveLength(1);
    clock.ms += 60_000;
    const identity = await verify(signedToken({}, { kid: "rotated" }, second.privateKey));
    expect(identity.uid).toBe("user_a");
    expect(calls).toHaveLength(2);
  });

  test("honors Age and no-store instead of extending an already stale key response", async () => {
    const { verify, calls, clock } = harness([
      certificateResponse(firstCertificates, "max-age=60", { age: "59" }),
      certificateResponse(firstCertificates, "no-store, max-age=60"),
      certificateResponse(),
    ]);
    await verify(signedToken());
    clock.ms += 1000;
    await verify(signedToken());
    await verify(signedToken());
    expect(calls).toHaveLength(3);
  });

  test("does not fall back to expired keys when refresh fails", async () => {
    const { verify, clock } = harness([
      certificateResponse(),
      new Response(null, { status: 503 }),
    ]);
    await verify(signedToken());
    clock.ms += 60_000;
    await expect(verify(signedToken())).rejects.toMatchObject({
      code: "verification_unavailable",
      status: 503,
    });
  });

  test("coalesces simultaneous certificate requests", async () => {
    let requests = 0;
    const verify = createFirebaseIdTokenVerifier(config, {
      now: () => NOW * 1000,
      fetch: async () => {
        requests++;
        await Promise.resolve();
        return certificateResponse();
      },
    });
    const results = await Promise.all([verify(signedToken()), verify(signedToken({ sub: "user_b" }))]);
    expect(results.map((identity) => identity.uid)).toEqual(["user_a", "user_b"]);
    expect(requests).toBe(1);
  });

  test("rejects malformed, non-RSA and undersized certificate responses", async () => {
    const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const weak = generateKeyPairSync("rsa", { modulusLength: 1024 });
    for (const response of [
      certificateResponse([]),
      certificateResponse({}),
      certificateResponse({ first: 123 }),
      certificateResponse({ first: "not a public certificate" }),
      certificateResponse({ first: publicPem(ec.publicKey) }),
      certificateResponse({ first: publicPem(weak.publicKey) }),
      new Response("upstream details", { status: 503 }),
      new Response("not json", { status: 200 }),
    ]) {
      const { verify } = harness([response]);
      await expect(verify(signedToken())).rejects.toMatchObject({
        code: "verification_unavailable",
        status: 503,
      });
    }
  });

  test("bounds both declared and streamed certificate response bytes", async () => {
    for (const response of [
      new Response("{}", { headers: { "content-length": String(64 * 1024 + 1) } }),
      new Response("a".repeat(64 * 1024 + 1)),
    ]) {
      const { verify } = harness([response]);
      await expect(verify(signedToken())).rejects.toMatchObject({
        code: "verification_unavailable",
      });
    }
  });

  test("does not expose tokens, claims or upstream exception text in errors", async () => {
    const { verify } = harness([new Error("upstream private content")]);
    try {
      await verify(signedToken());
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseAuthError);
      expect(String(error)).toBe(
        "FirebaseAuthError: Sign-in verification is temporarily unavailable."
      );
      expect(String(error)).not.toContain("upstream private content");
      expect(String(error)).not.toContain("person@example.test");
    }
  });
});
