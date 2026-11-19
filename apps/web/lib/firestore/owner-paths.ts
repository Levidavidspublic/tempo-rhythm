export const OWNER_COLLECTIONS = [
  "conversations",
  "chatRequests",
  "memories",
  "tasks",
  "taskRepeatCfgs",
  "calendarEvents",
  "focusBlocks",
  "notes",
  "noteBlocks",
  "pageOperations",
  "pageOperationPayloads",
  "pageProposals",
  "habits",
  "goals",
  "dayPlans",
  "timeBlocks",
  "habitCheckIns",
  "templates",
  "userPreferences",
  "coachWebSearches",
  "nags",
  "coachSettings",
  "coachProposals",
  "notifications",
  "messages",
] as const;

export type OwnerCollection = (typeof OWNER_COLLECTIONS)[number];

const ownerCollections = new Set<string>(OWNER_COLLECTIONS);
const reservedSegmentPattern = /^__.*__$/;

export class OwnerPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnerPathError";
  }
}

function assertValidSegment(
  value: unknown,
  segment: "uid" | "document id"
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
    throw new OwnerPathError(`Invalid ${segment} segment`);
  }
}

function assertOwnerCollection(collection: unknown): asserts collection is OwnerCollection {
  if (typeof collection !== "string" || !ownerCollections.has(collection)) {
    throw new OwnerPathError(`Rejected owner collection: ${String(collection)}`);
  }
}

export function userDocPath(uid: string): string {
  assertValidSegment(uid, "uid");
  return `users/${uid}`;
}

export function ownerCollectionPath(uid: string, collection: OwnerCollection): string {
  assertValidSegment(uid, "uid");
  assertOwnerCollection(collection);
  return `users/${uid}/${collection}`;
}

export function ownerDocPath(uid: string, collection: OwnerCollection, docId: string): string {
  assertValidSegment(uid, "uid");
  assertOwnerCollection(collection);
  assertValidSegment(docId, "document id");
  return `users/${uid}/${collection}/${docId}`;
}
