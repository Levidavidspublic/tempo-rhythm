"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  addStep,
  progress,
  removeStep,
  renameStep,
  toggleStep,
  type ChecklistStep,
  undoFeedback,
} from "./checklistOps";

type OpenTask = Doc<"tasks"> & { checklist?: ChecklistStep[] };

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function ChecklistBoard() {
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
  const undoInFlight = useRef(false);

  useEffect(() => {
    if (!removed) return;
    const remaining = removed.undoUntilMs - Date.now();
    if (remaining <= 0) {
      setRemoved(null);
      return;
    }
    const timeout = window.setTimeout(() => setRemoved(null), remaining);
    return () => window.clearTimeout(timeout);
  }, [removed]);

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
    } catch (error) {
      setFeedback(messageFor(error));
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
    } catch (error) {
      setFeedback(messageFor(error));
    } finally {
      setPendingTaskId(null);
    }
  }

  async function handleUndo() {
    if (!removed || undoInFlight.current) return;
    undoInFlight.current = true;
    setPendingTaskId(removed.taskId);
    setFeedback("");
    try {
      const result = await restoreTask({ taskId: removed.taskId });
      setRemoved(null);
      setFeedback(undoFeedback(result));
    } catch (error) {
      setFeedback(messageFor(error));
    } finally {
      undoInFlight.current = false;
      setPendingTaskId(null);
    }
  }

  return (
    <main className="container mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 space-y-3">
        <p className="font-eyebrow text-muted-foreground">Tasks</p>
        <h1 className="font-heading text-4xl font-semibold text-foreground">Checklists</h1>
        <p className="max-w-2xl text-muted-foreground">
          Turn open tasks into small, manageable steps. Progress is progress, however small.
        </p>
      </header>

      <div aria-live="polite" className="mb-6 min-h-6 text-sm text-muted-foreground">
        {removed ? (
          <span>
            Task removed. {" "}
            <button
              className="font-semibold text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={pendingTaskId === removed.taskId}
              onClick={handleUndo}
            >
              Undo
            </button>
          </span>
        ) : (
          feedback
        )}
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading checklists…</p> : null}

      {!isLoading && tasks !== undefined ? (
        <div className="space-y-12">
          <section aria-labelledby="checklists-with-steps" className="space-y-4">
            <h2 id="checklists-with-steps" className="font-heading text-2xl font-semibold">
              Your checklists
            </h2>
            {withSteps.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">
                No checklists yet. Add a first step below when you are ready.
              </p>
            ) : (
              <ul className="grid gap-5">
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

          <section aria-labelledby="tasks-without-steps" className="space-y-4">
            <h2 id="tasks-without-steps" className="font-heading text-2xl font-semibold">
              Add steps to a task
            </h2>
            {withoutSteps.length === 0 ? (
              <p className="text-muted-foreground">Every open task already has steps.</p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
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
            )}
          </section>
        </div>
      ) : null}
    </main>
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
    <li className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-xl font-semibold text-foreground">{task.title}</h3>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {tally.completed} of {tally.total} steps
          </p>
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={onDelete}>
          Delete task
        </Button>
      </div>

      {steps.length > 0 ? (
        <ul className="mb-4 space-y-2" aria-label={`${task.title} steps`}>
          {steps.map((step) => (
            <li key={step.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-surface-sunken px-3 py-2">
              <input
                type="checkbox"
                checked={step.completed}
                disabled={disabled}
                aria-label={`Mark ${step.text} ${step.completed ? "not complete" : "complete"}`}
                onChange={() => void onSave(toggleStep(steps, step.id))}
                className="h-5 w-5 rounded border-border text-primary"
              />
              {editingId === step.id ? (
                <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => submitRename(event, step.id)}>
                  <input
                    aria-label={`Rename ${step.text}`}
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3"
                  />
                  <Button type="submit" disabled={disabled || !editingText.trim()}>Save</Button>
                </form>
              ) : (
                <>
                  <span className={`min-w-0 flex-1 ${step.completed ? "text-muted-foreground line-through" : ""}`}>
                    {step.text}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => { setEditingId(step.id); setEditingText(step.text); }}
                    className="min-h-11 px-2 text-sm font-medium text-primary"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onSave(removeStep(steps, step.id))}
                    className="min-h-11 px-2 text-sm font-medium text-destructive"
                  >
                    Remove
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitNewStep}>
        <label className="sr-only" htmlFor={`new-step-${task._id}`}>Add a step to {task.title}</label>
        <input
          id={`new-step-${task._id}`}
          value={newStep}
          disabled={disabled}
          onChange={(event) => setNewStep(event.target.value)}
          placeholder="What is the next small step?"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-foreground"
        />
        <Button type="submit" disabled={disabled || !newStep.trim()}>Add step</Button>
      </form>
    </li>
  );
}
