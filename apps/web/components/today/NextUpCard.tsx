"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useShellSlots } from "@/components/tempo/ShellSlots";
import { TpIcon } from "@/components/tempo/TpIcon";
import { focusMinutes, formatClock, type NextUpTask, nextUpReason, pickNextUp } from "@/lib/next-up";

type Timer = { taskId: string; endsAt: number; pausedLeft: number | null };

/**
 * NextUpCard (today.html): ONE open task with a short reason. Start runs a local focus timer
 * (Pause / Resume), Not now shows the next open task, Make it smaller opens the coach.
 * Nothing here writes; ticking a task stays in the task list and the page.
 */
export function NextUpCard({ tasks }: { tasks: readonly NextUpTask[] }) {
  const { t } = useLocale();
  const shell = useShellSlots();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [timer, setTimer] = useState<Timer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const task = useMemo(() => pickNextUp(tasks, skipped), [tasks, skipped]);
  // A countdown that reached its deadline is finished: no ticking, Start is offered again.
  const running =
    timer !== null && timer.pausedLeft === null && timer.taskId === task?._id && now < timer.endsAt;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  if (!task) {
    return (
      <div className="tp-nextup" data-component="NextUpCard">
        <span className="tp-eyebrow" id="nextup-eyebrow">{t("next.eyebrow")}</span>
        <p className="tp-nextup__why">{t("next.allClear")}</p>
      </div>
    );
  }

  const minutes = focusMinutes(task);
  const mine = timer && timer.taskId === task._id ? timer : null;
  const left = mine ? (mine.pausedLeft ?? Math.max(0, mine.endsAt - now)) : null;
  const done = left !== null && left <= 0;

  const start = () => {
    const at = Date.now();
    setNow(at);
    setTimer({ taskId: task._id, endsAt: at + minutes * 60_000, pausedLeft: null });
  };
  const pause = () => mine && setTimer({ ...mine, pausedLeft: Math.max(0, mine.endsAt - Date.now()) });
  const resume = () => {
    if (!mine || mine.pausedLeft === null) return;
    const at = Date.now();
    setNow(at);
    setTimer({ ...mine, endsAt: at + mine.pausedLeft, pausedLeft: null });
  };
  const notNow = () => {
    setTimer(null);
    setSkipped((prev) => {
      const next = new Set(prev);
      // Once every open task was skipped, start the round again.
      if (tasks.filter((x) => x.status === "todo" || x.status === "in_progress").every((x) => next.has(x._id))) {
        next.clear();
      }
      next.add(task._id);
      return next;
    });
  };

  return (
    <div className="tp-nextup" data-component="NextUpCard">
      <span className="tp-eyebrow" id="nextup-eyebrow">{t("next.eyebrow")}</span>
      <h2 className="tp-nextup__title" id="nextup-title" dir="auto">
        {task.title}
      </h2>
      <p className="tp-nextup__why">{t(nextUpReason(task))}</p>
      <div className="tp-nextup__meta">
        <span className="tp-chip" data-component="Chip">
          <TpIcon name="clock" size="sm" />
          {left !== null && !done ? (
            <span className="tp-num" role="timer" aria-live="off">
              {formatClock(left)} {t("next.left")}
            </span>
          ) : (
            <span>
              <span className="tp-num">{minutes}</span> {t("next.min")}
            </span>
          )}
        </span>
        {task.energy ? (
          <span className="tp-chip" data-component="Chip">
            <TpIcon name="energy" size="sm" />
            <span>{t(`next.energy.${task.energy}`)}</span>
          </span>
        ) : null}
      </div>
      <div className="tp-nextup__actions">
        {running ? (
          <button className="tp-btn tp-btn--primary" type="button" onClick={pause}>
            <TpIcon name="pause" size="sm" />
            <span>{t("next.pause")}</span>
          </button>
        ) : mine && mine.pausedLeft !== null && !done ? (
          <button className="tp-btn tp-btn--primary" type="button" onClick={resume}>
            <TpIcon name="play" size="sm" />
            <span>{t("next.resume")}</span>
          </button>
        ) : (
          <button className="tp-btn tp-btn--primary" type="button" onClick={start}>
            <TpIcon name="play" size="sm" />
            <span>{t("next.start").replace("{n}", String(minutes))}</span>
          </button>
        )}
        <button className="tp-btn tp-btn--secondary" type="button" onClick={notNow}>
          {t("next.notNow")}
        </button>
        {shell?.coachAvailable ? (
          <button className="tp-btn tp-btn--ghost" type="button" aria-expanded={shell.coachOpen} onClick={shell.openCoach}>
            {t("next.smaller")}
          </button>
        ) : (
          <Link className="tp-btn tp-btn--ghost" href="/coach">
            {t("next.smaller")}
          </Link>
        )}
      </div>
    </div>
  );
}
