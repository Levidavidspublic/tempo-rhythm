export const DELETION_GRACE_DAYS = 30;
export const DELETION_GRACE_MS = DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type DeletionWindow =
  | { state: "live" }
  | { state: "restorable"; daysLeft: number; removeAt: number }
  | { state: "remove-due"; removeAt: number };

export function readDeletionWindow(
  deletedAt: number | null | undefined,
  now: number
): DeletionWindow {
  if (deletedAt === undefined || deletedAt === null) {
    return { state: "live" };
  }

  if (!Number.isFinite(deletedAt) || deletedAt < 0 || deletedAt > now) {
    throw new RangeError("Invalid deletedAt");
  }

  const removeAt = deletedAt + DELETION_GRACE_MS;
  if (now >= removeAt) {
    return { state: "remove-due", removeAt };
  }

  return {
    state: "restorable",
    daysLeft: Math.ceil((removeAt - now) / (24 * 60 * 60 * 1000)),
    removeAt,
  };
}

export function canRestoreAccount(deletedAt: number | null | undefined, now: number): boolean {
  return readDeletionWindow(deletedAt, now).state === "restorable";
}
