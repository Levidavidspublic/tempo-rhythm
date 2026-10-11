"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskRowEditor, type TaskEditorUpdate } from "@/components/tasks/TaskRowEditor";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getChecklistProgress,
  parseChecklistText,
  toggleChecklistItem,
} from "@/convex/lib/taskChecklists";
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

const viewLinks = [
  { href: "/today", label: "Today" },
  { href: "/tasks", label: "Inbox" },
  { href: "/projects/home-reset", label: "Project" },
  { href: "/tasks/priority", label: "Priority" },
  { href: "/tasks/energy", label: "Energy" },
  { href: "/tasks/checklists", label: "Checklists" },
] as const;

const defaultDraft: Draft = {
  title: "",
  projectName: "Home reset",
  priority: "medium",
  energy: "medium",
  dueToday: false,
  dueDate: "",
  repeat: "none",
  checklistText: "",
};

const allowLocalTaskViews =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

const priorityLabels: Record<TaskPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

const energyLabels: Record<TaskEnergy, string> = {
  low: "Low energy",
  medium: "Medium energy",
  high: "High energy",
};

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

function getViewTitle(view: TaskView, projectSlug?: string): string {
  if (view === "today") return "Today";
  if (view === "inbox") return "Inbox";
  if (view === "priority") return "Priority";
  if (view === "energy") return "Energy";
  if (view === "checklists") return "Checklists";
  return titleFromProjectSlug(projectSlug ?? "project");
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
  const bounds = useLocalDayBounds();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convexTasks = useQuery(api.tasks.list, isAuthenticated ? {} : "skip");
  const createTask = useMutation(api.tasks.create);
  const createRepeatCfg = useMutation(api.tasks.createRepeatCfg);
  const setTaskRepeatCfg = useMutation(api.tasks.setTaskRepeatCfg);
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const [localTasks, setLocalTasks] = useState<LocalTaskRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...defaultDraft,
    dueToday: view === "today",
    projectName: view === "project" ? getViewTitle(view, projectSlug) : defaultDraft.projectName,
  }));
  const [editingId, setEditingId] = useState<string | null>(null);

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
  const projectName = view === "project" ? getViewTitle(view, projectSlug) : undefined;
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

  const heading = getViewTitle(view, projectSlug);
  const summary = isTaskStoreLoading
    ? "Loading your task view."
    : visibleTasks.length === 0
      ? "Nothing here yet. A small next step is enough."
      : `${visibleTasks.length} ${visibleTasks.length === 1 ? "task" : "tasks"} in this view.`;

  const persistLocal = (updater: (tasks: LocalTaskRecord[]) => LocalTaskRecord[]) => {
    setLocalTasks((current) => {
      const next = updater(current);
      saveLocalTasks(next);
      return next;
    });
  };

  const handleCreate = async () => {
    const title = draft.title.trim();
    if (!title || !taskStoreReady) return;

    const normalizedProjectName =
      view === "project" ? (projectName ?? draft.projectName) : draft.projectName.trim();
    // Project view must reuse the filter's projectId — do not re-slugify the
    // display title alone, or URL slug and stored id can diverge.
    const normalizedProjectId =
      view === "project" && projectId ? projectId : slugifyProjectName(normalizedProjectName);
    const dueAt = draft.dueToday ? bounds.endMs - 1 : localEndOfDay(draft.dueDate);
    const checklist = parseChecklistText(draft.checklistText);

    if (usesConvex) {
      const taskId = await createTask({
        title,
        priority: draft.priority,
        energy: draft.energy,
        dueAt,
        projectId: normalizedProjectId,
        projectName: normalizedProjectName,
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
          projectId: normalizedProjectId,
          projectName: normalizedProjectName,
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

  const handleDelete = async (task: TaskViewRecord) => {
    if (!taskStoreReady) return;
    if (usesConvex) {
      await removeTask({ taskId: task.id as Id<"tasks"> });
    } else if (usesLocalStore) {
      persistLocal((tasks) => tasks.filter((item) => item.id !== task.id));
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

  return (
    <div className="container mx-auto max-w-6xl px-6 py-12">
      <div className="space-y-8">
        <header className="space-y-4">
          <div>
            <p className="font-eyebrow text-muted-foreground">Core task views</p>
            <h1 className="font-heading text-4xl font-semibold text-foreground">{heading}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{summary}</p>
          </div>
          <nav aria-label="Task views" className="flex flex-wrap gap-2">
            {viewLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-pill border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-sunken"
              >
                {link.label}
              </Link>
            ))}
            {view === "project" && projectSlug ? (
              <Link
                href={`/projects/${projectSlug}/kanban`}
                className="rounded-pill border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-sunken"
              >
                Board
              </Link>
            ) : null}
          </nav>
        </header>

        <section
          className="rounded-3xl border border-border bg-card p-5 shadow-card"
          aria-label="Create task"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_150px_150px_150px_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Task title</span>
              <input
                aria-label="Task title"
                value={draft.title}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="One small next step"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Project</span>
              <input
                aria-label="Project"
                value={view === "project" ? (projectName ?? draft.projectName) : draft.projectName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, projectName: event.target.value }))
                }
                disabled={view === "project" || !taskStoreReady}
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Priority</span>
              <select
                aria-label="Priority"
                value={draft.priority}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    priority: event.target.value as TaskPriority,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Energy</span>
              <select
                aria-label="Energy"
                value={draft.energy}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    energy: event.target.value as TaskEnergy,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Repeat</span>
              <select
                aria-label="Repeat"
                value={draft.repeat}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    repeat: event.target.value as RepeatDraft,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </label>
            <Button
              type="button"
              disabled={!taskStoreReady || !draft.title.trim()}
              onClick={() => void handleCreate()}
              className="min-h-11"
            >
              Add task
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.dueToday}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dueToday: event.target.checked,
                    dueDate: event.target.checked ? "" : current.dueDate,
                  }))
                }
                className="h-4 w-4 rounded border-border text-primary"
              />
              Show on Today
            </label>
            <label className="space-y-2">
              <span className="block text-sm font-medium text-foreground">Due date</span>
              <input
                type="date"
                aria-label="Due date"
                value={draft.dueDate}
                disabled={!taskStoreReady}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    dueDate: event.target.value,
                    dueToday: false,
                  }))
                }
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              />
            </label>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-foreground">
              Checklist (one step per line)
            </span>
            <textarea
              aria-label="Checklist steps"
              value={draft.checklistText}
              disabled={!taskStoreReady}
              onChange={(event) =>
                setDraft((current) => ({ ...current, checklistText: event.target.value }))
              }
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              placeholder="Unpack the bag&#10;Put the kettle on"
            />
          </label>
        </section>

        {view === "priority" ? (
          <GroupedTaskList
            groups={groupTasksByPriority(visibleTasks)}
            labels={priorityLabels}
            editingId={editingId}
            actionsDisabled={!taskStoreReady}
            onEdit={startEditing}
            onSave={(task, update) => void saveEdit(task, update)}
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
            onDelete={(task) => void handleDelete(task)}
            onToggle={(task) => void handleToggle(task)}
            onChecklistToggle={(task, itemId) => void handleChecklistToggle(task, itemId)}
          />
        )}
      </div>
    </div>
  );
}

type TaskListProps = {
  tasks: TaskViewRecord[];
  editingId: string | null;
  actionsDisabled: boolean;
  onEdit: (task: TaskViewRecord) => void;
  onSave: (task: TaskViewRecord, update: TaskEditorUpdate) => void;
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
  onDelete,
  onToggle,
  onChecklistToggle,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card/70 px-6 py-12 text-center">
        <p className="text-lg font-medium text-foreground">This view is clear.</p>
        <p className="mt-2 text-sm text-muted-foreground">Add one tiny task when you are ready.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          editing={editingId === task.id}
          actionsDisabled={actionsDisabled}
          onEdit={onEdit}
          onSave={onSave}
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
  labels: Record<TGroup, string>;
};

function GroupedTaskList<TGroup extends string>({
  groups,
  labels,
  editingId,
  actionsDisabled,
  onEdit,
  onSave,
  onDelete,
  onToggle,
  onChecklistToggle,
}: GroupedTaskListProps<TGroup>) {
  return (
    <div className="space-y-6">
      {(Object.keys(labels) as TGroup[]).map((group) => (
        <section key={group} className="space-y-3" aria-labelledby={`${group}-group-heading`}>
          <h2
            id={`${group}-group-heading`}
            className="font-heading text-2xl font-semibold text-foreground"
          >
            {labels[group]}
          </h2>
          <TaskList
            tasks={groups[group]}
            editingId={editingId}
            actionsDisabled={actionsDisabled}
            onEdit={onEdit}
            onSave={onSave}
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
  onDelete,
  onToggle,
  onChecklistToggle,
}: TaskRowProps) {
  const isDone = task.status === "done";
  const checklistProgress = getChecklistProgress(task.checklist);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card",
        isDone ? "opacity-80" : "opacity-100"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button
          type="button"
          disabled={actionsDisabled}
          onClick={() => onToggle(task)}
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center rounded-full border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background"
          )}
          aria-label={isDone ? `Mark ${task.title} not done` : `Mark ${task.title} complete`}
        >
          {isDone ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          {editing ? (
            <TaskRowEditor
              key={task.id}
              task={task}
              disabled={actionsDisabled}
              onSave={(update) => onSave(task, update)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-lg font-medium text-foreground", isDone && "line-through")}>
                {task.title}
              </p>
              {isDone ? (
                <span className="rounded-pill bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Done
                </span>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <span className="rounded-pill bg-surface-sunken px-3 py-1">
              {task.projectName ?? "Inbox"}
            </span>
            <span className="rounded-pill bg-surface-sunken px-3 py-1">
              {task.priority} priority
            </span>
            <span className="rounded-pill bg-surface-sunken px-3 py-1">{task.energy} energy</span>
            {checklistProgress.total > 0 ? (
              <span className="rounded-pill bg-surface-sunken px-3 py-1">
                {checklistProgress.completed}/{checklistProgress.total} steps
              </span>
            ) : null}
          </div>
          {!editing && task.checklist && task.checklist.length > 0 ? (
            <ul className="space-y-2 pt-1" aria-label={`${task.title} checklist`}>
              {task.checklist.map((item) => (
                <li key={item.id}>
                  <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={actionsDisabled}
                      onChange={() => onChecklistToggle(task, item.id)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    <span className={cn(item.completed && "text-muted-foreground line-through")}>
                      {item.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              disabled={actionsDisabled}
              aria-label={`Edit ${task.title}`}
              onClick={() => onEdit(task)}
            >
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={actionsDisabled}
            aria-label={
              confirmingDelete ? `Confirm delete ${task.title}` : `Delete ${task.title}`
            }
            onClick={() => {
              if (confirmingDelete) {
                onDelete(task);
              } else {
                setConfirmingDelete(true);
              }
            }}
          >
            {confirmingDelete ? "Confirm delete" : "Delete"}
          </Button>
        </div>
      </div>
    </li>
  );
}
