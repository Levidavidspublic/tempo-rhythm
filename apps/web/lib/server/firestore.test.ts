import { beforeEach, describe, expect, test } from "bun:test";
import { createDocument, FirestoreError } from "./firestore";
import {
  clearGcpTokenCache,
  fetchWithTimeout,
  GcpAuthError,
  getGcpAccessToken,
  missingGcpEnv,
  OUTBOUND_TIMEOUT_MS,
  readGcpConfig,
} from "./gcp-access-token";

const env = {
  GCP_PROJECT_ID: "demo-project",
  GCP_PROJECT_NUMBER: "123456",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "pool",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "provider",
  GCP_SERVICE_ACCOUNT_EMAIL: "writer@demo-project.iam.gserviceaccount.com",
};
const config = readGcpConfig(env);
if (!config) {
  throw new Error("test config");
}

type Call = { url: string; init?: RequestInit };
function recorder(responses: Response[]) {
  const calls: Call[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return responses.shift() ?? new Response("{}", { status: 500 });
  };
  return { calls, fetch };
}

describe("keyless Google access", () => {
  beforeEach(() => clearGcpTokenCache());

  test("names what is missing, never a value", () => {
    expect(missingGcpEnv({ GCP_PROJECT_ID: "x" })).toEqual([
      "GCP_PROJECT_NUMBER",
      "GCP_WORKLOAD_IDENTITY_POOL_ID",
      "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
      "GCP_SERVICE_ACCOUNT_EMAIL",
    ]);
    expect(readGcpConfig({ GCP_PROJECT_ID: "x" })).toBeNull();
  });

  test("exchanges the OIDC token, then asks for a service-account token, and caches it", async () => {
    const { calls, fetch } = recorder([
      Response.json({ access_token: "federated" }),
      Response.json({ accessToken: "sa-token", expireTime: new Date(10 * 60_000).toISOString() }),
    ]);
    const audiences: Array<string | null> = [];
    const deps = {
      fetch,
      now: () => 0,
      getOidcToken: async (audience: string | null) => {
        audiences.push(audience);
        return "oidc";
      },
    };

    expect(await getGcpAccessToken(config, "scope-a", deps)).toBe("sa-token");
    expect(await getGcpAccessToken(config, "scope-a", deps)).toBe("sa-token");

    const provider =
      "projects/123456/locations/global/workloadIdentityPools/pool/providers/provider";
    // No GCP_AUDIENCE: Vercel's default token is used as it is.
    expect(audiences).toEqual([null]);
    expect(readGcpConfig({ ...env, GCP_AUDIENCE: " https://aud.example " })?.audience).toBe(
      "https://aud.example"
    );
    expect(calls.map((call) => call.url)).toEqual([
      "https://sts.googleapis.com/v1/token",
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/writer%40demo-project.iam.gserviceaccount.com:generateAccessToken",
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      audience: `//iam.googleapis.com/${provider}`,
      subjectToken: "oidc",
    });
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ scope: ["scope-a"] });
  });

  test("says which step stopped", async () => {
    const stsDenied = recorder([new Response("{}", { status: 403 })]);
    await expect(
      getGcpAccessToken(config, "s", { fetch: stsDenied.fetch, getOidcToken: async () => "oidc" })
    ).rejects.toMatchObject({ step: "sts", status: 403 });

    clearGcpTokenCache();
    const noToken = recorder([]);
    const failing = getGcpAccessToken(config, "s", {
      fetch: noToken.fetch,
      getOidcToken: async () => {
        throw new Error("none");
      },
    });
    await expect(failing).rejects.toBeInstanceOf(GcpAuthError);
    expect(noToken.calls).toHaveLength(0);
  });
  test("keeps Google's reason and what the token claims, never the token itself", async () => {
    const claims = btoa(
      JSON.stringify({ iss: "https://issuer.example", aud: "https://aud.example", sub: "owner:x" })
    ).replace(/=+$/, "");
    const token = `header.${claims}.signature-part`;
    const denied = recorder([
      Response.json(
        { error: "invalid_target", error_description: "audience does not match" },
        { status: 400 }
      ),
    ]);
    const error = await getGcpAccessToken(config, "s", {
      fetch: denied.fetch,
      getOidcToken: async () => token,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GcpAuthError);
    const detail = (error as GcpAuthError).detail;
    expect(detail).toContain("invalid_target: audience does not match");
    expect(detail).toContain("aud=https://aud.example");
    expect(detail).toContain("sub=owner:x");
    expect(detail).not.toContain("signature-part");
    expect(detail).not.toContain(token);
  });
});

describe("outbound requests", () => {
  test("carry a time limit unless the caller set its own signal", async () => {
    const seen: Array<AbortSignal | null | undefined> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      seen.push(init?.signal);
      return new Response("{}");
    }) as typeof fetch;
    try {
      await fetchWithTimeout("https://example.com/a", { method: "POST" });
      const own = new AbortController().signal;
      await fetchWithTimeout("https://example.com/b", { signal: own });
      expect(seen[0]).toBeInstanceOf(AbortSignal);
      expect(seen[1]).toBe(own);
      expect(OUTBOUND_TIMEOUT_MS).toBe(8000);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("firestore writes", () => {
  const getAccessToken = async () => "sa-token";

  test("creates a document and treats an existing one as fine", async () => {
    const { calls, fetch } = recorder([
      Response.json({}),
      Response.json(
        { error: { status: "ALREADY_EXISTS", message: "Document already exists" } },
        { status: 409 }
      ),
    ]);
    const fields = { email: { stringValue: "dana@example.com" } };
    expect(await createDocument(config, "waitlist", "abc", fields, { fetch, getAccessToken })).toBe(
      "created"
    );
    expect(await createDocument(config, "waitlist", "abc", fields, { fetch, getAccessToken })).toBe(
      "exists"
    );
    expect(calls[0]?.url).toBe(
      "https://firestore.googleapis.com/v1/projects/demo-project/databases/(default)/documents/waitlist?documentId=abc"
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer sa-token");
  });

  test("a 409 that is not ALREADY_EXISTS is a write that did not happen", async () => {
    const { fetch } = recorder([
      Response.json(
        { error: { status: "ABORTED", message: "Too much contention on these documents." } },
        { status: 409 }
      ),
      new Response("{}", { status: 409 }),
    ]);
    for (const expected of ["ABORTED: Too much contention on these documents.", ""]) {
      const error = await createDocument(
        config,
        "waitlist",
        "abc",
        {},
        { fetch, getAccessToken }
      ).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(FirestoreError);
      expect((error as FirestoreError).status).toBe(409);
      expect((error as FirestoreError).detail).toBe(expected);
    }
  });

  test("reports a refusal with its status and Google's reason", async () => {
    const { fetch } = recorder([
      Response.json(
        { error: { status: "PERMISSION_DENIED", message: "Missing or insufficient permissions." } },
        { status: 403 }
      ),
    ]);
    const error = await createDocument(
      config,
      "waitlist",
      "abc",
      {},
      { fetch, getAccessToken }
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FirestoreError);
    expect((error as FirestoreError).status).toBe(403);
    expect((error as FirestoreError).detail).toBe(
      "PERMISSION_DENIED: Missing or insufficient permissions."
    );
  });
});
