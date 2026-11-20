import { type TaskDoc, type TaskEnergy, toTaskDoc } from "../firestore/task-doc";

const QUICK_TITLE_MAX = 280;

export type QuickTaskInput = {
  title: string;
  dueAt?: number;
  projectId?: string;
  projectName?: string;
  energy?: TaskEnergy;
};

export type QuickTaskDraft =
  | { ok: true; doc: TaskDoc }
  | { ok: false; reason: "empty-title" | "bad-due" | "bad-time" };

export function draftQuickTask(input: QuickTaskInput, now: number): QuickTaskDraft {
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) return { ok: false, reason: "empty-title" };
  if (input.dueAt !== undefined && !Number.isFinite(input.dueAt)) {
    return { ok: false, reason: "bad-due" };
  }
  if (!Number.isFinite(now)) return { ok: false, reason: "bad-time" };

  const title =
    trimmedTitle.length > QUICK_TITLE_MAX
      ? `${trimmedTitle.slice(0, QUICK_TITLE_MAX - 3)}...`
      : trimmedTitle;
  const projectId = input.projectId?.trim();
  const projectName = input.projectName?.trim();

  const doc = toTaskDoc({
    title,
    status: "todo",
    priority: "medium",
    energy: input.energy ?? "medium",
    ...(projectId ? { projectId } : {}),
    ...(projectName ? { projectName } : {}),
    ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true, doc };
}
