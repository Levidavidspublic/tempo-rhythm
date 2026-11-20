import type { TaskDoc } from "../firestore/task-doc";

const CHANGED_FIELDS = ["status", "completedAt", "updatedAt"] as const;

export function planTaskToggle(task: TaskDoc, now: number) {
  if (task.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };

  if (task.status === "done") {
    return {
      ok: true as const,
      status: "todo" as const,
      patch: { status: "todo" as const, updatedAt: now },
      changedFields: CHANGED_FIELDS,
      clearFields: ["completedAt"] as const,
    };
  }

  return {
    ok: true as const,
    status: "done" as const,
    patch: { status: "done" as const, completedAt: now, updatedAt: now },
    changedFields: CHANGED_FIELDS,
    clearFields: [] as const,
  };
}
