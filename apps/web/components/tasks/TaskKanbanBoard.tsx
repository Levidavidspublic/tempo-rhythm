"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  BOARD_COLUMNS,
  type BoardColumn,
  dayLabel,
  fill,
  groupBoard,
  isNewProjectId,
  minutesFromEstimate,
  moveUndoStatus,
  neighbourColumn,
  projectNameFor,
  projectStatusFor,
} from "@/lib/goals-projects";
import { projectIdFromSlug, tasksForProject } from "@/lib/taskKanban";
import { titleFromProjectSlug } from "@/lib/task-view-filters";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

type BoardTask = Doc<"tasks">;
type Dir = "prev" | "next";
type BoardProps = ({ projectSlug: string; scope?: never } | { scope: "all"; projectSlug?: never }) & { embedded?: boolean };

const COLUMN_NAME = { todo: "kb.todo", in_progress: "kb.doing", done: "kb.done" } as const;
const COLUMN_EMPTY = { todo: "kb.empty.todo", in_progress: "kb.empty.doing", done: "kb.empty.done" } as const;

/**
 * Project board (docs/design/v3/screens/web/project-kanban.html): the project's tasks as To do,
 * Doing and Done. Every card has Move buttons (drag is a bonus, never the only way); a move saves
 * the task's status with tasks.update, keeps focus on the same button, is announced in words and
 * has a 5-minute Undo.
 */
export function TaskKanbanBoard(props: BoardProps) {
  const { t } = useLocale();
  return (
    <ScreenBoundary
      fallback={(retry) => (
        <div className="tp-page tp-page--wide kb-stack" data-component="PageLayout">
          {props.projectSlug !== undefined ? <BackLink projectId={projectIdFromSlug(props.projectSlug)} /> : null}
          <StateError title={t("kb.error")} onRetry={retry} />
        </div>
      )}
    >
      <BoardContent {...props} />
    </ScreenBoundary>
  );
}

function BackLink({ projectId }: { projectId: string }) {
  const { t } = useLocale();
  return (
    <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={`/projects/${encodeURIComponent(projectId)}`}>
      <TpIcon name="chevron" size="sm" className="tp-icon--back" />
      <span>{t("kb.back")}</span>
    </Link>
  );
}

function BoardContent({ projectSlug, embedded = false }: BoardProps) {
  const { t, lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const bounds = useLocalDayBounds();
  const projectId = projectSlug === undefined ? undefined : projectIdFromSlug(projectSlug);
  const tasks = useQuery(api.tasks.list, signedIn === "ready" ? {} : "skip");
  // Optimistic: the card is in its new column before the server answers, so focus can follow it.
  const updateTask = useMutation(api.tasks.update).withOptimisticUpdate((store, { taskId, status }) => {
    if (!status) return;
    const rows = store.getQuery(api.tasks.list, {});
    if (!rows) return;
    store.setQuery(
      api.tasks.list,
      {},
      rows.map((row) => (row._id === taskId ? { ...row, status } : row)),
    );
  });
  const createTask = useMutation(api.tasks.create);
  const removeTask = useMutation(api.tasks.remove);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pendingFocus, setPendingFocus] = useState<{ taskId: string; dir: Dir } | null>(null);
  const [draggedId, setDraggedId] = useState<Id<"tasks"> | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // After a move the card re-renders in its new column: put focus back on the same button,
  // or on its other Move button when the card reached an edge.
  useEffect(() => {
    if (!pendingFocus) return;
    const card = boardRef.current?.querySelector<HTMLElement>(`[data-card="${pendingFocus.taskId}"]`);
    if (!card) return;
    const same = card.querySelector<HTMLButtonElement>(`[data-dir="${pendingFocus.dir}"]`);
    const target = same && !same.disabled ? same : card.querySelector<HTMLButtonElement>("[data-dir]:not([disabled])");
    (target ?? card).focus();
    setPendingFocus(null);
  });

  if (signedIn === "signedOut") {
    return (
      <div className="tp-page tp-page--wide kb-stack" data-component="PageLayout">
        {projectId !== undefined ? <BackLink projectId={projectId} /> : null}
        <SignedOutState />
      </div>
    );
  }
  if (tasks === undefined) {
    return (
      <div className="tp-page tp-page--wide kb-stack" data-component="PageLayout">
        {projectId !== undefined ? <BackLink projectId={projectId} /> : null}
        <StateLoading label={t("kb.loading")} />
      </div>
    );
  }

  const projectTasks = (projectSlug === undefined ? [...tasks] : tasksForProject(tasks as BoardTask[], projectSlug))
    .sort((a, b) => b.createdAt - a.createdAt);
  const columns = groupBoard(projectTasks);
  const onBoard = columns.todo.length + columns.in_progress.length + columns.done.length;
  const name =
    projectId === undefined ? t("nav.tasks") : projectTasks.length > 0
      ? projectNameFor(projectTasks, projectId)
      : isNewProjectId(projectId)
        ? t("pj.draft")
        : titleFromProjectSlug(projectId);

  const moveTo = (task: BoardTask, to: BoardColumn, focusDir?: Dir) => {
    if (task.status === to) return;
    if (focusDir) setPendingFocus({ taskId: task._id, dir: focusDir });
    setAnnouncement(`${task.title} → ${t(COLUMN_NAME[to])}`);
    // Undo (5 minutes) puts the card back in its old column; finishing a repeating task gets a
    // toast without Undo, since the next one it made can't be taken back here.
    const back = moveUndoStatus(task, to);
    updateTask({ taskId: task._id, status: to }).then(
      () => {
        setError(false);
        setToast(
          makeToast(
            fill(t("kb.moved"), { column: t(COLUMN_NAME[to]) }),
            back ? () => updateTask({ taskId: task._id, status: back }) : undefined,
          ),
        );
      },
      () => setError(true),
    );
  };

  const move = (task: BoardTask, dir: Dir) => {
    if (task.status !== "todo" && task.status !== "in_progress" && task.status !== "done") return;
    const to = neighbourColumn(task.status, dir);
    if (to) moveTo(task, to, dir);
  };

  const addCard = async (title: string) => {
    const taskId = await createTask({ title, ...(projectId === undefined ? {} : { projectId, projectName: name }), status: "todo" });
    setToast(makeToast(t("kb.added"), () => removeTask({ taskId })));
  };

  const startAdding = () => setAdding(true);

  return (
    <div className={embedded ? "kb-stack" : "tp-page tp-page--wide kb-stack"} data-component="PageLayout">
      {projectId !== undefined ? <BackLink projectId={projectId} /> : null}

      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          {embedded ? <h2 className="tp-section__title" dir="auto">{name}</h2> : <h1 className="tp-pagehead__title" dir="auto">{name}</h1>}
          <div className="tp-pagehead__sub kb-meta">
            {projectId !== undefined ? <StatusBadge
              kind="project"
              status={projectStatusFor(columns.done.length, projectTasks.filter((x) => x.status !== "cancelled").length)}
            /> : null}
            <span>{t("kb.hint")}</span>
          </div>
        </div>
        {onBoard > 0 || adding ? (
          <div className="tp-pagehead__actions">
            <button
              className="tp-btn tp-btn--primary"
              type="button"
              data-component="Button"
              aria-expanded={adding}
              onClick={startAdding}
            >
              <TpIcon name="plus" size="sm" />
              <span>{t("kb.add")}</span>
            </button>
          </div>
        ) : null}
      </header>

      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {error ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__text">{t("gx.saveError")}</span>
        </p>
      ) : null}
      <output className="tp-sr-only">{announcement}</output>

      {onBoard === 0 && !adding ? (
        <StateEmpty
          icon="kanban"
          title={t("kb.empty.title")}
          body={t("kb.empty.body")}
          action={
            <button className="tp-btn tp-btn--secondary" type="button" onClick={startAdding}>
              <TpIcon name="plus" size="sm" />
              <span>{t("kb.empty.add")}</span>
            </button>
          }
        />
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: the design's board is a labelled group of columns, not a form fieldset
        <div
          ref={boardRef}
          className="tp-kanban"
          data-component="Kanban"
          role="group"
          aria-label={fill(t("kb.board"), { name })}
        >
          {BOARD_COLUMNS.map((column) => {
            const cards = columns[column];
            const headingId = `col-${column}`;
            return (
              <section
                key={column}
                className="tp-kanban__col"
                aria-labelledby={headingId}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const task = projectTasks.find((row) => row._id === draggedId);
                  if (task) moveTo(task, column);
                  setDraggedId(null);
                }}
              >
                <div className="tp-kanban__head">
                  <h2 className="tp-kanban__name" id={headingId}>
                    {t(COLUMN_NAME[column])}
                  </h2>
                  <span className="tp-kanban__count tp-num">
                    {cards.length}
                    <span className="tp-sr-only"> {t("kb.cards")}</span>
                  </span>
                </div>
                {column === "todo" && adding ? (
                  <InlineAdd
                    id="kb-add"
                    label={t("kb.newcard")}
                    onSubmit={addCard}
                    onCancel={() => setAdding(false)}
                  />
                ) : null}
                <ul className="tp-kanban__list">
                  {cards.map((task) => (
                    <li
                      key={task._id}
                      draggable
                      onDragStart={() => setDraggedId(task._id)}
                      onDragEnd={() => setDraggedId(null)}
                    >
                      <KanbanCard
                        task={task}
                        column={column}
                        lang={lang}
                        todayStartMs={bounds.startMs}
                        todayEndMs={bounds.endMs}
                        onMove={(dir) => move(task, dir)}
                      />
                    </li>
                  ))}
                </ul>
                {cards.length === 0 ? <p className="tp-kanban__empty">{t(COLUMN_EMPTY[column])}</p> : null}
              </section>
            );
          })}
        </div>
      )}

      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </div>
  );
}

function KanbanCard({
  task,
  column,
  lang,
  todayStartMs,
  todayEndMs,
  onMove,
}: {
  task: BoardTask;
  column: BoardColumn;
  lang: "en" | "he";
  todayStartMs: number;
  todayEndMs: number;
  onMove: (dir: Dir) => void;
}) {
  const { t } = useLocale();
  const titleId = `card-${task._id}`;
  const minutes = minutesFromEstimate(task.timeEstimate);
  const due = task.dueAt === undefined ? null : dayLabel(task.dueAt, todayStartMs, todayEndMs, lang);
  const finished =
    column === "done" && task.completedAt !== undefined
      ? dayLabel(task.completedAt, todayStartMs, todayEndMs, lang)
      : null;
  return (
    <article className="tp-kanban-card" data-component="KanbanCard" data-card={task._id} aria-labelledby={titleId} tabIndex={-1}>
      <span className="tp-kanban-card__title" id={titleId} dir="auto">
        {task.title}
      </span>
      <div className="tp-kanban-card__meta">
        {column === "done" ? (
          <span>
            <TpIcon name="check" size="sm" />{" "}
            {finished?.kind === "today" ? (
              <span>{t("kb.doneToday")}</span>
            ) : (
              <>
                <span>{t("kb.done")}</span>
                {finished ? (
                  <>
                    {" "}
                    <span>{finished.weekday}</span> <span className="tp-num">{finished.day}</span>
                  </>
                ) : null}
              </>
            )}
          </span>
        ) : (
          <>
            {minutes !== null ? (
              <span>
                <span className="tp-num">{minutes}</span> <span>{t("gx.min")}</span>
              </span>
            ) : null}
            {due ? (
              due.kind === "today" ? (
                <span>{t("gx.today")}</span>
              ) : (
                <span>
                  <span>{due.weekday}</span> <span className="tp-num">{due.day}</span>
                </span>
              )
            ) : (
              <span>{t("kb.noday")}</span>
            )}
          </>
        )}
      </div>
      <div className="tp-kanban-card__move">
        <button
          className="tp-btn tp-btn--ghost tp-btn--sm"
          type="button"
          data-dir="prev"
          aria-describedby={titleId}
          disabled={neighbourColumn(column, "prev") === null}
          onClick={() => onMove("prev")}
        >
          <TpIcon name="arrow" size="sm" className="tp-icon--back" />
          <span>{t("kb.prev")}</span>
        </button>
        <button
          className="tp-btn tp-btn--ghost tp-btn--sm"
          type="button"
          data-dir="next"
          aria-describedby={titleId}
          disabled={neighbourColumn(column, "next") === null}
          onClick={() => onMove("next")}
        >
          <span>{t("kb.next")}</span>
          <TpIcon name="arrow" size="sm" flip />
        </button>
      </div>
    </article>
  );
}
