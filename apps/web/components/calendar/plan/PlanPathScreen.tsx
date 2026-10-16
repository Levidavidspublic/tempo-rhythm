"use client";

/**
 * "Plan back from a deadline" (S3 PlanPath) and its SessionScheduler (S4).
 *
 * The preview is computed live from `planBack` (packages/core/plan) and drawn as a GuidedPlanCard
 * (S9): Edit changes the sessions here only, and nothing is saved until the card's one primary
 * button, "Add these sessions", calls `plans.createFromPreview` with the edited sessions. The
 * card then shows Undo for 5 minutes (`plans.undoCreate`) and a To do / Doing / Done status per
 * session (`tasks.update`). Reject sets the preview aside until the form changes.
 */
import { GuidedPlanCard, type GuidedStep, type GuidedStepStatus } from "@tempo/ui";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSignedIn } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  isLocalDate,
  type LocalDate,
  toDayNumber,
} from "../../../../../packages/core/plan/calendar-math";
import { localSlotToMs } from "../gridData";
import { todayLocal } from "../MonthGrid";
import { pt, shortDate } from "../planCopy";
import { PlanForm, PlanPreview } from "./PlanParts";
import {
  buildPreview,
  busyByDate,
  DEFAULT_FORM,
  guidedLabels,
  type PlanFormValues,
  previewKey,
  sessionsFromSteps,
  toGuidedSteps,
  waysOut,
} from "./planForm";
import { SessionScheduler } from "./SessionScheduler";

export function PlanPathScreen() {
  const { lang } = useLocale();
  const signedIn = useSignedIn();
  const create = useMutation(api.plans.createFromPreview);
  const undoCreate = useMutation(api.plans.undoCreate);
  const updateTask = useMutation(api.tasks.update);
  const plans = useQuery(api.plans.list, signedIn === "ready" ? {} : "skip");

  const [values, setValues] = useState<PlanFormValues>(DEFAULT_FORM);
  // No clock on the server: today is read once the page is in the browser.
  const [today, setToday] = useState<LocalDate | null>(null);
  useEffect(() => setToday(todayLocal()), []);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [planId, setPlanId] = useState<Id<"studyPlans"> | null>(null);
  // What happened to which preview: a new preview (another key) is a fresh proposal.
  const [decision, setDecision] = useState<Decision | null>(null);
  // Statuses tapped on this screen, shown at once while the saved ones catch up.
  const [tapped, setTapped] = useState<Record<string, GuidedStepStatus>>({});
  const topicsRef = useRef<HTMLTextAreaElement>(null);

  // What is already on the calendar from today up to the deadline (read only), so the plan only
  // uses the time that is left on each day.
  const planWindow =
    signedIn === "ready" &&
    today !== null &&
    isLocalDate(values.deadline) &&
    toDayNumber(values.deadline) > toDayNumber(today)
      ? { startMs: localSlotToMs(today, 0), endMs: localSlotToMs(values.deadline, 0) }
      : null;
  const fixedEvents = useQuery(api.calendar_events.listInRange, planWindow ?? "skip");
  const dueTasks = useQuery(api.tasks.listDueInRange, planWindow ?? "skip");
  const hasWindow = planWindow !== null;
  const planTitle = values.title.trim();
  const busy = useMemo(
    () =>
      hasWindow && (fixedEvents || dueTasks)
        ? busyByDate({
            events: (fixedEvents ?? []).map((e) => ({
              id: e._id,
              title: e.title,
              startsAtMs: e.startsAtMs,
            })),
            // This plan's own sessions (saved under its title) are not busy time for itself, so
            // the preview doesn't reflow right after "Add these sessions".
            tasks: (dueTasks ?? []).filter(
              (task) => !planTitle || task.projectName !== planTitle
            ),
          })
        : undefined,
    [hasWindow, fixedEvents, dueTasks, planTitle]
  );

  const preview = useMemo(
    () => (today ? buildPreview(values, today, lang, busy) : ({ status: "empty" } as const)),
    [values, today, lang, busy]
  );
  const short = preview.status === "ok" && preview.result.shortBy > 0;
  const ways = useMemo(
    () => (short && today ? waysOut(values, today, busy) : null),
    [short, values, today, busy]
  );

  const change = (patch: Partial<PlanFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    if (patch.title !== undefined && patch.title.trim() !== "") setTitleError(false);
    setMessage(null);
  };

  const okSessions = preview.status === "ok" ? preview.sessions : null;
  const key = okSessions ? previewKey(okSessions) : "";
  const current = decision && decision.key === key ? decision : null;
  const cardStatus = current?.status ?? "pending";
  const labels = useMemo(() => guidedLabels(lang), [lang]);

  // The saved plan's tasks, for each session's status once the plan is accepted.
  const saved = useQuery(
    api.plans.get,
    current?.status === "accepted" && current.planId ? { planId: current.planId } : "skip"
  );
  const stepStatuses = useMemo(() => {
    const out: Record<string, GuidedStepStatus> = {};
    if (!current || current.status !== "accepted" || !saved) return out;
    const byTask = new Map(saved.tasks.map((task) => [task._id, task.status]));
    current.stepIds.forEach((stepId, index) => {
      const taskId = saved.plan.taskIds[index];
      const status = taskId ? byTask.get(taskId) : undefined;
      if (status === "done") out[stepId] = "done";
      else if (status === "in_progress") out[stepId] = "doing";
      else if (status === "todo") out[stepId] = "todo";
    });
    return { ...out, ...tapped };
  }, [current, saved, tapped]);

  const accept = async (steps: GuidedStep[]) => {
    const sessions = sessionsFromSteps(steps);
    if (sessions.length === 0 || saving) return;
    if (values.title.trim() === "") {
      // Flagged on the field, and said again next to the button that was pressed.
      setTitleError(true);
      setMessage("pp.err.title");
      return;
    }
    if (signedIn !== "ready") {
      setMessage("pp.signIn");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await create({
        title: values.title.trim(),
        deadline: values.deadline,
        sessions: sessions.map((s) => ({
          ...s,
          // Each session's own local start, so a daylight-saving change in the plan is honoured.
          startAt: localStartMs(s.date, s.startMinute),
        })),
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
      setPlanId(result.planId);
      setTapped({});
      setDecision({
        key,
        status: "accepted",
        planId: result.planId,
        undoUntil: result.undoUntil,
        stepIds: steps.map((step) => step.id),
      });
    } catch {
      setMessage("pp.error");
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    if (!current?.planId || saving) return;
    const taken = current.planId;
    setSaving(true);
    setMessage(null);
    try {
      await undoCreate({ planId: taken });
      setPlanId((id) => (id === taken ? null : id));
      setDecision({ ...current, status: "undone" });
    } catch {
      setMessage("pp.g.undoError");
    } finally {
      setSaving(false);
    }
  };

  const reject = () => {
    setMessage(null);
    setDecision({ key, status: "rejected", stepIds: [] });
  };

  const setStepStatus = async (stepId: string, status: GuidedStepStatus) => {
    const index = current?.stepIds.indexOf(stepId) ?? -1;
    const taskId = index >= 0 ? saved?.plan.taskIds[index] : undefined;
    if (!taskId) return;
    const before = stepStatuses[stepId];
    setTapped((map) => ({ ...map, [stepId]: status }));
    setMessage(null);
    try {
      await updateTask({ taskId, status: status === "doing" ? "in_progress" : status });
    } catch {
      setTapped((map) => {
        const next = { ...map };
        if (before) next[stepId] = before;
        else delete next[stepId];
        return next;
      });
      setMessage("pp.g.statusError");
    }
  };

  const messageNode = message ? (
    <p className={message === "pp.signIn" ? "tp-help" : "tp-error-text"} role="alert">
      <span>{pt(lang, message)}</span>
      {message === "pp.signIn" ? (
        <>
          {" "}
          <a className="tp-btn--link" href="/sign-in?redirect=/study/plan">
            {pt(lang, "pp.signInLink")}
          </a>
        </>
      ) : null}
    </p>
  ) : null;

  const activePlan = planId ?? plans?.[0]?._id ?? null;

  return (
    <div className="tp-page tp-page--wide tp-plan" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-eyebrow">{pt(lang, "pp.eyebrow")}</p>
          <h1 className="tp-pagehead__title">{pt(lang, "pp.title")}</h1>
          <p className="tp-pagehead__sub">{pt(lang, "pp.sub")}</p>
        </div>
      </header>

      <PlanForm
        lang={lang}
        onChange={change}
        titleError={titleError}
        topicsRef={topicsRef}
        values={values}
      />

      <PlanPreview
        lang={lang}
        onEditTopics={() => topicsRef.current?.focus()}
        onUseDate={(deadline) => change({ deadline })}
        onUseMinutes={(minutesPerDay) => change({ minutesPerDay })}
        state={preview}
        ways={ways}
        renderSessions={(sessions) => (
          <GuidedPlanCard
            key={key}
            title={values.title.trim() || pt(lang, "pp.preview.h")}
            steps={toGuidedSteps(sessions, lang)}
            labels={labels}
            status={cardStatus}
            busy={saving}
            undoUntilMs={current?.undoUntil}
            stepStatuses={stepStatuses}
            formatDate={(date) => shortDate(lang, date as LocalDate)}
            message={messageNode}
            onAccept={(steps) => void accept(steps)}
            onReject={reject}
            onUndo={() => void undo()}
            onStepStatus={saved ? (id, status) => void setStepStatus(id, status) : undefined}
          />
        )}
      />

      {signedIn === "ready" && activePlan ? (
        <SessionScheduler key={activePlan} lang={lang} planId={activePlan} />
      ) : null}
    </div>
  );
}

type Message = "pp.signIn" | "pp.error" | "pp.err.title" | "pp.g.undoError" | "pp.g.statusError";

type Decision = {
  /** The preview this decision belongs to (`previewKey`). */
  key: string;
  status: "accepted" | "undone" | "rejected";
  planId?: Id<"studyPlans">;
  undoUntil?: number;
  /** The accepted steps' ids, in the order their tasks were made. */
  stepIds: string[];
};

/** Unix ms for a local `YYYY-MM-DD` date and clock minute, in this browser's time zone. */
function localStartMs(date: string, startMinute: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, startMinute).getTime();
}
