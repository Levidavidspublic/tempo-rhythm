import type { FirestoreFields } from "./firestore";

export type FirestoreQueryDocument = {
  name: string;
  fields: FirestoreFields;
  createTime: string | undefined;
  updateTime: string | undefined;
};

export type FirestoreQueryResult =
  | {
      ok: true;
      documents: FirestoreQueryDocument[];
      nextCursor: string | null;
      hasMore: boolean;
    }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reads Firestore's REST `runQuery` response without decoding document fields.
 */
export function readQueryResult(json: unknown, pageSize: number): FirestoreQueryResult {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    return { ok: false, reason: "Invalid page size" };
  }
  if (!Array.isArray(json)) {
    return { ok: false, reason: "Invalid query response" };
  }

  const documents: FirestoreQueryDocument[] = [];
  for (const entry of json) {
    if (!isRecord(entry)) {
      continue;
    }
    if (isRecord(entry.error)) {
      return { ok: false, reason: "Firestore query failed" };
    }
    if (!("document" in entry)) {
      continue;
    }

    const document = entry.document;
    if (!isRecord(document) || typeof document.name !== "string") {
      return { ok: false, reason: "Query document has no valid name" };
    }

    documents.push({
      name: document.name,
      fields: (document.fields ?? {}) as FirestoreFields,
      createTime: document.createTime as string | undefined,
      updateTime: document.updateTime as string | undefined,
    });
  }

  return {
    ok: true,
    documents,
    nextCursor: documents.at(-1)?.name ?? null,
    hasMore: documents.length === pageSize,
  };
}
