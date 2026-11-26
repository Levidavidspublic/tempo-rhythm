import { restorePatch, softDeletePatch } from "../firestore/write-stamps";

export const UNDO_WINDOW_MS = 10_000;

export function planSoftDelete(stored: { deletedAt?: number }, now: number) {
  if (typeof stored.deletedAt === "number") {
    return { ok: false as const, reason: "already-deleted" as const };
  }

  if (!Number.isFinite(now) || now <= 0) {
    return { ok: false as const, reason: "invalid-time" as const };
  }

  return {
    ok: true as const,
    deletePatch: softDeletePatch(now),
    undoPatch: restorePatch(now),
    undoUntil: now + UNDO_WINDOW_MS,
  };
}

export function undoState(deletedAt: number | undefined, now: number) {
  if (deletedAt === undefined || now >= deletedAt + UNDO_WINDOW_MS) {
    return { canUndo: false as const, secondsLeft: 0 };
  }

  return {
    canUndo: true as const,
    secondsLeft: Math.ceil((deletedAt + UNDO_WINDOW_MS - now) / 1_000),
  };
}
