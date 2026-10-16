"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { dayLabel, groupByLocalDay, todayDueAt } from "./carryOver";

const INITIAL_ROWS = 5;

type PendingAction = "complete" | "move";

/**
 * Still open from earlier days, on Today (v3 Section + Checkbox rows): tick it done or move it to
 * today. A long title wraps; a tick or move that doesn't go through says so on its row.
 */
export function CarryOverStrip() {
  const { t } = useLocale();
  const { isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const bounds = useLocalDayBounds();
  const tasks = useQuery(
    api.dayPlans.listCarryOver,
    isAuthenticated && profile ? { beforeMs: bounds.startMs } : "skip",
  );
  const moveTaskToDay = useMutation(api.dayPlans.moveTaskToDay);
  const toggleCompletion = useMutation(api.tasks.toggleCompletion);
  const [showAll, setShowAll] = useState(false);
  // Rows with a completion or move in flight. Kept until the row leaves the
  // list so a second tap cannot toggle a just-completed task back to todo.
  // The action kind is kept so only a completion shows the box as checked.
  const [pending, setPending] = useState<ReadonlyMap<string, PendingAction>>(() => new Map());
  const [failedId, setFailedId] = useState<string | null>(null);

  const runOnce = (taskId: string, kind: PendingAction, action: () => Promise<unknown>) => {
    if (pending.has(taskId)) return;
    setFailedId(null);
    setPending((prev) => new Map(prev).set(taskId, kind));
    action().catch(() => {
      setFailedId(taskId);
      setPending((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    });
  };

  if (!tasks || tasks.length === 0) return null;

  // Newest day first so the row cap keeps the most recent days.
  const rows = groupByLocalDay(tasks).flatMap((group) =>
    group.tasks.map((task) => ({ task, dayStartMs: group.dayStartMs })),
  );
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);
  const hiddenCount = rows.length - visible.length;

  return (
    <section className="tp-surface co-strip" aria-labelledby="carry-over-heading" data-component="CarryOver">
      <div className="tp-section__head">
        <h2 id="carry-over-heading" className="tp-section__title">
          {t("co.title")}
        </h2>
        <span className="tp-section__count tp-num">{rows.length}</span>
      </div>
      <ul className="tp-checklist">
        {visible.map(({ task, dayStartMs }) => {
          const pendingAction = pending.get(task._id);
          const isPending = pendingAction !== undefined;
          return (
            <li key={task._id} className="tp-checklist__item co-row">
              <label className="tp-choice co-row__check">
                <input
                  type="checkbox"
                  className="tp-checkbox"
                  checked={pendingAction === "complete"}
                  disabled={isPending}
                  onChange={() => {
                    runOnce(task._id, "complete", () => toggleCompletion({ taskId: task._id }));
                  }}
                  aria-label={`Mark ${task.title} complete`}
                />
                <span className="tp-choice__text">
                  <span className="tp-checklist__text co-row__title" dir="auto">
                    {task.title}
                  </span>
                  <span className="tp-choice__hint">{dayLabel(dayStartMs)}</span>
                </span>
              </label>
              <button
                type="button"
                className="tp-btn tp-btn--secondary tp-btn--sm"
                disabled={isPending}
                onClick={() => {
                  runOnce(task._id, "move", () => moveTaskToDay({ taskId: task._id, dueAt: todayDueAt(Date.now()) }));
                }}
              >
                {t("co.move")}
              </button>
              {failedId === task._id ? (
                <p className="tp-error-text co-row__error" role="alert">
                  <TpIcon name="alert" size="sm" />
                  <span>{t("co.error")}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 ? (
        <button type="button" className="tp-btn tp-btn--link" onClick={() => setShowAll(true)}>
          {t("co.more").replace("{n}", String(hiddenCount))}
        </button>
      ) : null}
    </section>
  );
}
