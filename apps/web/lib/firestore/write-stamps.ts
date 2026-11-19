export class WriteStampError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteStampError";
  }
}

export const OWNER_FIELDS = ["userId", "uid", "ownerId"] as const;

function assertValidNow(now: number): void {
  if (!Number.isFinite(now) || now <= 0) {
    throw new WriteStampError("now must be a finite positive number");
  }
}

function assertAllowedFields(fields: Record<string, unknown>): void {
  for (const key of Object.keys(fields)) {
    if ((OWNER_FIELDS as readonly string[]).includes(key) || key.startsWith("_")) {
      throw new WriteStampError(`field ${key} is not allowed`);
    }
  }
}

export function stampCreate<T extends Record<string, unknown>>(
  fields: T,
  now: number,
): T & { createdAt: number; updatedAt: number } {
  assertValidNow(now);
  assertAllowedFields(fields);

  const { deletedAt: _deletedAt, ...withoutDeletedAt } = fields;
  return {
    ...withoutDeletedAt,
    createdAt: now,
    updatedAt: now,
  } as T & { createdAt: number; updatedAt: number };
}

export function stampUpdate<T extends Record<string, unknown>>(
  changes: T,
  now: number,
): T & { updatedAt: number } {
  assertValidNow(now);
  assertAllowedFields(changes);

  if (Object.hasOwn(changes, "createdAt") || Object.hasOwn(changes, "deletedAt")) {
    throw new WriteStampError(
      "createdAt and deletedAt cannot be changed by stampUpdate",
    );
  }

  return { ...changes, updatedAt: now };
}

export function softDeletePatch(
  now: number,
): { deletedAt: number; updatedAt: number } {
  assertValidNow(now);
  return { deletedAt: now, updatedAt: now };
}

export function restorePatch(
  now: number,
): { set: { updatedAt: number }; remove: readonly ["deletedAt"] } {
  assertValidNow(now);
  return { set: { updatedAt: now }, remove: ["deletedAt"] as const };
}
