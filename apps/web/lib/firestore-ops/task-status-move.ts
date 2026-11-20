import type { TaskDoc } from "../firestore/task-doc";

type MovableTaskStatus = "todo" | "in_progress" | "cancelled";

const VALID_STATUSES = new Set<MovableTaskStatus>(["todo", "in_progress", "cancelled"]);
const CHANGED_FIELDS = ["status", "updatedAt"] as const;
const CHANGED_FIELDS_FROM_DONE = ["status", "completedAt", "updatedAt"] as const;

export function planTaskStatusMove(task: TaskDoc, want: MovableTaskStatus, now: number) {
  if (task.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };
  if (!VALID_STATUSES.has(want)) return { ok: false as const, reason: "bad-status" as const };

  if (task.status === want) {
    return {
      ok: true as const,
      changed: false as const,
      status: want,
      patch: {},
      changedFields: [] as const,
      clearFields: [] as const,
    };
  }

  const wasDone = task.status === "done";
  return {
    ok: true as const,
    changed: true as const,
    status: want,
    patch: { status: want, updatedAt: now },
    changedFields: wasDone ? CHANGED_FIELDS_FROM_DONE : CHANGED_FIELDS,
    clearFields: wasDone ? (["completedAt"] as const) : ([] as const),
  };
}
