"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { CompactTaskRow, type CompactTask } from "./CompactTaskRow";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type TodayTask = CompactTask & {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
};

type TodayTaskListProps = {
  tasks: TodayTask[];
};

const priorityClass: Record<TodayTask["priority"], string> = {
  high: "text-destructive",
  medium: "text-primary",
  low: "text-muted-foreground",
};

const priorityLabel: Record<TodayTask["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function TodayTaskList({ tasks }: TodayTaskListProps) {
  const { t } = useLocale();
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const visibleTasks = activeTasks.slice(0, 3);
  const hiddenTaskCount = Math.max(activeTasks.length - visibleTasks.length, 0);
  const completedTasks = tasks.filter((task) => task.status === "done");
  const mobileTasks = tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
  const hasCompletedEverything = tasks.length > 0 && activeTasks.length === 0;

  return (
    <>
    <section className="tp-mobile-task-list" data-component="MobileTodayTaskList" aria-labelledby="mobile-today-tasks">
      <header><h2 id="mobile-today-tasks">{t("nav.today")}</h2><span className="tp-muted tp-small">{t("mobile.openCount").replace("{n}", String(mobileTasks.length))}</span></header>
      {mobileTasks.length === 0 ? <p className="tp-muted">{t("mobile.empty")}</p> : <ul>{mobileTasks.map((task) => <CompactTaskRow key={task._id} task={task} onToggle={() => toggleCompletion({ taskId: task._id })} />)}</ul>}
      {completedTasks.length > 0 ? <details><summary>{t("mobile.doneCount").replace("{n}", String(completedTasks.length))}</summary><ul>{completedTasks.map((task) => <CompactTaskRow key={task._id} task={task} onToggle={() => toggleCompletion({ taskId: task._id })} />)}</ul></details> : null}
    </section>
    <section
      className="tp-desktop-task-list rounded-3xl border border-border/80 bg-card/90 p-6 shadow-[0_10px_30px_rgba(26,25,23,0.08)]"
      aria-labelledby="today-task-list-heading"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-[#D97757] to-[#E8A87C] text-primary-foreground shadow-inner">
          <ListTodo className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2
            id="today-task-list-heading"
            className="font-heading text-2xl font-semibold text-foreground"
          >
            Today
          </h2>
          <p className="text-sm text-muted-foreground">
            {tasks.length === 0
              ? "Nothing on the plan yet."
              : hasCompletedEverything
                ? "Everything due today is done."
                : hiddenTaskCount > 0
                  ? `Showing ${visibleTasks.length} of ${activeTasks.length} open today.`
                  : `${activeTasks.length} still open today.`}
          </p>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center">
          <p className="text-base text-foreground">Nothing on the plan yet. Want to add one?</p>
          <p className="mt-2 text-sm text-muted-foreground">A small next step is enough.</p>
        </div>
      ) : hasCompletedEverything ? (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 text-primary">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          <span>All open tasks for today are done.</span>
        </div>
      ) : (
        <div className="space-y-3">
          <ul className="space-y-3">
            {visibleTasks.map((task) => {
              const isDone = task.status === "done";

              return (
                <li
                  key={task._id}
                  className={cn(
                    "rounded-2xl border border-border/80 bg-background/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition",
                    isDone && "opacity-75",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void toggleCompletion({ taskId: task._id });
                      }}
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                        isDone
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground",
                      )}
                      aria-label={
                        isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} complete`
                      }
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      ) : (
                        <Circle className="h-4 w-4" aria-hidden />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-medium text-foreground",
                            isDone && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-semibold uppercase tracking-wide",
                            priorityClass[task.priority],
                          )}
                        >
                          {priorityLabel[task.priority]}
                        </span>
                      </div>

                      {task.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {hiddenTaskCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              {hiddenTaskCount} more open {hiddenTaskCount === 1 ? "task is" : "tasks are"} waiting in{" "}
              <Link href="/tasks" className="font-semibold text-primary underline-offset-4 hover:underline">
                Tasks
              </Link>
              .
            </p>
          ) : null}
        </div>
      )}
    </section>
    </>
  );
}
