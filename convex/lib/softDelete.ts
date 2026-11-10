/** Undo window inside the app after a delete (PRD §5 "Soft delete"). */
export const UNDO_WINDOW_MS = 5 * 60 * 1000;

/** Rows stay restorable for 30 days after `deletedAt`. */
export const GRACE_MS = 30 * 24 * 60 * 60 * 1000;

export function undoUntil(deletedAt: number): number {
	return deletedAt + UNDO_WINDOW_MS;
}

/** True when the row is deleted and still inside the 30-day grace window. */
export function isRestorable(deletedAt: number | undefined, now: number): boolean {
	return deletedAt !== undefined && now - deletedAt <= GRACE_MS;
}
