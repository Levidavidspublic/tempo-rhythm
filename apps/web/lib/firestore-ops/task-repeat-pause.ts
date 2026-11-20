import type { TaskRepeatDoc } from "../firestore-docs/task-repeat-doc";

const CHANGED_FIELDS = ["isPaused", "updatedAt"] as const;
const VALID_WANTS = new Set(["pause", "resume"]);

export function planRepeatPause(
  rule: TaskRepeatDoc,
  want: "pause" | "resume",
  now: number
) {
  if (rule.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };
  if (!VALID_WANTS.has(want)) return { ok: false as const, reason: "bad-want" as const };

  const isPaused = want === "pause";
  if (rule.isPaused === isPaused) {
    return {
      ok: true as const,
      changed: false as const,
      isPaused,
      patch: {},
      changedFields: [] as const,
    };
  }

  return {
    ok: true as const,
    changed: true as const,
    isPaused,
    patch: { isPaused, updatedAt: now },
    changedFields: CHANGED_FIELDS,
  };
}
