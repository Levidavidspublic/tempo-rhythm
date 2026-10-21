"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FocusEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  InlineAdd,
  makeToast,
  OfflineNotice,
  ScreenBoundary,
  SignedOutState,
  StateEmpty,
  StateError,
  StateLoading,
  StatusBadge,
  type ToastState,
  UndoToast,
  useOnline,
  useSignedIn,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  dayLabel,
  isNewProjectId,
  minutesFromEstimate,
  orderProjectTasks,
  projectNameFor,
  projectStatusFor,
} from "@/lib/goals-projects";
import { projectIdFromSlug } from "@/lib/taskKanban";
import { titleFromProjectSlug } from "@/lib/task-view-filters";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

/**
 * True when `next` names a new project that has no task yet. The name lives on a project's tasks,
 * so nothing can keep it until the first task is added.
 */
export function waitsForFirstTask(projectId: string, taskCount: number, next: string, name: string): boolean {
  return taskCount === 0 && isNewProjectId(projectId) && next !== "" && next !== name;
}

/**
 * Project page (docs/design/v3/screens/web/project-detail.html): the project's name, status and
 * tasks on a paper page, with "Open board" for the same tasks as columns. A project is the tasks
 * that share a projectId, so the design's why, due date, goals checklist, linked pages and
 * "Linked here" (which need a project page or record) are left out.
 */
export function ProjectDetailScreen({ projectSlug }: { projectSlug: string }) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <Paper>
          <StateError title={t("pd.error")} onRetry={retry} />
        </Paper>
      )}
    >
      <ProjectDetailContent projectId={projectIdFromSlug(projectSlug)} />
    </ScreenBoundary>
  );
}

/** The paper page; `titled` when it holds the page-title heading that names it. */
function Paper({ children, titled = false }: { children: ReactNode; titled?: boolean }) {
  return (
    <article className="tp-paper" data-component="Page" aria-labelledby={titled ? "page-title" : undefined}>
      <div className="tp-page-cover" data-component="PageCover" aria-hidden="true" />
      <div className="tp-page__body">
        <div className="tp-page-icon" data-component="PageIcon" aria-hidden="true">
          <TpIcon name="folder" />
        </div>
        {children}
      </div>
    </article>
  );
}

type ProjectTaskDoc = Doc<"tasks">;

function ProjectDetailContent({ projectId }: { projectId: string }) {
  const { t, lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const bounds = useLocalDayBounds();
  const args = { projectId };
  const tasks = useQuery(api.tasks.list, signedIn === "ready" ? args : "skip");
  const createTask = useMutation(api.tasks.create);
  const removeTask = useMutation(api.tasks.remove);
  const updateTask = useMutation(api.tasks.update);
  const renameProject = useMutation(api.tasks.renameProject);
  const toggleCompletion = useMutation(api.tasks.toggleCompletion).withOptimisticUpdate((store, { taskId }) => {
    const rows = store.getQuery(api.tasks.list, args);
    if (!rows) return;
    store.setQuery(
      api.tasks.list,
      args,
      rows.map((row) =>
        row._id === taskId ? { ...row, status: (row.status === "done" ? "todo" : "done") as "todo" | "done" } : row,
      ),
    );
  });
  const [adding, setAdding] = useState(false);
  // A new project was named before it had a task: the page says it is kept once it has one.
  const [namedNew, setNamedNew] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);

  const rows = (tasks ?? []) as ProjectTaskDoc[];
  const ordered = orderProjectTasks(rows);
  const done = ordered.filter((task) => task.status === "done").length;
  const open = ordered.length - done;
  const storedName = rows.length > 0 ? projectNameFor(rows, projectId) : null;
  const fallbackName = isNewProjectId(projectId) ? t("pj.draft") : titleFromProjectSlug(projectId);
  const name = storedName ?? fallbackName;

  const [title, setTitle] = useState(name);
  const titleFocused = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!titleFocused.current) setTitle(name);
  }, [name]);
  // A project started from "New project" opens with its name selected, ready to type over.
  const fresh = isNewProjectId(projectId) && tasks !== undefined && tasks.length === 0;
  useEffect(() => {
    if (!fresh) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [fresh]);

  if (signedIn === "signedOut") {
    return (
      <Paper>
        <SignedOutState />
      </Paper>
    );
  }
  if (tasks === undefined) {
    return (
      <Paper>
        <StateLoading label={t("pd.loading")} lead="line" rows={3} />
      </Paper>
    );
  }

  const projectName = title.trim() || name;

  const rename = (event: FocusEvent<HTMLInputElement>) => {
    titleFocused.current = false;
    const next = title.trim();
    if (!next) {
      setTitle(name);
      return;
    }
    if (waitsForFirstTask(projectId, rows.length, next, name)) {
      // Opening the first-task field focuses it. One already open takes focus only when the name
      // was left with Enter, not when the person moved somewhere else.
      setNamedNew(true);
      if (adding && event.relatedTarget === null) document.getElementById("pd-add")?.focus();
      setAdding(true);
      return;
    }
    if (next === name || rows.length === 0) return;
    // The name lives on each of the project's tasks; one mutation renames them all together.
    renameProject({ projectId, name: next }).then(
      () => setError(false),
      () => setError(true),
    );
  };

  const addTask = async (value: string) => {
    const taskId = await createTask({ title: value, projectId, projectName });
    setToast(makeToast(t("pd.task.added"), () => removeTask({ taskId })));
  };

  const toggle = (task: ProjectTaskDoc) => {
    const wasDone = task.status === "done";
    // Undo puts back the status the task had (an in-progress task returns to in progress, not
    // to todo), rather than toggling again.
    const before = task.status;
    // Completing a repeating task also makes its next one, which this Undo could not take back,
    // so that case gets no Undo rather than a partial one.
    const canUndo = wasDone || task.repeatCfgId === undefined;
    toggleCompletion({ taskId: task._id }).then(
      () => {
        setError(false);
        setToast(
          makeToast(
            t(wasDone ? "pd.task.reopened" : "pd.task.done"),
            canUndo ? () => updateTask({ taskId: task._id, status: before }) : undefined,
          ),
        );
      },
      () => setError(true),
    );
  };

  const addRow = adding ? (
    <InlineAdd id="pd-add" label={t("pd.task.label")} onSubmit={addTask} onCancel={() => setAdding(false)} />
  ) : null;

  return (
    <>
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      <Paper titled>
        <div className="tp-page-head" data-variant="project" data-component="PageHead">
          <div className="tp-page-head__row">
            <h1 className="tp-page-title" id="page-title">
              <input
                ref={titleRef}
                className="gx-title-input"
                aria-label={t("pd.titleLabel")}
                dir="auto"
                value={title}
                onFocus={() => {
                  titleFocused.current = true;
                }}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={rename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </h1>
            {/* The name lives on the project's tasks, so the board opens once there is one to carry it. */}
            {rows.length > 0 ? (
              <div className="tp-page-head__actions">
                <Link
                  className="tp-btn tp-btn--secondary"
                  href={`/projects/${encodeURIComponent(projectId)}/kanban`}
                  data-component="Button"
                >
                  <TpIcon name="kanban" size="sm" />
                  <span>{t("pd.board")}</span>
                </Link>
              </div>
            ) : null}
          </div>
          <div className="tp-page-meta" data-component="PageMeta">
            <StatusBadge kind="project" status={projectStatusFor(done, ordered.length)} />
          </div>
        </div>

        {namedNew && rows.length === 0 ? (
          <p className="tp-help">
            <output>{t("pd.keptHint")}</output>
          </p>
        ) : null}

        {error ? (
          <p className="tp-notice" data-tone="caution" role="alert">
            <span className="tp-notice__text">{t("gx.saveError")}</span>
          </p>
        ) : null}

        {ordered.length === 0 && !adding ? (
          <StateEmpty
            icon="folder"
            title={t("pd.empty.title")}
            body={t("pd.empty.body")}
            action={
              <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setAdding(true)}>
                <TpIcon name="plus" size="sm" />
                <span>{t("pd.empty.add")}</span>
              </button>
            }
          />
        ) : (
          <div className="tp-page-content pd-stack">
            <section className="tp-section tp-block" aria-labelledby="tasks-h">
              <div className="tp-section__head">
                <h2 className="tp-section__title" id="tasks-h">
                  {t("pd.tasks.h")}
                </h2>
                <span className="tp-section__count">
                  <span className="tp-num">{open}</span> <span>{t("pd.tasks.open")}</span>
                </span>
              </div>
              {ordered.length > 0 ? (
                <ul className="tp-block-task" data-component="TaskBlock">
                  {ordered.map((task) => (
                    <TaskRow
                      key={task._id}
                      task={task}
                      lang={lang}
                      todayStartMs={bounds.startMs}
                      todayEndMs={bounds.endMs}
                      onToggle={() => toggle(task)}
                    />
                  ))}
                </ul>
              ) : null}
              {addRow ?? (
                <button className="tp-btn tp-btn--ghost" type="button" onClick={() => setAdding(true)}>
                  <TpIcon name="plus" size="sm" />
                  <span>{t("pd.tasks.add")}</span>
                </button>
              )}
            </section>
          </div>
        )}
      </Paper>
      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </>
  );
}

function TaskRow({
  task,
  lang,
  todayStartMs,
  todayEndMs,
  onToggle,
}: {
  task: ProjectTaskDoc;
  lang: "en" | "he";
  todayStartMs: number;
  todayEndMs: number;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const done = task.status === "done";
  const titleId = `task-${task._id}-title`;
  const minutes = minutesFromEstimate(task.timeEstimate);
  const day = task.dueAt === undefined ? null : dayLabel(task.dueAt, todayStartMs, todayEndMs, lang);
  return (
    <li className="tp-task-row" data-component="TaskRow" data-done={done ? "true" : undefined}>
      {/* biome-ignore lint/a11y/useSemanticElements: the v3 TaskRow check is a button with checkbox semantics (tp-check) */}
      <button
        className="tp-check"
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-labelledby={titleId}
        onClick={onToggle}
      >
        <span className="tp-check__box">
          <TpIcon name="check" />
        </span>
      </button>
      <div className="tp-task-row__body">
        <span className="tp-task-row__title" id={titleId} dir="auto">
          {task.title}
        </span>
        {!done && (minutes !== null || day) ? (
          <span className="tp-task-row__meta">
            {minutes !== null ? (
              <span>
                <span className="tp-num">{minutes}</span> <span>{t("gx.min")}</span>
              </span>
            ) : null}
            {day ? (
              day.kind === "today" ? (
                <span>{t("gx.today")}</span>
              ) : (
                <span>
                  <span>{day.weekday}</span> <span className="tp-num">{day.day}</span>
                </span>
              )
            ) : null}
          </span>
        ) : null}
      </div>
    </li>
  );
}
