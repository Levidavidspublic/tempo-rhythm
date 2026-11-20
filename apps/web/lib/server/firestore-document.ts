export type FirestoreDocument = {
  path: string;
  segments: string[];
  docId: string;
  fields: Record<string, unknown>;
  createTime?: string;
  updateTime: string;
};

export type FirestoreDocumentResult =
  | { ok: true; document: FirestoreDocument }
  | { ok: false; reason: string };

const DEFAULT_DATABASE_DOCUMENTS = "/databases/(default)/documents/";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Turns a Firestore REST Document response into checked path metadata and raw fields. */
export function readFirestoreDocument(json: unknown): FirestoreDocumentResult {
  if (!isObject(json)) {
    return { ok: false, reason: "answer is not an object" };
  }

  if (typeof json.name !== "string") {
    return { ok: false, reason: "document name is missing" };
  }

  const markerIndex = json.name.indexOf(DEFAULT_DATABASE_DOCUMENTS);
  if (markerIndex === -1) {
    return { ok: false, reason: "document name is outside the default database" };
  }

  const path = json.name.slice(markerIndex + DEFAULT_DATABASE_DOCUMENTS.length);
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0)) {
    return { ok: false, reason: "document path has an empty segment" };
  }
  if (segments.length % 2 !== 0) {
    return { ok: false, reason: "document path names a collection" };
  }

  const fields = json.fields ?? {};
  if (!isObject(fields)) {
    return { ok: false, reason: "document fields are not an object" };
  }
  if (typeof json.updateTime !== "string") {
    return { ok: false, reason: "document update time is missing" };
  }

  return {
    ok: true,
    document: {
      path,
      segments,
      docId: segments[segments.length - 1],
      fields,
      createTime: typeof json.createTime === "string" ? json.createTime : undefined,
      updateTime: json.updateTime,
    },
  };
}

/** Returns the owning uid for owner and private document trees. */
export function ownerOfDocumentPath(segments: readonly string[]): string | null {
  if ((segments[0] === "users" || segments[0] === "private") && segments[1]) {
    return segments[1];
  }
  return null;
}
