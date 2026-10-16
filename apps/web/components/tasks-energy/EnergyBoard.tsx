"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { type Energy, groupByEnergy } from "./groupByEnergy";

const columns: { energy: Energy; label: string }[] = [
  { energy: "low", label: "Low energy" },
  { energy: "medium", label: "Medium energy" },
  { energy: "high", label: "High energy" },
];

const allowLocalTaskViews =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1";

type RemovedTask = {
  taskId: Id<"tasks">;
  undoUntilMs: number;
};

function isEnergy(value: string | null): value is Energy {
  return value === "low" || value === "medium" || value === "high";
}

export function EnergyBoard() {
  const { isAuthenticated } = useConvexAuth();
  // tasks.list requires an app user. getProfile is non-throwing while that row is
  // being created, so wait for it before subscribing to the protected query.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const tasks = useQuery(
    api.tasks.list,
    isAuthenticated && profile ? {} : "skip",
  );
  const updateTask = useMutation(api.tasks.update);
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const removeTask = useMutation(api.tasks.remove);
  const restoreTask = useMutation(api.tasks.restore);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEnergy = isEnergy(searchParams.get("now"))
    ? searchParams.get("now")
    : null;
  const [removed, setRemoved] = useState<RemovedTask | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timeout = window.setTimeout(
      () => setRemoved(null),
      Math.max(0, removed.undoUntilMs - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [removed]);

  const groups = useMemo(() => groupByEnergy(tasks ?? []), [tasks]);

  const chooseEnergy = (energy: Energy) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("now", energy);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const handleRemove = async (taskId: Id<"tasks">) => {
    const result = await removeTask({ taskId });
    setRemoved({ taskId, undoUntilMs: result.undoUntilMs });
  };

  const handleUndo = async () => {
    if (!removed || Date.now() >= removed.undoUntilMs) return;
    const result = await restoreTask({ taskId: removed.taskId });
    if (result.success) setRemoved(null);
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Tasks</p>
        <h1 className="text-3xl font-semibold tracking-tight">Energy</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Choose what fits the energy you have, without pressure to do more.
        </p>
      </header>

      <section aria-labelledby="energy-now-heading" className="space-y-3">
        <h2 id="energy-now-heading" className="text-sm font-semibold">
          Right now I have...
        </h2>
        <div className="flex flex-wrap gap-2">
          {columns.map(({ energy, label }) => (
            <Button
              key={energy}
              type="button"
              variant={selectedEnergy === energy ? "default" : "outline"}
              aria-pressed={selectedEnergy === energy}
              onClick={() => chooseEnergy(energy)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map(({ energy, label }) => {
          const columnTasks = groups[energy];
          return (
            <section
              key={energy}
              aria-labelledby={`${energy}-energy-heading`}
              className={cn(
                "rounded-2xl border bg-card p-4 transition-colors",
                selectedEnergy === energy &&
                  "border-primary ring-2 ring-primary/15",
              )}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id={`${energy}-energy-heading`} className="font-semibold">
                  {label}
                </h2>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {columnTasks.length}
                </span>
              </div>

              {!allowLocalTaskViews && tasks === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Loading tasks...
                </p>
              ) : columnTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing here right now
                </p>
              ) : (
                <ul className="space-y-3">
                  {columnTasks.map((task: Doc<"tasks">) => (
                    <li
                      key={task._id}
                      className="space-y-3 rounded-xl border bg-background p-3"
                    >
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-primary"
                          aria-label={`Mark ${task.title} complete`}
                          onChange={() =>
                            void toggleCompletion({ taskId: task._id })
                          }
                        />
                        <span className="font-medium leading-snug">
                          {task.title}
                        </span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className="sr-only"
                          htmlFor={`energy-${task._id}`}
                        >
                          Energy for {task.title}
                        </label>
                        <select
                          id={`energy-${task._id}`}
                          value={task.energy ?? "medium"}
                          onChange={(event) =>
                            void updateTask({
                              taskId: task._id,
                              energy: event.target.value as Energy,
                            })
                          }
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                        >
                          {columns.map((option) => (
                            <option key={option.energy} value={option.energy}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => void handleRemove(task._id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {removed ? (
        <output
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg"
        >
          <span className="text-sm">Task removed.</span>
          <Button
            type="button"
            size="sm"
            variant="link"
            onClick={() => void handleUndo()}
          >
            Undo
          </Button>
        </output>
      ) : null}
    </main>
  );
}
