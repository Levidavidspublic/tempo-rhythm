"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ToastState, UNDO_WINDOW_MS, UndoToast } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TaskRowEditor, type TaskEditorUpdate } from "@/components/tasks/TaskRowEditor";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getChecklistProgress,
  parseChecklistText,
  toggleChecklistItem,
} from "@/convex/lib/taskChecklists";
import type { MessageKey } from "@/lib/i18n";
import {
  filterTasksForView,
  groupTasksByEnergy,
  groupTasksByPriority,
  slugifyProjectName,
  type TaskChecklistItem,
  type TaskEnergy,
  type TaskPriority,
  type TaskStatus,
  type TaskView,
  type TaskViewRecord,
  titleFromProjectSlug,
} from "@/lib/task-view-filters";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { cn } from "@/lib/utils";

type TaskViewsScreenProps = {
  view: TaskView;
  projectSlug?: string;
};

type ConvexTaskRecord = Doc<"tasks"> & {
  energy?: TaskEnergy;
  projectId?: string;
  projectName?: string;
};

type LocalTaskRecord = TaskViewRecord & {
  createdAt: number;
};

type RepeatDraft = "none" | "daily" | "weekly";

type Draft = {
  title: string;
  projectName: string;
  priority: TaskPriority;
  energy: TaskEnergy;
  dueToday: boolean;
  dueDate: string;
  repeat: RepeatDraft;
  checklistText: string;
};

const localStorageKey = "tempo:task-views-core:v1";

type Translate = (key: MessageKey) => string;

const viewLinks: readonly { href: string; label: MessageKey }[] = [
  { href: "/today", label: "nav.today" },
  { href: "/tasks", label: "tasks.inbox" },
  { href: "/projects/home-reset", label: "tasks.project" },
  { href: "/tasks/priority", label: "tasks.priority" },
  { href: "/tasks/energy", label: "tasks.energy" },
  { href: "/tasks/checklists", label: "tasks.checklists" },
];

const viewTitles: Record<Exclude<TaskView, "project">, MessageKey> = {
  today: "nav.today",
  inbox: "tasks.inbox",
  priority: "tasks.priority",
  energy: "tasks.energy",
  checklists: "tasks.checklists",
};

const viewHrefs: Record<Exclude<TaskView, "project">, string> = {
  today: "/today",
  inbox: "/tasks",
  priority: "/tasks/priority",
  energy: "/tasks/energy",
  checklists: "/tasks/checklists",
};

// The project starts empty: a prefilled name made a project the person never chose.
const defaultDraft: Draft = {
  title: "",
  projectName: "",
  priority: "medium",
  energy: "medium",
  dueToday: false,
  dueDate: "",
  repeat: "none",
  checklistText: "",
};

const allowLocalTaskViews =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

// Key order is the group order on screen.
const priorityLabels: Record<TaskPriority, MessageKey> = {
  high: "tasks.group.priority.high",
  medium: "tasks.group.priority.medium",
  low: "tasks.group.priority.low",
};

const energyLabels: Record<TaskEnergy, MessageKey> = {
  low: "tasks.group.energy.low",
  medium: "tasks.group.energy.medium",
  high: "tasks.group.energy.high",
};

const priorityChips: Record<TaskPriority, MessageKey> = {
  high: "tasks.chip.priority.high",
  medium: "tasks.chip.priority.medium",
  low: "tasks.chip.priority.low",
};

const energyChips: Record<TaskEnergy, MessageKey> = {
  low: "tasks.chip.energy.low",
  medium: "tasks.chip.energy.medium",
  high: "tasks.chip.energy.high",
};

/** Fills a `{title}`-style slot; the function replacer keeps a "$" in a task title literal. */
function fillSlot(template: string, slot: string, value: string): string {
  return template.replace(`{${slot}}`, () => value);
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "todo" || value === "in_progress" || value === "done" || value === "cancelled";
}

function isTaskLevel(value: unknown): value is TaskPriority {
  return value === "low" || value === "medium" || value === "high";
}

function isLocalTaskRecord(value: unknown): value is LocalTaskRecord {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    isTaskStatus(row.status) &&
    isTaskLevel(row.priority) &&
    isTaskLevel(row.energy) &&
    typeof row.updatedAt === "number" &&
    typeof row.createdAt === "number"
  );
}

function isChecklistItem(value: unknown): value is TaskChecklistItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.completed === "boolean"
  );
}

function readLocalTask(value: unknown): LocalTaskRecord | null {
  if (!isLocalTaskRecord(value)) return null;
  const row = value as LocalTaskRecord & { checklist?: unknown; projectName?: unknown };
  const projectName = typeof row.projectName === "string" ? row.projectName : undefined;
  const validChecklist = Array.isArray(row.checklist) ? row.checklist.filter(isChecklistItem) : [];
  const checklist = validChecklist.length > 0 ? validChecklist : undefined;
  return { ...row, projectName, checklist };
}

function loadLocalTasks(): LocalTaskRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const task = readLocalTask(row);
      return task ? [task] : [];
    });
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: LocalTaskRecord[]) {
  window.localStorage.setItem(localStorageKey, JSON.stringify(tasks));
}

function localEndOfDay(value: string): number | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + 1).getTime() - 1;
}

/**
 * The project a new task gets from the typed name. A blank name means no project at all, never
 * `""`: projects are only the tasks that share a projectId, so a stray value lists a stray project.
 */
export function projectForCreate(name: string): { projectId?: string; projectName?: string } {
  const projectName = name.trim();
  if (!projectName) return {};
  return { projectId: slugifyProjectName(projectName) || undefined, projectName };
}

/**
 * The toast a delete shows: Undo until `undoUntilMs` (the server's, or the same 5 minutes in the
 * local store), then it goes. There is one at a time; a newer delete replaces it.
 */
export function deletedTaskToast(
  title: string,
  undoUntilMs: number,
  onUndo: () => Promise<void>
): ToastState {
  return { id: Date.now(), title, undoUntilMs, onUndo };
}

/** Undo in the local store: the task goes back where it was, and never twice. */
export function restoreLocalTask<T extends { id: string }>(
  tasks: T[],
  task: T,
  index: number
): T[] {
  if (tasks.some((item) => item.id === task.id)) return tasks;
  const at = Math.min(Math.max(index, 0), tasks.length);
  return [...tasks.slice(0, at), task, ...tasks.slice(at)];
}

function getViewTitle(view: TaskView, t: Translate, projectSlug?: string): string {
  // A project's title is its own name (user data), so it is not translated.
  if (view === "project") return titleFromProjectSlug(projectSlug ?? "project");
  return t(viewTitles[view]);
}

function toViewRecord(task: ConvexTaskRecord): TaskViewRecord {
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    energy: task.energy ?? "medium",
    projectId: task.projectId,
    projectName: task.projectName,
    dueAt: task.dueAt,
    checklist: task.checklist,
    updatedAt: task.updatedAt,
  };
}

export function TaskViewsScreen({ view, projectSlug }: TaskViewsScreenProps) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convexTasks = useQuery(api.tasks.list, isAuthenticated ? {} : "skip");
  const createTask = useMutation(api.tasks.create);
  const createRepeatCfg = useMutation(api.tasks.createRepeatCfg);
  const setTaskRepeatCfg = useMutation(api.tasks.setTaskRepeatCfg);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const restoreTask = useMutation(api.tasks.restore);
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const [localTasks, setLocalTasks] = useState<LocalTaskRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...defaultDraft,
    dueToday: view === "today",
    projectName: view === "project" ? getViewTitle(view, t, projectSlug) : defaultDraft.projectName,
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (allowLocalTaskViews) {
      setLocalTasks(loadLocalTasks());
    }
  }, []);

  // Normalize URL slug the same way create does, so mixed-case / irregular
  // slugs still match newly created tasks in this project view.
  const projectId =
    view === "project"
      ? slugifyProjectName(projectSlug ?? "home-reset") || "home-reset"
      : undefined;
  const projectName = view === "project" ? getViewTitle(view, t, projectSlug) : undefined;
  const usesConvex = isAuthenticated && convexTasks !== undefined;
  const usesLocalStore = !usesConvex && allowLocalTaskViews;
  const taskStoreReady = usesConvex || usesLocalStore;
  const isTaskStoreLoading = isAuthLoading || (isAuthenticated && convexTasks === undefined);

  const allTasks = useMemo<TaskViewRecord[]>(() => {
    if (usesConvex) {
      return (convexTasks as ConvexTaskRecord[]).map(toViewRecord);
    }
    return usesLocalStore ? localTasks : [];
  }, [convexTasks, localTasks, usesConvex, usesLocalStore]);

  const visibleTasks = useMemo(() => {
    if (view === "today") {
      return filterTasksForView(allTasks, {
        view: "today",
        todayStart: bounds.startMs,
        todayEnd: bounds.endMs,
      });
    }

    if (view === "project") {
      return filterTasksForView(allTasks, {
        view: "project",
        projectId: projectId ?? "home-reset",
      });
    }

    return filterTasksForView(allTasks, { view });
  }, [allTasks, bounds.endMs, bounds.startMs, projectId, view]);

  const heading = getViewTitle(view, t, projectSlug);
  const summary = isTaskStoreLoading
    ? t("tasks.loading")
    : visibleTasks.length === 0
      ? t("tasks.none")
      : visibleTasks.length === 1
        ? t("tasks.count.one")
        : fillSlot(t("tasks.count.many"), "n", String(visibleTasks.length));

  const persistLocal = (updater: (tasks: LocalTaskRecord[]) => LocalTaskRecord[]) => {
    setLocalTasks((current) => {
      const next = updater(current);
      saveLocalTasks(next);
      return next;
    });
  };

  // One create at a time: a double click (or Enter twice) must not make two tasks.
  const creatingRef = useRef(false);
  // The title as typed, read at submit time. A create clears it before the guard lifts, so a
  // second press that lands before React re-renders sees an empty title, not the old one.
  const titleRef = useRef(draft.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [showTitleHint, setShowTitleHint] = useState(false);

  // The create area is a form: Enter in any of its fields submits, the same as Add task.
  const handleCreate = async () => {
    if (creatingRef.current || !taskStoreReady) return;
    const title = titleRef.current.trim();
    if (!title) {
      setShowTitleHint(true);
      titleInputRef.current?.focus();
      return;
    }
    creatingRef.current = true;
    try {
      await createFromDraft(title);
    } finally {
      creatingRef.current = false;
    }
  };

  const createFromDraft = async (title: string) => {
    // Project view must reuse the filter's projectId — do not re-slugify the
    // display title alone, or URL slug and stored id can diverge.
    const project =
      view === "project" && projectId
        ? { projectId, projectName: projectName ?? draft.projectName }
        : projectForCreate(draft.projectName);
    const dueAt = draft.dueToday ? bounds.endMs - 1 : localEndOfDay(draft.dueDate);
    const checklist = parseChecklistText(draft.checklistText);

    if (usesConvex) {
      const taskId = await createTask({
        title,
        priority: draft.priority,
        energy: draft.energy,
        dueAt,
        projectId: project.projectId,
        projectName: project.projectName,
        checklist,
      });
      if (draft.repeat === "daily" || draft.repeat === "weekly") {
        const cfgId = await createRepeatCfg({
          repeatCycle: draft.repeat === "daily" ? "DAILY" : "WEEKLY",
          repeatEvery: 1,
          // The repeat engine compares weekdays in UTC, so keep the stored
          // value in that same time basis until repeat configs carry a zone.
          weekdays: draft.repeat === "weekly" ? [new Date().getUTCDay()] : [],
          skipOverdue: true,
        });
        await setTaskRepeatCfg({ taskId, repeatCfgId: cfgId });
      }
    } else if (usesLocalStore) {
      const now = Date.now();
      persistLocal((tasks) => [
        {
          id: `local-${crypto.randomUUID()}`,
          title,
          status: "todo",
          priority: draft.priority,
          energy: draft.energy,
          projectId: project.projectId,
          projectName: project.projectName,
          dueAt,
          checklist,
          createdAt: now,
          updatedAt: now,
        },
        ...tasks,
      ]);
    } else {
      return;
    }

    titleRef.current = "";
    setDraft((current) => ({ ...current, title: "", checklistText: "" }));
  };

  const handleToggle = async (task: TaskViewRecord) => {
    if (usesConvex) {
      await toggleCompletion({ taskId: task.id as Id<"tasks"> });
      return;
    }

    if (!usesLocalStore) {
      return;
    }

    persistLocal((tasks) =>
      tasks.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: item.status === "done" ? "todo" : "done",
              updatedAt: Date.now(),
            }
          : item
      )
    );
  };

  const startEditing = (task: TaskViewRecord) => {
    setEditingId(task.id);
  };

  const saveEdit = async (task: TaskViewRecord, update: TaskEditorUpdate) => {
    if (!update.title || !taskStoreReady) return;

    if (usesConvex) {
      await updateTask({ taskId: task.id as Id<"tasks">, ...update });
    } else if (usesLocalStore) {
      persistLocal((tasks) =>
        tasks.map((item) =>
          item.id === task.id
            ? {
                ...item,
                ...update,
                dueAt: update.dueAt ?? undefined,
                checklist: update.checklist ?? undefined,
                updatedAt: Date.now(),
              }
            : item
        )
      );
    } else {
      return;
    }

    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleDelete = async (task: TaskViewRecord) => {
    if (!taskStoreReady) return;
    if (usesConvex) {
      const taskId = task.id as Id<"tasks">;
      const { undoUntilMs } = await removeTask({ taskId });
      setToast(
        deletedTaskToast(t("tasks.deleted"), undoUntilMs, async () => {
          // A false here means the server no longer lets it back; the toast says Undo failed.
          const { success } = await restoreTask({ taskId });
          if (!success) throw new Error("Task not restored");
        })
      );
    } else if (usesLocalStore) {
      const index = localTasks.findIndex((item) => item.id === task.id);
      const removed = localTasks[index];
      persistLocal((tasks) => tasks.filter((item) => item.id !== task.id));
      if (removed) {
        setToast(
          deletedTaskToast(t("tasks.deleted"), Date.now() + UNDO_WINDOW_MS, async () =>
            persistLocal((tasks) => restoreLocalTask(tasks, removed, index))
          )
        );
      }
    }
    setEditingId((current) => (current === task.id ? null : current));
  };

  const handleChecklistToggle = async (task: TaskViewRecord, itemId: string) => {
    if (!task.checklist || !taskStoreReady) {
      return;
    }
    const checklist = toggleChecklistItem(task.checklist, itemId);

    if (usesConvex) {
      await updateTask({ taskId: task.id as Id<"tasks">, checklist });
      return;
    }

    if (!usesLocalStore) {
      return;
    }

    persistLocal((tasks) =>
      tasks.map((item) =>
        item.id === task.id ? { ...item, checklist, updatedAt: Date.now() } : item
      )
    );
  };

  // Any project is "Project": the switcher's one Project link stands for every project slug.
  const isCurrent = (href: string) =>
    view === "project" ? href.startsWith("/projects/") : href === viewHrefs[view];

  const titleHintShown = showTitleHint && !draft.title.trim();

  return (
    <div className="tp-page tp-page--wide tk-screen" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-eyebrow">{t("nav.tasks")}</p>
          <h1 className="tp-pagehead__title" dir="auto">
            {heading}
          </h1>
          <p className="tp-pagehead__sub">{summary}</p>
        </div>
      </header>

      <nav aria-label={t("tasks.views")} className="tk-views">
        <ul className="tp-segmented">
          {viewLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="tp-seg__opt"
                aria-current={isCurrent(link.href) ? "page" : undefined}
              >
                {t(link.label)}
              </Link>
            </li>
          ))}
          {view === "project" && projectSlug ? (
            <li>
              <Link href={`/projects/${projectSlug}/kanban`} className="tp-seg__opt">
                {t("tasks.board")}
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      <form
        className="tp-surface tk-create"
        aria-label={t("tasks.create")}
        data-component="Form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <div className="tk-create__grid">
          <label className="tp-field tk-create__title">
            <span className="tp-label">{t("editor.taskTitle")}</span>
            <input
              ref={titleInputRef}
              aria-label={t("editor.taskTitle")}
              aria-invalid={titleHintShown || undefined}
              aria-describedby={titleHintShown ? "tk-title-hint" : undefined}
              className="tp-input"
              dir="auto"
              autoComplete="off"
              value={draft.title}
              disabled={!taskStoreReady}
              onChange={(event) => {
                const title = event.target.value;
                titleRef.current = title;
                setShowTitleHint(false);
                setDraft((current) => ({ ...current, title }));
              }}
              placeholder={t("tasks.titlePh")}
            />
            {titleHintShown ? (
              <output id="tk-title-hint" className="text-sm text-muted-foreground">
                {t("tasks.titleNeeded")}
              </output>
            ) : null}
          </label>
          <label className="tp-field">
            <span className="tp-label">{t("tasks.project")}</span>
            <input
              aria-label={t("tasks.project")}
              className="tp-input"
              dir="auto"
              value={view === "project" ? (projectName ?? draft.projectName) : draft.projectName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, projectName: event.target.value }))
              }
              disabled={view === "project" || !taskStoreReady}
              placeholder={t("tasks.projectPh")}
            />
          </label>
          <label className="tp-field">
            <span className="tp-label">{t("tasks.priority")}</span>
            <span className="tp-select" data-component="Select">
              <select
                aria-label={t("tasks.priority")}
                className="tp-select__input"
                value={draft.priority}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
              >
                <option value="high">{t("tasks.level.high")}</option>
                <option value="medium">{t("tasks.level.medium")}</option>
                <option value="low">{t("tasks.level.low")}</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          <label className="tp-field">
            <span className="tp-label">{t("tasks.energy")}</span>
            <span className="tp-select" data-component="Select">
              <select
                aria-label={t("tasks.energy")}
                className="tp-select__input"
                value={draft.energy}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    energy: event.target.value as TaskEnergy,
                  }))
                }
              >
                <option value="low">{t("tasks.level.low")}</option>
                <option value="medium">{t("tasks.level.medium")}</option>
                <option value="high">{t("tasks.level.high")}</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          {/* Its aria-label stays a literal: tests/unit/task_repeat.test.ts reads it from this source. */}
          <label className="tp-field">
            <span className="tp-label">{t("tasks.repeat")}</span>
            <span className="tp-select" data-component="Select">
              <select
                aria-label="Repeat"
                className="tp-select__input"
                value={draft.repeat}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    repeat: event.target.value as RepeatDraft,
                  }))
                }
              >
                <option value="none">{t("tasks.repeat.none")}</option>
                <option value="daily">{t("tasks.repeat.daily")}</option>
                <option value="weekly">{t("tasks.repeat.weekly")}</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="tp-btn tp-btn--primary tk-create__add"
            disabled={!taskStoreReady}
          >
            <TpIcon name="plus" size="sm" />
            <span>{t("tasks.add")}</span>
          </button>
        </div>
        <div className="tk-create__more">
          <label className="tp-choice">
            <input
              type="checkbox"
              className="tp-checkbox"
              checked={draft.dueToday}
              disabled={!taskStoreReady}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dueToday: event.target.checked,
                  dueDate: event.target.checked ? "" : current.dueDate,
                }))
              }
            />
            <span className="tp-choice__text">{t("tasks.showOnToday")}</span>
          </label>
          <label className="tp-field">
            <span className="tp-label">{t("tasks.dueDate")}</span>
            <input
              type="date"
              aria-label={t("tasks.dueDate")}
              className="tp-input tp-num"
              value={draft.dueDate}
              disabled={!taskStoreReady}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dueDate: event.target.value,
                  dueToday: false,
                }))
              }
            />
          </label>
        </div>
        {/* Its aria-label stays a literal: tests/unit/task_checklists.test.ts reads it from this source. */}
        <label className="tp-field">
          <span className="tp-label">{t("tasks.checklist")}</span>
          <textarea
            aria-label="Checklist steps"
            className="tp-textarea"
            dir="auto"
            value={draft.checklistText}
            disabled={!taskStoreReady}
            onChange={(event) =>
              setDraft((current) => ({ ...current, checklistText: event.target.value }))
            }
            rows={3}
            placeholder={t("tasks.checklistPh")}
          />
        </label>
      </form>

      {view === "priority" ? (
        <GroupedTaskList
          groups={groupTasksByPriority(visibleTasks)}
          labels={priorityLabels}
          editingId={editingId}
          actionsDisabled={!taskStoreReady}
          onEdit={startEditing}
          onSave={(task, update) => void saveEdit(task, update)}
          onCancelEdit={cancelEdit}
          onDelete={(task) => void handleDelete(task)}
          onToggle={(task) => void handleToggle(task)}
          onChecklistToggle={(task, itemId) => void handleChecklistToggle(task, itemId)}
        />
      ) : view === "energy" ? (
        <GroupedTaskList
          groups={groupTasksByEnergy(visibleTasks)}
          labels={energyLabels}
          editingId={editingId}
          actionsDisabled={!taskStoreReady}
          onEdit={startEditing}
          onSave={(task, update) => void saveEdit(task, update)}
          onCancelEdit={cancelEdit}
          onDelete={(task) => void handleDelete(task)}
          onToggle={(task) => void handleToggle(task)}
          onChecklistToggle={(task, itemId) => void handleChecklistToggle(task, itemId)}
        />
      ) : (
        <TaskList
          tasks={visibleTasks}
          editingId={editingId}
          actionsDisabled={!taskStoreReady}
          onEdit={startEditing}
          onSave={(task, update) => void saveEdit(task, update)}
          onCancelEdit={cancelEdit}
          onDelete={(task) => void handleDelete(task)}
          onToggle={(task) => void handleToggle(task)}
          onChecklistToggle={(task, itemId) => void handleChecklistToggle(task, itemId)}
        />
      )}

      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </div>
  );
}

type TaskListProps = {
  tasks: TaskViewRecord[];
  editingId: string | null;
  actionsDisabled: boolean;
  onEdit: (task: TaskViewRecord) => void;
  onSave: (task: TaskViewRecord, update: TaskEditorUpdate) => void;
  onCancelEdit: () => void;
  onDelete: (task: TaskViewRecord) => void;
  onToggle: (task: TaskViewRecord) => void;
  onChecklistToggle: (task: TaskViewRecord, itemId: string) => void;
};

function TaskList({
  tasks,
  editingId,
  actionsDisabled,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onToggle,
  onChecklistToggle,
}: TaskListProps) {
  const { t } = useLocale();
  if (tasks.length === 0) {
    return (
      <div className="tp-empty tp-surface" data-component="Empty">
        <TpIcon name="leaf" size="lg" />
        <p className="tp-strong">{t("tasks.empty.title")}</p>
        <p>{t("tasks.empty.body")}</p>
      </div>
    );
  }

  return (
    <ul className="tp-block-task tp-surface tk-list" data-component="TaskBlock">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          editing={editingId === task.id}
          actionsDisabled={actionsDisabled}
          onEdit={onEdit}
          onSave={onSave}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          onToggle={onToggle}
          onChecklistToggle={onChecklistToggle}
        />
      ))}
    </ul>
  );
}

type GroupedTaskListProps<TGroup extends string> = Omit<TaskListProps, "tasks"> & {
  groups: Record<TGroup, TaskViewRecord[]>;
  labels: Record<TGroup, MessageKey>;
};

function GroupedTaskList<TGroup extends string>({
  groups,
  labels,
  editingId,
  actionsDisabled,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onToggle,
  onChecklistToggle,
}: GroupedTaskListProps<TGroup>) {
  const { t } = useLocale();
  return (
    <div className="tk-groups">
      {(Object.keys(labels) as TGroup[]).map((group) => (
        <section
          key={group}
          className="tp-section"
          data-component="Section"
          aria-labelledby={`${group}-group-heading`}
        >
          <h2 id={`${group}-group-heading`} className="tp-section__title">
            {t(labels[group])}
          </h2>
          <TaskList
            tasks={groups[group]}
            editingId={editingId}
            actionsDisabled={actionsDisabled}
            onEdit={onEdit}
            onSave={onSave}
            onCancelEdit={onCancelEdit}
            onDelete={onDelete}
            onToggle={onToggle}
            onChecklistToggle={onChecklistToggle}
          />
        </section>
      ))}
    </div>
  );
}

type TaskRowProps = {
  task: TaskViewRecord;
  editing: boolean;
  actionsDisabled: boolean;
  onEdit: (task: TaskViewRecord) => void;
  onSave: (task: TaskViewRecord, update: TaskEditorUpdate) => void;
  onCancelEdit: () => void;
  onDelete: (task: TaskViewRecord) => void;
  onToggle: (task: TaskViewRecord) => void;
  onChecklistToggle: (task: TaskViewRecord, itemId: string) => void;
};

function TaskRow({
  task,
  editing,
  actionsDisabled,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onToggle,
  onChecklistToggle,
}: TaskRowProps) {
  const { t } = useLocale();
  const isDone = task.status === "done";
  const checklistProgress = getChecklistProgress(task.checklist);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  // Set when this editor closes by Save or Cancel: focus goes back to Edit, not to the page.
  const refocusEditRef = useRef(false);

  useEffect(() => {
    if (editing || !refocusEditRef.current) return;
    refocusEditRef.current = false;
    editButtonRef.current?.focus();
  }, [editing]);

  const named =(key: MessageKey) => fillSlot(t(key), "title", task.title);
  // "{n} steps": the count stays a left-to-right number inside the sentence (DESIGN.md §10).
  const [stepsBefore, stepsAfter = ""] = t("tasks.steps").split("{n}");

  return (
    <li className="tp-task-row tk-row" data-component="TaskRow" data-done={isDone}>
      <button
        type="button"
        className="tp-check"
        aria-pressed={isDone}
        disabled={actionsDisabled}
        onClick={() => onToggle(task)}
        aria-label={isDone ? named("tasks.markOpen") : named("tasks.markDone")}
      >
        <span className="tp-check__box">
          <TpIcon name="check" />
        </span>
      </button>
      <div className="tp-task-row__body">
        {editing ? (
          <TaskRowEditor
            key={task.id}
            task={task}
            disabled={actionsDisabled}
            onSave={(update) => {
              refocusEditRef.current = true;
              onSave(task, update);
            }}
            onCancel={() => {
              refocusEditRef.current = true;
              onCancelEdit();
            }}
          />
        ) : (
          <span className="tp-task-row__title" dir="auto">
            {task.title}
          </span>
        )}
        <span className="tp-task-row__meta">
          <span className="tp-chip">
            <TpIcon name="folder" size="sm" />
            <span dir="auto">{task.projectName ?? t("tasks.inbox")}</span>
          </span>
          <span className="tp-chip">
            <TpIcon name="flag" size="sm" />
            <span>{t(priorityChips[task.priority])}</span>
          </span>
          <span className="tp-chip">
            <TpIcon name="energy" size="sm" />
            <span>{t(energyChips[task.energy])}</span>
          </span>
          {checklistProgress.total > 0 ? (
            <span className="tp-checklist__count">
              {stepsBefore}
              <span className="tp-num">
                {checklistProgress.completed}/{checklistProgress.total}
              </span>
              {stepsAfter}
            </span>
          ) : null}
          {isDone ? <span className="tp-chip tp-chip--done">{t("search.status.done")}</span> : null}
        </span>
        {!editing && task.checklist && task.checklist.length > 0 ? (
          <ul className="tp-checklist" aria-label={named("tasks.checklistOf")}>
            {task.checklist.map((item) => (
              <li key={item.id} className="tp-checklist__item">
                <label className="tp-choice">
                  <input
                    type="checkbox"
                    className="tp-checkbox"
                    checked={item.completed}
                    disabled={actionsDisabled}
                    onChange={() => onChecklistToggle(task, item.id)}
                  />
                  <span className="tp-choice__text tp-checklist__text" dir="auto">
                    {item.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="tk-row__actions">
        {!editing ? (
          <button
            ref={editButtonRef}
            type="button"
            className="tp-btn tp-btn--ghost tp-btn--sm"
            disabled={actionsDisabled}
            aria-label={named("tasks.editName")}
            onClick={() => onEdit(task)}
          >
            <TpIcon name="edit" size="sm" />
            <span>{t("tasks.edit")}</span>
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            "tp-btn tp-btn--sm",
            confirmingDelete ? "tp-btn--danger" : "tp-btn--danger-ghost",
          )}
          disabled={actionsDisabled}
          aria-label={named(confirmingDelete ? "tasks.confirmDeleteName" : "tasks.deleteName")}
          onClick={() => {
            if (confirmingDelete) {
              onDelete(task);
            } else {
              setConfirmingDelete(true);
            }
          }}
        >
          {t(confirmingDelete ? "tasks.confirmDelete" : "tasks.delete")}
        </button>
      </div>
    </li>
  );
}
