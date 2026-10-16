"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type TodayTask = {
  _id: Id<"tasks">;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high";
};

type TodayTaskListProps = {
  tasks: TodayTask[];
};

/** How many open tasks Today shows before pointing to Tasks. */
const SHOWN = 3;

/**
 * Today's open tasks (TaskBlock / TaskRow, DESIGN.md §9): the first few, a tick that saves at once,
 * and a kind line when the tick doesn't go through. The rest wait in Tasks.
 */
export function TodayTaskList({ tasks }: TodayTaskListProps) {
  const { t } = useLocale();
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const [failedId, setFailedId] = useState<Id<"tasks"> | null>(null);

  const activeTasks = tasks.filter((task) => task.status !== "done");
  const visibleTasks = activeTasks.slice(0, SHOWN);
  const hiddenTaskCount = Math.max(activeTasks.length - visibleTasks.length, 0);
  const hasCompletedEverything = tasks.length > 0 && activeTasks.length === 0;

  const toggle = async (taskId: Id<"tasks">) => {
    setFailedId(null);
    try {
      await toggleCompletion({ taskId });
    } catch {
      setFailedId(taskId);
    }
  };

  return (
    <section className="tp-surface" data-component="TodayTasks" aria-labelledby="today-task-list-heading">
      <header className="tp-section__head">
        <h2 id="today-task-list-heading" className="tp-section__title">
          {t("ttl.title")}
        </h2>
        {activeTasks.length > 0 ? (
          <span className="tp-section__count">
            {hiddenTaskCount > 0
              ? t("ttl.showing").replace("{n}", String(visibleTasks.length)).replace("{m}", String(activeTasks.length))
              : t("ttl.open").replace("{n}", String(activeTasks.length))}
          </span>
        ) : null}
      </header>

      {tasks.length === 0 ? (
        <p className="tp-help">{t("ttl.empty")}</p>
      ) : hasCompletedEverything ? (
        <p className="tp-notice" data-tone="done">
          <span className="tp-notice__icon">
            <TpIcon name="check" size="sm" />
          </span>
          <span className="tp-notice__text">{t("ttl.allDone")}</span>
        </p>
      ) : (
        <>
          <ul className="tp-list">
            {visibleTasks.map((task) => {
              const titleId = `today-task-${task._id}`;
              return (
                <li key={task._id} className="tp-task-row" data-component="TaskRow">
                  {/* biome-ignore lint/a11y/useSemanticElements: the v3 TaskRow check is a button with checkbox semantics (tp-check) */}
                  <button
                    className="tp-check"
                    type="button"
                    role="checkbox"
                    aria-checked={false}
                    aria-labelledby={titleId}
                    onClick={() => void toggle(task._id)}
                  >
                    <span className="tp-check__box">
                      <TpIcon name="check" />
                    </span>
                  </button>
                  <div className="tp-task-row__body">
                    <span className="tp-task-row__title" id={titleId} dir="auto">
                      {task.title}
                    </span>
                    {task.description ? (
                      <span className="tp-task-row__meta" dir="auto">
                        {task.description}
                      </span>
                    ) : null}
                    {task.priority === "high" ? (
                      <span className="tp-task-row__meta">
                        <span className="tp-badge" data-tone="caution">
                          {t("ttl.high")}
                        </span>
                      </span>
                    ) : null}
                    {failedId === task._id ? (
                      <p className="tp-error-text" role="alert">
                        <TpIcon name="alert" size="sm" />
                        <span>{t("ttl.toggleError")}</span>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {hiddenTaskCount > 0 ? (
            <p className="tp-help">
              {t("ttl.more").replace("{n}", String(hiddenTaskCount))}{" "}
              <Link href="/tasks" className="tp-btn tp-btn--link">
                {t("ttl.openTasks")}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
