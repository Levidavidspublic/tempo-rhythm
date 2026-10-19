"use client";

import "@/app/v3/kb-09.css";
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
import { kb09t } from "@/lib/i18n-groups/kb-09";

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
    <article className="tp-paper kb09-project" data-component="Page" aria-labelledby={titled ? "page-title" : undefined}>
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
  const [renameState, setRenameState] = useState<"idle" | "pending" | "saved" | "error">("idle");
  const closeToast = useCallback(() => setToast(null), []);
  const addButtonRef = useRef<HTMLButtonElement>(null);

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
  const renameRevision = useRef(0);
  const renameDraft = useRef<string | null>(null);
  useEffect(() => {
    if (!titleFocused.current && (renameDraft.current === null || renameDraft.current === name)) {
      setTitle(name);
      renameDraft.current = null;
    }
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
      renameDraft.current = null;
      setTitle(name);
      return;
    }
    if (waitsForFirstTask(projectId, rows.length, next, name)) {
      // Opening the first-task field focuses it. One already open takes focus only when the name
      // was left with Enter, not when the person moved somewhere else.
      setNamedNew(true);
      setRenameState("idle");
      if (adding && event.relatedTarget === null) document.getElementById("pd-add")?.focus();
      setAdding(true);
      return;
    }
    if (next === name || rows.length === 0) {
      if (next === name) renameDraft.current = null;
      return;
    }
    // The name lives on each of the project's tasks; one mutation renames them all together.
    const revision = ++renameRevision.current;
    setRenameState("pending");
    renameProject({ projectId, name: next }).then(
      () => {
        if (revision !== renameRevision.current) return;
        setError(false);
        setRenameState("saved");
      },
      () => {
        if (revision !== renameRevision.current) return;
        setError(true);
        setRenameState("error");
      },
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
    <InlineAdd id="pd-add" label={t("pd.task.label")} onSubmit={addTask} onCancel={() => {
      setAdding(false);
      requestAnimationFrame(() => addButtonRef.current?.focus());
    }} />
  ) : null;

  return (
    <>
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      <Paper titled>
        <div className="tp-page-head" data-variant="project" data-component="PageHead">
          <div className="tp-page-head__row">
            <h1 className="tp-page-title kb09-title-field" id="page-title">
              <input
                ref={titleRef}
                className="gx-title-input"
                aria-label={t("pd.titleLabel")}
                aria-describedby={renameState !== "idle" ? "kb09-rename-notice" : namedNew ? "kb09-first-task-notice" : undefined}
                aria-invalid={renameState === "error" || undefined}
                aria-busy={renameState === "pending"}
                dir="auto"
                value={title}
                onFocus={() => {
                  titleFocused.current = true;
                }}
                onChange={(event) => {
                  renameRevision.current += 1;
                  renameDraft.current = event.target.value;
                  setTitle(event.target.value);
                  setRenameState("idle");
                  setError(false);
                }}
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

        <ProjectDetailNotice id="kb09-rename-notice" kind={renameState} lang={lang} />
        {namedNew && rows.length === 0 ? <ProjectDetailNotice id="kb09-first-task-notice" kind="firstTask" lang={lang} /> : null}

        {error && renameState !== "error" ? (
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
              <button ref={addButtonRef} className="tp-btn tp-btn--secondary" type="button" onClick={() => setAdding(true)}>
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
                <button ref={addButtonRef} className="tp-btn tp-btn--ghost" type="button" onClick={() => setAdding(true)}>
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
    <li className="tp-task-row kb09-task-row" data-component="TaskRow" data-done={done ? "true" : undefined}>
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
      <ProjectTaskActions title={task.title} done={done} lang={lang} onToggle={onToggle} />
    </li>
  );
}

/** The same completion control is used by the mounted task row and the isolated gallery. */
export function ProjectTaskActions({
  title,
  done,
  lang,
  onToggle,
  disabled = false,
}: Readonly<{
  title: string;
  done: boolean;
  lang: "en" | "he";
  onToggle: () => void;
  disabled?: boolean;
}>) {
  return (
    <div className="kb09-task-actions" data-component="ProjectTaskActions">
      {/* biome-ignore lint/a11y/useSemanticElements: v3 task completion uses a button with checkbox semantics */}
      <button
        className="kb09-task-actions__toggle"
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={kb09t(lang, done ? "task.reopenNamed" : "task.completeNamed", { title })}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="kb09-task-actions__box" aria-hidden="true">{done ? <TpIcon name="check" size="sm" /> : null}</span>
        <span className="kb09-task-actions__text">{kb09t(lang, done ? "task.reopen" : "task.complete")}</span>
      </button>
    </div>
  );
}

export function ProjectDetailNotice({
  id,
  kind,
  lang,
}: Readonly<{ id?: string; kind: "idle" | "pending" | "saved" | "error" | "firstTask"; lang: "en" | "he" }>) {
  if (kind === "idle") return null;
  const key = kind === "firstTask" ? "firstTask" : (`rename.${kind}` as const);
  return (
    <p className="kb09-notice" data-component="ProjectDetailNotice" data-kind={kind} id={id} role={kind === "error" ? "alert" : "status"}>
      {kb09t(lang, key)}
    </p>
  );
}

/** Controlled, fictional browser fixture. It imports no backend data and never writes to a route. */
export function Kb09Gallery({ lang = "en" }: { lang?: "en" | "he" }) {
  type View = "default" | "empty" | "loading" | "error" | "disabled" | "overflow";
  const [view, setView] = useState<View>("default");
  const [title, setTitle] = useState(kb09t(lang, "gallery.initialProject"));
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<"idle" | "pending" | "saved" | "error" | "firstTask">("idle");
  const [tasks, setTasks] = useState<string[]>([kb09t(lang, "gallery.initialTask")]);
  const addButton = useRef<HTMLButtonElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (adding) draftInput.current?.focus();
  }, [adding]);
  const views: View[] = ["default", "empty", "loading", "error", "disabled", "overflow"];
  const shownTitle = view === "overflow" ? `${title} — ${kb09t(lang, "gallery.longText").repeat(12)}` : title;
  return (
    <main className="kb09-project" lang={lang} dir={lang === "he" ? "rtl" : "ltr"}>
      <div className="kb09-gallery">
        <h1 className="tp-page-title">{kb09t(lang, "gallery.title")}</h1>
        <fieldset className="kb09-gallery__states">
          <legend>{kb09t(lang, "gallery.state")}</legend>
          {views.map((item) => (
            <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)}>
              {kb09t(lang, `gallery.${item}`)}
            </button>
          ))}
        </fieldset>
        <label className="tp-field kb09-title-field">
          <span>{kb09t(lang, "gallery.projectLabel")}</span>
          <input
            className="tp-input"
            dir="auto"
            value={shownTitle}
            aria-describedby={notice !== "idle" ? "kb09-gallery-notice" : undefined}
            aria-invalid={notice === "error" || undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setNotice("idle");
            }}
            onBlur={() => setNotice("saved")}
          />
        </label>
        <ProjectDetailNotice id="kb09-gallery-notice" lang={lang} kind={notice} />
        {view === "loading" ? <output>{kb09t(lang, "gallery.loadingText")}</output> : null}
        {view === "error" ? (
          <div role="alert">
            <p>{kb09t(lang, "gallery.errorText")}</p>
            <button type="button" onClick={() => setView("default")}>{kb09t(lang, "gallery.retry")}</button>
          </div>
        ) : null}
        {view === "empty" ? <p>{kb09t(lang, "gallery.emptyText")}</p> : null}
        {view === "default" || view === "disabled" || view === "overflow" ? (
          <ul className="tp-block-task">
            {tasks.map((task, index) => (
              <li className="tp-task-row kb09-task-row" key={`${task}-${index}`}>
                <span className="tp-task-row__title" dir="auto">{view === "overflow" ? `${task} ${kb09t(lang, "gallery.longText").repeat(12)}` : task}</span>
                <ProjectTaskActions title={task} done={done} lang={lang} onToggle={() => setDone(!done)} disabled={view === "disabled"} />
              </li>
            ))}
          </ul>
        ) : null}
        {adding ? (
          <form className="kb09-gallery__form" onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            setTasks([...tasks, draft.trim()]);
            setDraft("");
            setAdding(false);
            requestAnimationFrame(() => addButton.current?.focus());
          }}>
            <label><span>{kb09t(lang, "gallery.taskLabel")}</span><input ref={draftInput} dir="auto" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); setAdding(false); requestAnimationFrame(() => addButton.current?.focus()); }
            }} /></label>
            <button type="submit" disabled={!draft.trim()}>{kb09t(lang, "gallery.add")}</button>
            <button type="button" onClick={() => { setAdding(false); requestAnimationFrame(() => addButton.current?.focus()); }}>{kb09t(lang, "gallery.cancel")}</button>
          </form>
        ) : <button ref={addButton} className="tp-btn tp-btn--secondary" type="button" onClick={() => setAdding(true)}>{kb09t(lang, "gallery.add")}</button>}
      </div>
    </main>
  );
}
