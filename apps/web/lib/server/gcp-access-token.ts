import { getVercelOidcToken } from "@vercel/oidc";

/**
 * Keyless Google Cloud access for Vercel functions (Workload Identity Federation).
 * No service-account key exists. Flow: Vercel OIDC token -> Google STS -> short-lived token for
 * the service account. Names match Vercel's GCP OIDC guide (https://vercel.com/docs/oidc/gcp).
 * Server only: never import this from a client component.
 */
export type GcpConfig = {
  projectId: string;
  projectNumber: string;
  poolId: string;
  providerId: string;
  serviceAccountEmail: string;
};

export const GCP_ENV_NAMES = [
  "GCP_PROJECT_ID",
  "GCP_PROJECT_NUMBER",
  "GCP_WORKLOAD_IDENTITY_POOL_ID",
  "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
  "GCP_SERVICE_ACCOUNT_EMAIL",
] as const;

type Env = Record<string, string | undefined>;

/** The part of fetch this code uses; lets tests pass a plain function. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** The names from GCP_ENV_NAMES that are not set. Names only, never values. */
export function missingGcpEnv(env: Env = process.env): string[] {
  return GCP_ENV_NAMES.filter((name) => !env[name]?.trim());
}

export function readGcpConfig(env: Env = process.env): GcpConfig | null {
  if (missingGcpEnv(env).length > 0) {
    return null;
  }
  return {
    projectId: (env.GCP_PROJECT_ID as string).trim(),
    projectNumber: (env.GCP_PROJECT_NUMBER as string).trim(),
    poolId: (env.GCP_WORKLOAD_IDENTITY_POOL_ID as string).trim(),
    providerId: (env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID as string).trim(),
    serviceAccountEmail: (env.GCP_SERVICE_ACCOUNT_EMAIL as string).trim(),
  };
}

function providerPath(config: GcpConfig): string {
  return `projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
}

export class GcpAuthError extends Error {
  constructor(
    readonly step: "oidc" | "sts" | "impersonate",
    readonly status: number
  ) {
    super(`Google Cloud keyless auth stopped at "${step}" (status ${status})`);
    this.name = "GcpAuthError";
  }
}

type Deps = {
  fetch: FetchLike;
  getOidcToken: (audience: string) => Promise<string>;
  now: () => number;
};

const defaultDeps: Deps = {
  fetch: (input, init) => fetch(input, init),
  getOidcToken: (audience) => getVercelOidcToken({ audience }),
  now: () => Date.now(),
};

const EXPIRY_MARGIN_MS = 60_000;
let cached: { key: string; token: string; expiresAt: number } | null = null;

/** For tests. */
export function clearGcpTokenCache(): void {
  cached = null;
}

/** A short-lived access token for the service account, limited to `scope`. */
export async function getGcpAccessToken(
  config: GcpConfig,
  scope: string,
  deps: Partial<Deps> = {}
): Promise<string> {
  const { fetch: doFetch, getOidcToken, now } = { ...defaultDeps, ...deps };
  const key = `${config.serviceAccountEmail}|${scope}`;
  if (cached && cached.key === key && cached.expiresAt - EXPIRY_MARGIN_MS > now()) {
    return cached.token;
  }

  let subjectToken: string;
  try {
    // The pool provider checks the token's audience against its own default audience.
    subjectToken = await getOidcToken(`https://iam.googleapis.com/${providerPath(config)}`);
  } catch {
    throw new GcpAuthError("oidc", 0);
  }
  if (!subjectToken) {
    throw new GcpAuthError("oidc", 0);
  }

  const sts = await doFetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: `//iam.googleapis.com/${providerPath(config)}`,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      subjectToken,
    }),
  });
  if (!sts.ok) {
    throw new GcpAuthError("sts", sts.status);
  }
  const federated = ((await sts.json()) as { access_token?: string }).access_token;
  if (!federated) {
    throw new GcpAuthError("sts", sts.status);
  }

  const impersonated = await doFetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.serviceAccountEmail)}:generateAccessToken`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${federated}`, "content-type": "application/json" },
      body: JSON.stringify({ scope: [scope] }),
    }
  );
  if (!impersonated.ok) {
    throw new GcpAuthError("impersonate", impersonated.status);
  }
  const body = (await impersonated.json()) as { accessToken?: string; expireTime?: string };
  if (!body.accessToken) {
    throw new GcpAuthError("impersonate", impersonated.status);
  }
  const expiresAt = body.expireTime ? Date.parse(body.expireTime) : now() + 5 * 60_000;
  cached = { key, token: body.accessToken, expiresAt };
  return body.accessToken;
}
