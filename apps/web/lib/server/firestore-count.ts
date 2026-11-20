import type { FirestoreValue } from "./firestore";

export type CountFilter = {
  field: string;
  value: FirestoreValue;
};

type CountRequestResult =
  | { ok: true; url: string; body: Record<string, unknown> }
  | { ok: false; reason: string };

type CountResult = { ok: true; count: number } | { ok: false; reason: string };

const FIELD_NAME = /^[A-Za-z0-9_]+$/;

/** Build a Firestore REST aggregation request for one owner collection. */
export function buildCountRequest(
  projectId: string,
  uid: string,
  collection: string,
  filters: CountFilter[],
  upTo?: number
): CountRequestResult {
  if (!projectId || !uid || !collection) {
    return { ok: false, reason: "project, owner, and collection are required" };
  }
  if (uid.includes("/") || collection.includes("/")) {
    return { ok: false, reason: "owner and collection must be single path segments" };
  }
  if (filters.length > 5) {
    return { ok: false, reason: "at most five filters are allowed" };
  }
  if (filters.some(({ field }) => !FIELD_NAME.test(field))) {
    return { ok: false, reason: "filter fields may contain only letters, digits, and underscores" };
  }
  if (new Set(filters.map(({ field }) => field)).size !== filters.length) {
    return { ok: false, reason: "filter fields must be unique" };
  }
  if (upTo !== undefined && (!Number.isInteger(upTo) || upTo < 1 || upTo > 1000)) {
    return { ok: false, reason: "upTo must be an integer from 1 to 1000" };
  }

  const fieldFilters = filters.map(({ field, value }) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value },
  }));
  const where =
    fieldFilters.length === 1
      ? fieldFilters[0]
      : fieldFilters.length > 1
        ? { compositeFilter: { op: "AND", filters: fieldFilters } }
        : undefined;
  const structuredQuery = {
    from: [{ collectionId: collection }],
    ...(where ? { where } : {}),
  };
  const count = upTo === undefined ? {} : { upTo: String(upTo) };

  return {
    ok: true,
    url: `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/users/${encodeURIComponent(uid)}:runAggregationQuery`,
    body: {
      structuredAggregationQuery: {
        structuredQuery,
        aggregations: [{ alias: "count", count }],
      },
    },
  };
}

/** Read the count from Firestore's streamed aggregation response. */
export function readCountResult(json: unknown): CountResult {
  if (!Array.isArray(json)) {
    return { ok: false, reason: "aggregation response must be an array" };
  }
  const entry = json[0];
  if (typeof entry !== "object" || entry === null) {
    return { ok: false, reason: "aggregation result is missing" };
  }
  if ("error" in entry) {
    return { ok: false, reason: "aggregation response contains an error" };
  }

  const value = (
    entry as {
      result?: { aggregateFields?: { count?: { integerValue?: unknown } } };
    }
  ).result?.aggregateFields?.count?.integerValue;
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    return { ok: false, reason: "aggregation count is missing or invalid" };
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    return { ok: false, reason: "aggregation count is missing or invalid" };
  }
  return { ok: true, count };
}
