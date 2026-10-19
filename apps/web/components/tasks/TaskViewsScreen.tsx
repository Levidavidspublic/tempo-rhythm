"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TaskRowEditor, type TaskEditorUpdate } from "@/components/tasks/TaskRowEditor";
import { TpIcon } from "@/components/tempo/TpIcon";
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

const viewHrefs: Record<Exclude<TaskView, "project">, string> = {
  today: "/today",
  inbox: "/tasks",
  priority: "/tasks/priority",
  energy: "/tasks/energy",
  checklists: "/tasks/checklists",
};

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

  // One create at a time: a double click (or Enter twice) must not make two tasks.
  const creatingRef = useRef(false);
  const [showTitleHint, setShowTitleHint] = useState(false);

  const handleCreate = async () => {
    if (creatingRef.current || !taskStoreReady) return;
    const title = draft.title.trim();
    if (!title) {
      setShowTitleHint(true);
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

  // Any project is "Project": the switcher's one Project link stands for every project slug.
  const isCurrent = (href: string) =>
    view === "project" ? href.startsWith("/projects/") : href === viewHrefs[view];

  return (
    <div className="tp-page tp-page--wide tk-screen" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-eyebrow">Tasks</p>
          <h1 className="tp-pagehead__title" dir="auto">
            {heading}
          </h1>
          <p className="tp-pagehead__sub">{summary}</p>
        </div>
      </header>

      <nav aria-label="Task views" className="tk-views">
        <ul className="tp-segmented">
          {viewLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="tp-seg__opt"
                aria-current={isCurrent(link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
          {view === "project" && projectSlug ? (
            <li>
              <Link href={`/projects/${projectSlug}/kanban`} className="tp-seg__opt">
                Board
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      <section className="tp-surface tk-create" aria-label="Create task" data-component="Form">
        <div className="tk-create__grid">
          <label className="tp-field tk-create__title">
            <span className="tp-label">Task title</span>
            <input
              aria-label="Task title"
              className="tp-input"
              dir="auto"
              autoComplete="off"
              value={draft.title}
              disabled={!taskStoreReady}
              onChange={(event) => {
                setShowTitleHint(false);
                setDraft((current) => ({ ...current, title: event.target.value }));
              }}
              placeholder="One small next step"
            />
            {showTitleHint && !draft.title.trim() ? (
              <output className="text-sm text-muted-foreground">
                Type a short task name first.
              </output>
            ) : null}
          </label>
          <label className="tp-field">
            <span className="tp-label">Project</span>
            <input
              aria-label="Project"
              className="tp-input"
              dir="auto"
              value={view === "project" ? (projectName ?? draft.projectName) : draft.projectName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, projectName: event.target.value }))
              }
              disabled={view === "project" || !taskStoreReady}
            />
          </label>
          <label className="tp-field">
            <span className="tp-label">Priority</span>
            <span className="tp-select" data-component="Select">
              <select
                aria-label="Priority"
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
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          <label className="tp-field">
            <span className="tp-label">Energy</span>
            <span className="tp-select" data-component="Select">
              <select
                aria-label="Energy"
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          <label className="tp-field">
            <span className="tp-label">Repeat</span>
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
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
              <span className="tp-select__icon">
                <TpIcon name="down" size="sm" />
              </span>
            </span>
          </label>
          <button
            type="button"
            className="tp-btn tp-btn--primary tk-create__add"
            disabled={!taskStoreReady}
            onClick={() => void handleCreate()}
          >
            <TpIcon name="plus" size="sm" />
            <span>Add task</span>
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
            <span className="tp-choice__text">Show on Today</span>
          </label>
          <label className="tp-field">
            <span className="tp-label">Due date</span>
            <input
              type="date"
              aria-label="Due date"
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
        <label className="tp-field">
          <span className="tp-label">Checklist (one step per line)</span>
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
      <div className="tp-empty tp-surface" data-component="Empty">
        <TpIcon name="leaf" size="lg" />
        <p className="tp-strong">This view is clear.</p>
        <p>Add one tiny task when you are ready.</p>
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
    <div className="tk-groups">
      {(Object.keys(labels) as TGroup[]).map((group) => (
        <section
          key={group}
          className="tp-section"
          data-component="Section"
          aria-labelledby={`${group}-group-heading`}
        >
          <h2 id={`${group}-group-heading`} className="tp-section__title">
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
    <li className="tp-task-row tk-row" data-component="TaskRow" data-done={isDone}>
      <button
        type="button"
        className="tp-check"
        aria-pressed={isDone}
        disabled={actionsDisabled}
        onClick={() => onToggle(task)}
        aria-label={isDone ? `Mark ${task.title} not done` : `Mark ${task.title} complete`}
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
            onSave={(update) => onSave(task, update)}
          />
        ) : (
          <span className="tp-task-row__title" dir="auto">
            {task.title}
          </span>
        )}
        <span className="tp-task-row__meta">
          <span className="tp-chip">
            <TpIcon name="folder" size="sm" />
            <span dir="auto">{task.projectName ?? "Inbox"}</span>
          </span>
          <span className="tp-chip">
            <TpIcon name="flag" size="sm" />
            <span>{task.priority} priority</span>
          </span>
          <span className="tp-chip">
            <TpIcon name="energy" size="sm" />
            <span>{task.energy} energy</span>
          </span>
          {checklistProgress.total > 0 ? (
            <span className="tp-checklist__count tp-num">
              {checklistProgress.completed}/{checklistProgress.total} steps
            </span>
          ) : null}
          {isDone ? <span className="tp-chip tp-chip--done">Done</span> : null}
        </span>
        {!editing && task.checklist && task.checklist.length > 0 ? (
          <ul className="tp-checklist" aria-label={`${task.title} checklist`}>
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
            type="button"
            className="tp-btn tp-btn--ghost tp-btn--sm"
            disabled={actionsDisabled}
            aria-label={`Edit ${task.title}`}
            onClick={() => onEdit(task)}
          >
            <TpIcon name="edit" size="sm" />
            <span>Edit</span>
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            "tp-btn tp-btn--sm",
            confirmingDelete ? "tp-btn--danger" : "tp-btn--danger-ghost",
          )}
          disabled={actionsDisabled}
          aria-label={confirmingDelete ? `Confirm delete ${task.title}` : `Delete ${task.title}`}
          onClick={() => {
            if (confirmingDelete) {
              onDelete(task);
            } else {
              setConfirmingDelete(true);
            }
          }}
        >
          {confirmingDelete ? "Confirm delete" : "Delete"}
        </button>
      </div>
    </li>
  );
}
