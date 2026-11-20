import type { TaskDoc } from "../firestore/task-doc";

export type TaskChecklistAction =
  | { kind: "toggle"; itemId: string }
  | { kind: "add"; itemId: string; text: string }
  | { kind: "rename"; itemId: string; text: string }
  | { kind: "remove"; itemId: string };

const CHANGED_FIELDS = ["checklist", "updatedAt"] as const;

function copyChecklist(task: TaskDoc) {
  return (task.checklist ?? []).map((item) => ({ ...item }));
}

export function planTaskChecklist(
  task: TaskDoc,
  action: TaskChecklistAction,
  now: number
) {
  if (task.deletedAt !== undefined) return { ok: false as const, reason: "deleted" as const };
  if (!Number.isFinite(now)) return { ok: false as const, reason: "bad-time" as const };

  const actionRecord = action as unknown as Record<string, unknown>;
  if (!new Set(["toggle", "add", "rename", "remove"]).has(actionRecord.kind as string)) {
    return { ok: false as const, reason: "bad-action" as const };
  }

  if (
    (action.kind === "add" || action.kind === "rename") &&
    (typeof action.text !== "string" || action.text.trim().length === 0)
  ) {
    return { ok: false as const, reason: "empty-text" as const };
  }

  const checklist = copyChecklist(task);
  const itemIndex = checklist.findIndex((item) => item.id === action.itemId);

  if (action.kind !== "add" && itemIndex === -1) {
    return { ok: false as const, reason: "unknown-item" as const };
  }
  if (action.kind === "add" && itemIndex !== -1) {
    return { ok: false as const, reason: "duplicate-item" as const };
  }
  if (action.kind === "add" && checklist.length >= 50) {
    return { ok: false as const, reason: "too-many" as const };
  }

  let changed = true;
  if (action.kind === "add") {
    checklist.push({ id: action.itemId, text: action.text.trim().slice(0, 200), completed: false });
  } else if (action.kind === "toggle") {
    checklist[itemIndex] = {
      ...checklist[itemIndex],
      completed: !checklist[itemIndex].completed,
    };
  } else if (action.kind === "rename") {
    const text = action.text.trim().slice(0, 200);
    changed = checklist[itemIndex].text !== text;
    checklist[itemIndex] = { ...checklist[itemIndex], text };
  } else {
    checklist.splice(itemIndex, 1);
  }

  const doneCount = checklist.filter((item) => item.completed).length;
  return {
    ok: true as const,
    changed,
    checklist,
    patch: changed ? { checklist, updatedAt: now } : {},
    changedFields: changed ? CHANGED_FIELDS : ([] as const),
    doneCount,
    totalCount: checklist.length,
  };
}
