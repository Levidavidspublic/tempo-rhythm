import { checkGoalDoc, type GoalDoc } from "../firestore-docs/goal-doc";

export type GoalEdit = {
  title?: string;
  description?: string;
  targetDate?: number | null;
};

export type GoalEditPlan =
  | { kind: "patch"; patch: Partial<GoalDoc>; fields: string[]; clearFields: string[] }
  | { kind: "unchanged" }
  | { kind: "refused"; reason: string };

/** Plans a checked, immutable Firestore patch for editable goal fields. */
export function planGoalEdit(stored: GoalDoc, edit: GoalEdit, now: number): GoalEditPlan {
  try {
    if (stored.deletedAt !== undefined) {
      return { kind: "refused", reason: "goal is deleted" };
    }
    if (stored.status === "archived") {
      return { kind: "refused", reason: "goal is archived" };
    }
    if (edit.title !== undefined && edit.title.trim() === "") {
      return { kind: "refused", reason: "title must not be empty" };
    }
    if (typeof edit.targetDate === "number" && !Number.isFinite(edit.targetDate)) {
      return { kind: "refused", reason: "targetDate must be a number" };
    }

    const patch: Partial<GoalDoc> = {};
    const clearFields: string[] = [];

    if (edit.title !== undefined) {
      const title = edit.title.trim().slice(0, 120).trim();
      if (title !== stored.title) patch.title = title;
    }

    if (edit.description !== undefined) {
      const description = edit.description.trim();
      if (description === "") {
        if (stored.description !== undefined) clearFields.push("description");
      } else if (description !== stored.description) {
        patch.description = description;
      }
    }

    if (edit.targetDate !== undefined) {
      if (edit.targetDate === null) {
        if (stored.targetDate !== undefined) clearFields.push("targetDate");
      } else if (edit.targetDate !== stored.targetDate) {
        patch.targetDate = edit.targetDate;
      }
    }

    const changedFields = [...Object.keys(patch), ...clearFields];
    if (changedFields.length === 0) return { kind: "unchanged" };

    patch.updatedAt = now;
    const candidate: Partial<GoalDoc> = { ...stored, ...patch };
    for (const field of clearFields) delete candidate[field as keyof GoalDoc];

    const checked = checkGoalDoc(candidate);
    if (!checked.ok) return { kind: "refused", reason: checked.reason };

    return {
      kind: "patch",
      patch,
      fields: [...changedFields, "updatedAt"].sort(),
      clearFields: clearFields.sort(),
    };
  } catch {
    return { kind: "refused", reason: "goal could not be checked" };
  }
}
