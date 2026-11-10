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
  /**
   * Audience to ask Vercel to put on the OIDC token (optional, from GCP_AUDIENCE). Leave unset
   * when the pool provider allows Vercel's default audience (https://vercel.com/<team>); set it to
   * the provider's own audience URL when the provider uses its default. Both are in Vercel's guide.
   */
  audience: string | null;
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
    audience: env.GCP_AUDIENCE?.trim() || null,
  };
}

function providerPath(config: GcpConfig): string {
  return `projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
}

export class GcpAuthError extends Error {
  constructor(
    readonly step: "oidc" | "sts" | "impersonate",
    readonly status: number,
    /** Google's own reason for a refusal, shortened. Identifiers only: never a token. */
    readonly detail: string = ""
  ) {
    super(`Google Cloud keyless auth stopped at "${step}" (status ${status})`);
    this.name = "GcpAuthError";
  }
}

const MAX_DETAIL = 300;

/**
 * Google's reason from an error response, for the server log. Reads the two documented shapes:
 * `{ error, error_description }` (STS) and `{ error: { status, message } }` (other Google APIs).
 */
export async function googleErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string | { status?: string; message?: string };
      error_description?: string;
    };
    const parts =
      typeof body.error === "string"
        ? [body.error, body.error_description]
        : [body.error?.status, body.error?.message];
    return parts
      .filter((part): part is string => typeof part === "string" && part !== "")
      .join(": ")
      .slice(0, MAX_DETAIL);
  } catch {
    return "";
  }
}

/** The issuer, audience and subject a token claims: what the pool provider checks. Not the token. */
function tokenClaims(token: string): string {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { iss, aud, sub } = JSON.parse(json) as Record<string, unknown>;
    return `token iss=${String(iss)} aud=${String(aud)} sub=${String(sub)}`.slice(0, MAX_DETAIL);
  } catch {
    return "";
  }
}

type Deps = {
  fetch: FetchLike;
  getOidcToken: (audience: string | null) => Promise<string>;
  now: () => number;
};

/** How long one outbound request may take. Each request has its own limit. */
export const OUTBOUND_TIMEOUT_MS = 8000;

/** fetch with a time limit, so a stalled Google call cannot hold the function open. */
export const fetchWithTimeout: FetchLike = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });

const defaultDeps: Deps = {
  fetch: fetchWithTimeout,
  getOidcToken: (audience) => (audience ? getVercelOidcToken({ audience }) : getVercelOidcToken()),
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
    // The pool provider checks the token's audience against the audiences it allows.
    subjectToken = await getOidcToken(config.audience);
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
    const reason = [await googleErrorDetail(sts), tokenClaims(subjectToken)]
      .filter(Boolean)
      .join(" | ");
    throw new GcpAuthError("sts", sts.status, reason);
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
    throw new GcpAuthError(
      "impersonate",
      impersonated.status,
      await googleErrorDetail(impersonated)
    );
  }
  const body = (await impersonated.json()) as { accessToken?: string; expireTime?: string };
  if (!body.accessToken) {
    throw new GcpAuthError("impersonate", impersonated.status);
  }
  const expiresAt = body.expireTime ? Date.parse(body.expireTime) : now() + 5 * 60_000;
  cached = { key, token: body.accessToken, expiresAt };
  return body.accessToken;
}
