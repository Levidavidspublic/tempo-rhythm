import { checkHabitDoc, type HabitDoc } from "../firestore-docs/habit-doc";

const HABIT_NAME_LIMIT = 120;

type HabitEdit = {
  name?: string;
  cadence?: "daily" | "weekly";
};

export function planHabitEdit(habit: HabitDoc, edit: HabitEdit, now: number) {
  if (habit.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };

  let name: string | undefined;
  if (edit.name !== undefined) {
    name = edit.name.trim();
    if (name === "") return { ok: false as const, reason: "empty-name" as const };
    name = name.slice(0, HABIT_NAME_LIMIT);
  }

  if (edit.cadence !== undefined && edit.cadence !== "daily" && edit.cadence !== "weekly") {
    return { ok: false as const, reason: "bad-cadence" as const };
  }

  const patch: Partial<Pick<HabitDoc, "name" | "cadence" | "updatedAt">> = {};
  const changedFields: Array<"name" | "cadence" | "updatedAt"> = [];

  if (name !== undefined && name !== habit.name) {
    patch.name = name;
    changedFields.push("name");
  }
  if (edit.cadence !== undefined && edit.cadence !== habit.cadence) {
    patch.cadence = edit.cadence;
    changedFields.push("cadence");
  }

  if (changedFields.length === 0) return { ok: true as const, unchanged: true as const };

  patch.updatedAt = now;
  changedFields.push("updatedAt");

  // Keep the planned patch aligned with the document contract without changing the stored habit.
  checkHabitDoc({ ...habit, ...patch });

  return {
    ok: true as const,
    unchanged: false as const,
    patch,
    changedFields,
  };
}
