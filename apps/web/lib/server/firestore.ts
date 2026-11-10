import {
  type FetchLike,
  type GcpConfig,
  getGcpAccessToken,
  googleErrorDetail,
} from "./gcp-access-token";

/**
 * Minimal Cloud Firestore access for Vercel functions, over the REST API with native fetch.
 * Server only. Requests are made as the service account, so firestore.rules (which close every
 * collection to clients) do not apply; nothing here is reachable from the browser.
 */
export const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

export type FirestoreValue =
  | { stringValue: string }
  | { timestampValue: string }
  | { booleanValue: boolean }
  | { nullValue: null };

export type FirestoreFields = Record<string, FirestoreValue>;

type Deps = {
  fetch: FetchLike;
  getAccessToken: (config: GcpConfig, scope: string) => Promise<string>;
};

const defaultDeps: Deps = {
  fetch: (input, init) => fetch(input, init),
  getAccessToken: (config, scope) => getGcpAccessToken(config, scope),
};

export class FirestoreError extends Error {
  constructor(
    readonly status: number,
    /** Google's own reason for a refusal, shortened. */
    readonly detail: string = ""
  ) {
    super(`Firestore answered ${status}`);
    this.name = "FirestoreError";
  }
}

function documentsUrl(config: GcpConfig): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents`;
}

/**
 * Creates `collection/documentId`. Returns "created", or "exists" when the document is already
 * there (nothing is overwritten).
 */
export async function createDocument(
  config: GcpConfig,
  collection: string,
  documentId: string,
  fields: FirestoreFields,
  deps: Partial<Deps> = {}
): Promise<"created" | "exists"> {
  const { fetch: doFetch, getAccessToken } = { ...defaultDeps, ...deps };
  const token = await getAccessToken(config, FIRESTORE_SCOPE);
  const url = `${documentsUrl(config)}/${collection}?documentId=${encodeURIComponent(documentId)}`;
  const response = await doFetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (response.status === 409) {
    return "exists";
  }
  if (!response.ok) {
    throw new FirestoreError(response.status, await googleErrorDetail(response));
  }
  return "created";
}
