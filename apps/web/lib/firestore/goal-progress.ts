import { checkGoalDoc, type GoalDoc } from "../firestore-docs/goal-doc";

export type GoalProgressPlan =
  | { kind: "patch"; patch: Partial<GoalDoc>; fields: string[] }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

/** Plans a checked, immutable Firestore patch for a goal progress change. */
export function planGoalProgress(
  stored: GoalDoc,
  percent: number,
  now: number,
): GoalProgressPlan {
  try {
    if (stored.deletedAt !== undefined) {
      return { kind: "refused", reason: "goal is deleted" };
    }
    if (stored.status === "archived") {
      return { kind: "refused", reason: "goal is archived" };
    }
    if (!Number.isFinite(percent)) {
      return { kind: "refused", reason: "percent must be a number" };
    }

    const progressPercent = Math.min(100, Math.max(0, Math.round(percent)));
    if (progressPercent === stored.progressPercent) {
      return { kind: "unchanged" };
    }

    const patch: Partial<GoalDoc> = { progressPercent, updatedAt: now };
    if (progressPercent === 100 && stored.status === "active") {
      patch.status = "completed";
    } else if (progressPercent < 100 && stored.status === "completed") {
      patch.status = "active";
    }

    const checked = checkGoalDoc({ ...stored, ...patch });
    if (!checked.ok) {
      return { kind: "refused", reason: checked.reason };
    }

    return { kind: "patch", patch, fields: Object.keys(patch).sort() };
  } catch {
    return { kind: "refused", reason: "goal could not be checked" };
  }
}
