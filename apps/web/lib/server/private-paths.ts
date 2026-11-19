export const PRIVATE_COLLECTIONS = [
  "connectionSecrets",
  "oauthPending",
  "mcpTokens",
  "subscriptionStates",
  "connections",
  "connectionCalls",
  "connectionLimits",
  "voiceLeases",
] as const;

export type PrivateCollection = (typeof PRIVATE_COLLECTIONS)[number];

const privateCollections = new Set<string>(PRIVATE_COLLECTIONS);
const reservedSegmentPattern = /^__.*__$/;

export class PrivatePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivatePathError";
  }
}

function assertValidSegment(
  value: unknown,
  segment: "uid" | "collection" | "document id"
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1500 ||
    value.includes("/") ||
    value === "." ||
    value === ".." ||
    reservedSegmentPattern.test(value)
  ) {
    throw new PrivatePathError(`Invalid ${segment} segment`);
  }
}

function assertPrivateUid(uid: unknown): asserts uid is string {
  assertValidSegment(uid, "uid");
  if (uid === "shared") {
    throw new PrivatePathError("Reserved uid segment");
  }
}

function assertPrivateCollection(
  collection: unknown
): asserts collection is PrivateCollection {
  assertValidSegment(collection, "collection");
  if (!privateCollections.has(collection)) {
    throw new PrivatePathError(`Rejected private collection: ${collection}`);
  }
}

export function privateCollectionPath(
  uid: string,
  collection: PrivateCollection
): string {
  assertPrivateUid(uid);
  assertPrivateCollection(collection);
  return `private/${uid}/${collection}`;
}

export function privateDocPath(
  uid: string,
  collection: PrivateCollection,
  docId: string
): string {
  assertPrivateUid(uid);
  assertPrivateCollection(collection);
  assertValidSegment(docId, "document id");
  return `private/${uid}/${collection}/${docId}`;
}

export function sharedOauthClientPath(docId: string): string {
  assertValidSegment(docId, "document id");
  return `private/shared/oauthClients/${docId}`;
}
