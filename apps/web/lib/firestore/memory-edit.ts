import { checkMemoryDoc } from "../firestore-docs/memory-doc";
import { softDeletePatch, stampUpdate } from "./write-stamps";

export const MEMORY_CONTENT_MAX = 2000;

type MemoryEditFailure = {
  ok: false;
  reason: "invalid-memory" | "deleted" | "empty" | "too-long" | "invalid-now";
};

export type MemoryEditPlan =
  | {
      ok: true;
      kind: "update";
      patch: { content: string; updatedAt: number };
      changedFields: ["content", "updatedAt"];
    }
  | { ok: true; kind: "no-change" }
  | MemoryEditFailure;

export type MemoryForgetPlan =
  | { ok: true; patch: { deletedAt: number; updatedAt: number } }
  | { ok: false; reason: "invalid-memory" | "deleted" | "invalid-now" };

function isValidNow(now: number): boolean {
  return Number.isFinite(now) && now > 0;
}

export function planMemoryEdit(stored: unknown, content: unknown, now: number): MemoryEditPlan {
  const checked = checkMemoryDoc(stored);
  if (!checked.ok) return { ok: false, reason: "invalid-memory" };
  if (checked.doc.deletedAt !== undefined) return { ok: false, reason: "deleted" };

  if (typeof content !== "string") return { ok: false, reason: "empty" };
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MEMORY_CONTENT_MAX) return { ok: false, reason: "too-long" };
  if (!isValidNow(now)) return { ok: false, reason: "invalid-now" };
  if (trimmed === checked.doc.content) return { ok: true, kind: "no-change" };

  return {
    ok: true,
    kind: "update",
    patch: stampUpdate({ content: trimmed }, now),
    changedFields: ["content", "updatedAt"],
  };
}

export function planMemoryForget(stored: unknown, now: number): MemoryForgetPlan {
  const checked = checkMemoryDoc(stored);
  if (!checked.ok) return { ok: false, reason: "invalid-memory" };
  if (checked.doc.deletedAt !== undefined) return { ok: false, reason: "deleted" };
  if (!isValidNow(now)) return { ok: false, reason: "invalid-now" };

  return { ok: true, patch: softDeletePatch(now) };
}
