"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { reflowElastic, splitByFlexibility } from "./calibrate";

type Priority = Doc<"tasks">["priority"];
type Flexibility = NonNullable<Doc<"tasks">["flexibility"]>;
type UndoState = { taskId: Id<"tasks">; undoUntilMs: number };

const priorityLabels: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBoard() {
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
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);

  useEffect(() => {
    if (!undo) return;
    const remaining = undo.undoUntilMs - Date.now();
    if (remaining <= 0) {
      setUndo(null);
      return;
    }
    const timer = window.setTimeout(() => setUndo(null), remaining);
    return () => window.clearTimeout(timer);
  }, [undo]);

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
      setError("That change could not be saved. Please try again.");
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
      setError("That task could not be removed. Please try again.");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function restore() {
    if (!undo) return;
    const current = undo;
    setBusyTaskId(current.taskId);
    setError(null);
    try {
      const result = await restoreTask({ taskId: current.taskId });
      if (!result.success) throw new Error("Undo expired");
      setUndo(null);
    } catch {
      setError("Undo is no longer available for that task.");
    } finally {
      setBusyTaskId(null);
    }
  }

  if (
    isAuthLoading ||
    (isAuthenticated &&
      (profile === undefined || (hasConvexUser && tasks === undefined)))
  ) {
    return <p className="text-sm text-muted-foreground">Loading your priorities…</p>;
  }

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">Sign in to calibrate your priorities.</p>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Priority calibration
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Fixed or flexible?</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Fixed items stay where they are. Flexible items move around them.
        </p>
      </header>

      {error ? (
        <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <TaskSection
          busyTaskId={busyTaskId}
          emptyMessage="No fixed tasks yet."
          heading="Fixed (can't move)"
          onRemove={remove}
          onUpdate={update}
          tasks={groups.fixed}
        />
        <TaskSection
          busyTaskId={busyTaskId}
          emptyMessage="No flexible tasks yet."
          heading="Flexible (can move)"
          onRemove={remove}
          onUpdate={update}
          tasks={groups.elastic}
        />
      </div>

      {undo ? (
        <output className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border bg-background px-5 py-3 text-sm shadow-lg">
          <span>Task removed.</span>
          <Button variant="link" className="h-auto p-0" onClick={() => void restore()} disabled={busyTaskId === undo.taskId}>
            Undo
          </Button>
        </output>
      ) : null}
    </main>
  );
}

function TaskSection({ busyTaskId, emptyMessage, heading, onRemove, onUpdate, tasks }: {
  busyTaskId: Id<"tasks"> | null;
  emptyMessage: string;
  heading: string;
  onRemove: (taskId: Id<"tasks">) => Promise<void>;
  onUpdate: (taskId: Id<"tasks">, change: { flexibility?: Flexibility; priority?: Priority }) => Promise<void>;
  tasks: Doc<"tasks">[];
}) {
  return (
    <section aria-labelledby={`${heading.startsWith("Fixed") ? "fixed" : "flexible"}-heading`}>
      <h2 id={`${heading.startsWith("Fixed") ? "fixed" : "flexible"}-heading`} className="mb-3 text-lg font-semibold">
        {heading}
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const isBusy = busyTaskId === task._id;
            const flexibility = task.flexibility ?? "elastic";
            return (
              <li key={task._id} className="rounded-2xl border bg-card p-4 shadow-sm" aria-busy={isBusy}>
                <p className="mb-4 font-medium">{task.title}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Movement
                    <select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={flexibility} disabled={isBusy} onChange={(event) => void onUpdate(task._id, { flexibility: event.target.value as Flexibility })} aria-label={`Movement for ${task.title}`}>
                      <option value="fixed">Fixed</option>
                      <option value="elastic">Flexible</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Priority
                    <select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={task.priority} disabled={isBusy} onChange={(event) => void onUpdate(task._id, { priority: event.target.value as Priority })} aria-label={`Priority for ${task.title}`}>
                      {(Object.keys(priorityLabels) as Priority[]).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}
                    </select>
                  </label>
                  <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={isBusy} onClick={() => void onRemove(task._id)} aria-label={`Delete ${task.title}`}>
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
