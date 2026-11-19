export const NOTIFICATION_KINDS = ["system", "reminder", "billing"] as const;

export type NotificationDoc = {
  title: string;
  body: string;
  kind: (typeof NOTIFICATION_KINDS)[number];
  createdAt: number;
  updatedAt: number;
  readAt?: number;
  deletedAt?: number;
};

export class NotificationDocError extends Error {
  constructor(field: string) {
    super(`Invalid field: ${field}`);
    this.name = "NotificationDocError";
  }
}

const knownKeys = new Set([
  "title",
  "body",
  "kind",
  "createdAt",
  "updatedAt",
  "readAt",
  "deletedAt",
  "userId",
  "_id",
  "_creationTime",
]);

function parseText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new NotificationDocError(field);

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new NotificationDocError(field);
  }
  return trimmed;
}

function parseNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NotificationDocError(field);
  }
  return value;
}

export function parseNotificationDoc(input: unknown): NotificationDoc {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new NotificationDocError("document");
  }

  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) throw new NotificationDocError(key);
  }

  const title = parseText(record.title, "title", 200);
  const body = parseText(record.body, "body", 2_000);
  if (!NOTIFICATION_KINDS.some((kind) => kind === record.kind)) {
    throw new NotificationDocError("kind");
  }

  const doc: NotificationDoc = {
    title,
    body,
    kind: record.kind as NotificationDoc["kind"],
    createdAt: parseNumber(record.createdAt, "createdAt"),
    updatedAt: parseNumber(record.updatedAt, "updatedAt"),
  };

  if (record.readAt !== undefined)
    doc.readAt = parseNumber(record.readAt, "readAt");
  if (record.deletedAt !== undefined) {
    doc.deletedAt = parseNumber(record.deletedAt, "deletedAt");
  }

  return doc;
}

export function markNotificationRead(
  doc: NotificationDoc,
  now: number,
): NotificationDoc {
  if (doc.readAt !== undefined) return doc;
  return { ...doc, readAt: now, updatedAt: now };
}

export function softDeleteNotificationDoc(
  doc: NotificationDoc,
  now: number,
): NotificationDoc {
  return { ...doc, deletedAt: now, updatedAt: now };
}

export function countUnread(docs: readonly NotificationDoc[]): number {
  return docs.filter(
    (doc) => doc.readAt === undefined && doc.deletedAt === undefined,
  ).length;
}
