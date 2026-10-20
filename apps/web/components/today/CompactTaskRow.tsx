"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { Id } from "@/convex/_generated/dataModel";

export type CompactTask = {
  _id: Id<"tasks">;
  title: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  projectName?: string;
  timeEstimate?: number;
};

export function CompactTaskRow({ task, onToggle }: { task: CompactTask; onToggle: () => Promise<unknown> }) {
  const { t } = useLocale();
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const done = task.status === "done";
  return <li className="tp-compact-task" data-component="CompactTaskRow" data-done={done}>
    <button className="tp-compact-task__check" type="button" aria-pressed={done} disabled={pending}
      aria-label={t(done ? "mobile.reopen" : "mobile.complete").replace("{title}", task.title)}
      onClick={async () => { if (inFlight.current) return; inFlight.current = true; setPending(true); setError(false); try { await onToggle(); } catch { setError(true); } finally { inFlight.current = false; setPending(false); } }}>
      <span>{done ? <TpIcon name="check" size="sm" /> : null}</span>
    </button>
    <span className="tp-compact-task__title" dir="auto" title={task.title}>{error ? <span role="alert">{t("mobile.toggleError")}</span> : task.title}</span>
    {task.projectName ? <span className="tp-compact-task__project" dir="auto" title={task.projectName}>#{task.projectName}</span> : null}
    {task.timeEstimate ? <span className="tp-compact-task__time tp-num">{Math.max(1, Math.round(task.timeEstimate / 60_000))}{t("mobile.minutesShort")}</span> : null}
  </li>;
}
