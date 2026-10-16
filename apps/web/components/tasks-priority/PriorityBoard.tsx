"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateLoading, StateSignedOut } from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { reflowElastic, splitByFlexibility } from "./calibrate";

type Priority = Doc<"tasks">["priority"];
type Flexibility = NonNullable<Doc<"tasks">["flexibility"]>;
type UndoState = { taskId: Id<"tasks">; undoUntilMs: number };

const PRIORITIES: readonly Priority[] = ["high", "medium", "low"];

/**
 * Production /tasks/priority (calendar.html / tasks.html "Fixed" and "Flexible"): fixed items stay
 * put, flexible ones move around them. v3 page, cards, chips with a word (colour is never the only
 * signal), native selects in tp-select, the shared loading / signed-out states and Undo toast.
 */
export function PriorityBoard() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // tasks.list calls requireUser, so wait until the non-throwing profile query
  // confirms that the authenticated identity has a corresponding user row.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const hasConvexUser = profile != null;
  const tasks = useQuery(
    api.tasks.list,
    isAuthenticated && hasConvexUser ? {} : "skip"
  );
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const restoreTask = useMutation(api.tasks.restore);
  const [busyTaskId, setBusyTaskId] = useState<Id<"tasks"> | null>(null);
  const [error, setError] = useState<"prio.saveError" | "prio.removeError" | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  const groups = useMemo(() => {
    const openTasks = (tasks ?? []).filter(
      (task) => task.status === "todo" || task.status === "in_progress"
    );
    const split = splitByFlexibility(openTasks);
    const ordered = reflowElastic(split.fixed, split.elastic);
    return {
      fixed: ordered.slice(0, split.fixed.length),
      elastic: ordered.slice(split.fixed.length),
    };
  }, [tasks]);

  async function update(taskId: Id<"tasks">, change: { flexibility?: Flexibility; priority?: Priority }) {
    setBusyTaskId(taskId);
    setError(null);
    try {
      await updateTask({ taskId, ...change });
    } catch {
      setError("prio.saveError");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function remove(taskId: Id<"tasks">) {
    setBusyTaskId(taskId);
    setError(null);
    try {
      const result = await removeTask({ taskId });
      setUndo({ taskId, undoUntilMs: result.undoUntilMs });
    } catch {
      setError("prio.removeError");
    } finally {
      setBusyTaskId(null);
    }
  }

  /** The toast awaits this; throwing keeps it open with "That didn't undo". */
  async function restore() {
    if (!undo) return;
    const current = undo;
    setBusyTaskId(current.taskId);
    setError(null);
    try {
      const result = await restoreTask({ taskId: current.taskId });
      if (!result.success) throw new Error("Undo expired");
    } finally {
      setBusyTaskId(null);
    }
  }

  if (
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined || (hasConvexUser && tasks === undefined)))
  ) {
    return (
      <div className="tp-page" data-component="PageLayout">
        <StateLoading label={t("prio.loading")} rows={4} />
      </div>
    );
  }

  if (!isAuthenticated || !hasConvexUser) {
    return (
      <div className="tp-page" data-component="PageLayout">
        <StateSignedOut body={t("prio.signIn")} />
      </div>
    );
  }

  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <span className="tp-eyebrow">{t("prio.eyebrow")}</span>
          <h1 className="tp-pagehead__title">{t("prio.title")}</h1>
          <p className="tp-pagehead__sub">{t("prio.sub")}</p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="tp-notice" data-tone="caution">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">{t(error)}</span>
        </p>
      ) : null}

      <div className="prio-grid">
        <TaskSection
          kind="fixed"
          busyTaskId={busyTaskId}
          onRemove={remove}
          onUpdate={update}
          tasks={groups.fixed}
        />
        <TaskSection
          kind="flexible"
          busyTaskId={busyTaskId}
          onRemove={remove}
          onUpdate={update}
          tasks={groups.elastic}
        />
      </div>

      {undo ? (
        <UndoToast title={t("prio.removed")} untilMs={undo.undoUntilMs} onUndo={restore} onClose={() => setUndo(null)} />
      ) : null}
    </div>
  );
}

function TaskSection({
  kind,
  busyTaskId,
  onRemove,
  onUpdate,
  tasks,
}: {
  kind: "fixed" | "flexible";
  busyTaskId: Id<"tasks"> | null;
  onRemove: (taskId: Id<"tasks">) => Promise<void>;
  onUpdate: (taskId: Id<"tasks">, change: { flexibility?: Flexibility; priority?: Priority }) => Promise<void>;
  tasks: Doc<"tasks">[];
}) {
  const { t } = useLocale();
  const headingId = `${kind}-heading`;
  return (
    <section className="tp-section" aria-labelledby={headingId} data-component="Section">
      <div className="tp-section__head">
        <h2 id={headingId} className="tp-section__title">
          {kind === "fixed" ? t("prio.fixedHead") : t("prio.flexHead")}
        </h2>
        <span className="tp-section__count tp-num">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="tp-help">{kind === "fixed" ? t("prio.fixedEmpty") : t("prio.flexEmpty")}</p>
      ) : (
        <ul className="prio-list">
          {tasks.map((task) => {
            const isBusy = busyTaskId === task._id;
            const flexibility = task.flexibility ?? "elastic";
            return (
              <li key={task._id} className="tp-card prio-card" aria-busy={isBusy} data-component="PriorityCard">
                <div className="prio-card__head">
                  <span className="tp-task-row__title" dir="auto">
                    {task.title}
                  </span>
                  <span className={`tp-chip ${flexibility === "fixed" ? "tp-chip--fixed" : "tp-chip--flex"}`}>
                    {flexibility === "fixed" ? t("prio.fixed") : t("prio.flexible")}
                  </span>
                </div>
                <div className="prio-card__controls">
                  <label className="tp-field">
                    <span className="tp-label">{t("prio.movement")}</span>
                    <span className="tp-select">
                      <select
                        className="tp-select__input"
                        value={flexibility}
                        disabled={isBusy}
                        onChange={(event) => void onUpdate(task._id, { flexibility: event.target.value as Flexibility })}
                        aria-label={`Movement for ${task.title}`}
                      >
                        <option value="fixed">{t("prio.fixed")}</option>
                        <option value="elastic">{t("prio.flexible")}</option>
                      </select>
                      <span className="tp-select__icon">
                        <TpIcon name="down" size="sm" />
                      </span>
                    </span>
                  </label>
                  <label className="tp-field">
                    <span className="tp-label">{t("prio.priority")}</span>
                    <span className="tp-select">
                      <select
                        className="tp-select__input"
                        value={task.priority}
                        disabled={isBusy}
                        onChange={(event) => void onUpdate(task._id, { priority: event.target.value as Priority })}
                        aria-label={`Priority for ${task.title}`}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {t(`prio.${priority}` as const)}
                          </option>
                        ))}
                      </select>
                      <span className="tp-select__icon">
                        <TpIcon name="down" size="sm" />
                      </span>
                    </span>
                  </label>
                  <button
                    className="tp-btn tp-btn--danger-ghost tp-btn--sm prio-card__delete"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onRemove(task._id)}
                    aria-label={`Delete ${task.title}`}
                  >
                    {t("prio.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
