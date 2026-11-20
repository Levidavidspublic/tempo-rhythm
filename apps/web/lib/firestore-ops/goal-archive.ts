import type { GoalDoc } from "../firestore-docs/goal-doc";

const CHANGED_FIELDS = ["status", "updatedAt"] as const;

/** Plans an immutable Firestore patch for archiving or restoring a goal. */
export function planGoalArchive(goal: GoalDoc, want: "archive" | "restore", now: number) {
  if (goal.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };
  if (want !== "archive" && want !== "restore") {
    return { ok: false as const, reason: "bad-action" as const };
  }

  if (want === "archive") {
    if (goal.status === "archived") {
      return {
        ok: true as const,
        changed: false as const,
        status: "archived" as const,
        patch: {},
        changedFields: [] as const,
      };
    }

    return {
      ok: true as const,
      changed: true as const,
      status: "archived" as const,
      patch: { status: "archived" as const, updatedAt: now },
      changedFields: CHANGED_FIELDS,
    };
  }

  if (goal.status !== "archived") {
    return {
      ok: true as const,
      changed: false as const,
      status: goal.status,
      patch: {},
      changedFields: [] as const,
    };
  }

  const status = goal.progressPercent >= 100 ? ("completed" as const) : ("active" as const);
  return {
    ok: true as const,
    changed: true as const,
    status,
    patch: { status, updatedAt: now },
    changedFields: CHANGED_FIELDS,
  };
}
