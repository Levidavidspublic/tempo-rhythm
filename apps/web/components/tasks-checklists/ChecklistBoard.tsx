"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateEmpty, StateLoading, StateSignedOut } from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { addStep, type ChecklistStep, progress, removeStep, renameStep, toggleStep } from "./checklistOps";

type OpenTask = Doc<"tasks"> & { checklist?: ChecklistStep[] };

/**
 * /tasks/checklists (tasks.html, Checklist component): open tasks broken into small steps. Built on
 * the v3 page, card, checklist and state classes; a failed save says so kindly (never Convex text),
 * a deleted task gets the shared 5-minute Undo toast, and signed out shows a way in instead of a
 * blank page.
 */
export function ChecklistBoard() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const hasConvexUser = profile != null;
  const tasks = useQuery(
    api.tasks.list,
    isAuthenticated && hasConvexUser ? {} : "skip",
  );
  const updateTask = useMutation(api.tasks.update);
  const removeTask = useMutation(api.tasks.remove);
  const restoreTask = useMutation(api.tasks.restore);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ taskId: Id<"tasks">; undoUntilMs: number } | null>(null);
  const [feedback, setFeedback] = useState("");

  const openTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (task): task is OpenTask => task.status === "todo" || task.status === "in_progress",
      ),
    [tasks],
  );
  const withSteps = openTasks.filter((task) => (task.checklist?.length ?? 0) > 0);
  const withoutSteps = openTasks.filter((task) => (task.checklist?.length ?? 0) === 0);
  const isLoading =
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined || (hasConvexUser && tasks === undefined)));

  async function saveChecklist(task: OpenTask, checklist: ChecklistStep[]) {
    setPendingTaskId(task._id);
    setFeedback("");
    try {
      await updateTask({ taskId: task._id, checklist });
    } catch {
      setFeedback(t("ck.saveError"));
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleDelete(taskId: Id<"tasks">) {
    setPendingTaskId(taskId);
    setFeedback("");
    try {
      const result = await removeTask({ taskId });
      setRemoved({ taskId, undoUntilMs: result.undoUntilMs });
    } catch {
      setFeedback(t("ck.saveError"));
    } finally {
      setPendingTaskId(null);
    }
  }

  /** The toast awaits this; throwing keeps it open with "That didn't undo". */
  async function handleUndo() {
    if (!removed) return;
    setPendingTaskId(removed.taskId);
    try {
      const result = await restoreTask({ taskId: removed.taskId });
      if (!result.success) throw new Error("undo window ended");
    } finally {
      setPendingTaskId(null);
    }
  }

  const signedOut = !isLoading && (!isAuthenticated || profile === null);

  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <span className="tp-eyebrow">{t("ck.eyebrow")}</span>
          <h1 className="tp-pagehead__title">{t("ck.title")}</h1>
          <p className="tp-pagehead__sub">{t("ck.sub")}</p>
        </div>
      </header>

      {feedback ? (
        <p className="tp-notice" data-tone="caution" role="alert">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">{feedback}</span>
        </p>
      ) : null}

      {isLoading ? (
        <StateLoading label={t("ck.loading")} rows={3} />
      ) : signedOut ? (
        <StateSignedOut />
      ) : openTasks.length === 0 ? (
        <StateEmpty
          icon="checklist"
          title={t("ck.noneTitle")}
          body={t("ck.noneBody")}
          action={
            <Link className="tp-btn tp-btn--secondary" href="/tasks">
              {t("ck.openTasks")}
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="checklists-with-steps" className="tp-section" data-component="Section">
            <div className="tp-section__head">
              <h2 id="checklists-with-steps" className="tp-section__title">
                {t("ck.withSteps")}
              </h2>
            </div>
            {withSteps.length === 0 ? (
              <p className="tp-help">{t("ck.withStepsEmpty")}</p>
            ) : (
              <ul className="tp-cards ck-cards">
                {withSteps.map((task) => (
                  <TaskChecklistCard
                    key={task._id}
                    task={task}
                    disabled={pendingTaskId === task._id}
                    onSave={(checklist) => saveChecklist(task, checklist)}
                    onDelete={() => handleDelete(task._id)}
                  />
                ))}
              </ul>
            )}
          </section>

          {withoutSteps.length > 0 ? (
            <section aria-labelledby="tasks-without-steps" className="tp-section" data-component="Section">
              <div className="tp-section__head">
                <h2 id="tasks-without-steps" className="tp-section__title">
                  {t("ck.withoutSteps")}
                </h2>
              </div>
              <ul className="tp-cards ck-cards">
                {withoutSteps.map((task) => (
                  <TaskChecklistCard
                    key={task._id}
                    task={task}
                    disabled={pendingTaskId === task._id}
                    onSave={(checklist) => saveChecklist(task, checklist)}
                    onDelete={() => handleDelete(task._id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {removed ? (
        <UndoToast
          title={t("ck.removed")}
          untilMs={removed.undoUntilMs}
          onUndo={handleUndo}
          onClose={() => setRemoved(null)}
        />
      ) : null}
    </div>
  );
}

function TaskChecklistCard({
  task,
  disabled,
  onSave,
  onDelete,
}: {
  task: OpenTask;
  disabled: boolean;
  onSave: (steps: ChecklistStep[]) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useLocale();
  const steps = task.checklist ?? [];
  const tally = progress(steps);
  const [newStep, setNewStep] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  function submitNewStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = addStep(steps, newStep, crypto.randomUUID());
    if (next.length === steps.length) return;
    setNewStep("");
    void onSave(next);
  }

  function submitRename(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const next = renameStep(steps, id, editingText);
    if (next.find((step) => step.id === id)?.text === steps.find((step) => step.id === id)?.text) {
      return;
    }
    setEditingId(null);
    void onSave(next);
  }

  return (
    <li className="tp-card ck-card" data-component="ChecklistCard">
      <div className="tp-card__head ck-card__head">
        <div className="ck-card__title">
          <h3 className="tp-h3" dir="auto">
            {task.title}
          </h3>
          <span className="tp-checklist__count">
            {t("ck.count").replace("{n}", String(tally.completed)).replace("{m}", String(tally.total))}
          </span>
        </div>
        <button className="tp-btn tp-btn--danger-ghost tp-btn--sm" type="button" disabled={disabled} onClick={onDelete}>
          {t("ck.deleteTask")}
        </button>
      </div>

      {steps.length > 0 ? (
        <ul className="tp-checklist" aria-label={t("ck.stepsOf").replace("{title}", task.title)}>
          {steps.map((step) => (
            <li key={step.id} className="tp-checklist__item ck-step" data-done={step.completed ? "true" : undefined}>
              {editingId === step.id ? (
                <form className="ck-step__edit" onSubmit={(event) => submitRename(event, step.id)}>
                  <input
                    className="tp-input"
                    dir="auto"
                    aria-label={t("ck.renameStep").replace("{step}", step.text)}
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                  />
                  <button className="tp-btn tp-btn--secondary tp-btn--sm" type="submit" disabled={disabled || !editingText.trim()}>
                    {t("ck.save")}
                  </button>
                  <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" onClick={() => setEditingId(null)}>
                    {t("ck.cancel")}
                  </button>
                </form>
              ) : (
                <>
                  <label className="tp-choice ck-step__check">
                    <input
                      type="checkbox"
                      className="tp-checkbox"
                      checked={step.completed}
                      disabled={disabled}
                      aria-label={`Mark ${step.text} ${step.completed ? "not complete" : "complete"}`}
                      onChange={() => void onSave(toggleStep(steps, step.id))}
                    />
                    <span className="tp-choice__text tp-checklist__text" dir="auto">
                      {step.text}
                    </span>
                  </label>
                  <span className="ck-step__actions">
                    <button
                      className="tp-btn tp-btn--ghost tp-btn--sm"
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setEditingId(step.id);
                        setEditingText(step.text);
                      }}
                    >
                      {t("ck.rename")}
                    </button>
                    <button
                      className="tp-btn tp-btn--danger-ghost tp-btn--sm"
                      type="button"
                      disabled={disabled}
                      onClick={() => void onSave(removeStep(steps, step.id))}
                    >
                      {t("ck.remove")}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form className="ck-add" onSubmit={submitNewStep}>
        <label className="tp-sr-only" htmlFor={`new-step-${task._id}`}>
          {t("ck.addStepTo").replace("{title}", task.title)}
        </label>
        <input
          id={`new-step-${task._id}`}
          className="tp-input"
          dir="auto"
          value={newStep}
          disabled={disabled}
          onChange={(event) => setNewStep(event.target.value)}
          placeholder={t("ck.stepPh")}
        />
        <button className="tp-btn tp-btn--secondary" type="submit" disabled={disabled || !newStep.trim()}>
          <TpIcon name="plus" size="sm" />
          <span>{t("ck.addStep")}</span>
        </button>
      </form>
    </li>
  );
}
