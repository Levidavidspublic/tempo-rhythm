import {
  TASK_ENERGIES,
  TASK_PRIORITIES,
  type TaskDoc,
  TaskDocError,
  toTaskDoc,
} from "../firestore/task-doc";

export type TaskEdits = {
  title?: string;
  description?: string | null;
  dueAt?: number | null;
  priority?: TaskDoc["priority"];
  energy?: TaskDoc["energy"] | null;
  projectName?: string | null;
};

const EDITABLE_FIELDS = [
  "title",
  "description",
  "dueAt",
  "priority",
  "energy",
  "projectName",
] as const;
const EDITABLE_FIELD_SET = new Set<string>(EDITABLE_FIELDS);
const CLEARABLE_FIELD_SET = new Set<string>(["description", "dueAt", "energy", "projectName"]);

type EditableField = (typeof EDITABLE_FIELDS)[number];
type ClearableField = Exclude<EditableField, "title" | "priority">;
type TaskEditPatch = Partial<Pick<TaskDoc, EditableField>> & { updatedAt: number };

export type TaskEditPlan =
  | {
      ok: true;
      patch: TaskEditPatch;
      changed: string[];
      clear: ClearableField[];
    }
  | { ok: false; reason: "deleted" | "empty-title" | "invalid" | "no-change" };

export function planTaskEdit(stored: TaskDoc, edits: TaskEdits, now: number): TaskEditPlan {
  if (stored.deletedAt !== undefined) return { ok: false, reason: "deleted" };

  const editRecord = edits as Record<string, unknown>;
  if (Object.keys(editRecord).some((key) => !EDITABLE_FIELD_SET.has(key))) {
    return { ok: false, reason: "invalid" };
  }
  if (
    Object.hasOwn(editRecord, "title") &&
    (typeof edits.title !== "string" || !edits.title.trim())
  ) {
    return { ok: false, reason: "empty-title" };
  }

  const candidate: Record<string, unknown> = { ...stored, updatedAt: now };
  const changes: Partial<Pick<TaskDoc, EditableField>> = {};
  const clear: ClearableField[] = [];

  for (const field of EDITABLE_FIELDS) {
    if (!Object.hasOwn(editRecord, field)) continue;

    const rawValue = editRecord[field];
    if (rawValue === undefined) continue;
    if (rawValue === null && CLEARABLE_FIELD_SET.has(field)) {
      if (stored[field] !== undefined) {
        delete candidate[field];
        clear.push(field as ClearableField);
      }
      continue;
    }

    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (stored[field] !== value) {
      candidate[field] = value;
      (changes as Record<string, unknown>)[field] = value;
    }
  }

  // Keep the accepted values explicit here as well as relying on the canonical
  // task parser, so this edit boundary stays tied to the exported task enums.
  if (
    (changes.priority !== undefined && !TASK_PRIORITIES.includes(changes.priority)) ||
    (changes.energy !== undefined && !TASK_ENERGIES.includes(changes.energy))
  ) {
    return { ok: false, reason: "invalid" };
  }

  if (Object.keys(changes).length === 0 && clear.length === 0) {
    return { ok: false, reason: "no-change" };
  }

  try {
    toTaskDoc(candidate);
  } catch (error) {
    if (error instanceof TaskDocError) return { ok: false, reason: "invalid" };
    throw error;
  }

  const patch = { ...changes, updatedAt: now } as TaskEditPatch;
  const changed = [...Object.keys(changes), ...clear, "updatedAt"].sort();
  return { ok: true, patch, changed, clear: clear.sort() };
}
