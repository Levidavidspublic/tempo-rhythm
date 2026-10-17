"use client";

/**
 * "Plan back from a deadline" (S3 PlanPath) and its SessionScheduler (S4).
 *
 * The preview is computed live from `planBack` (packages/core/plan) and drawn as a GuidedPlanCard
 * (S9): Edit changes the sessions here only, and nothing is saved until the card's one primary
 * button, "Add these sessions", calls `plans.createFromPreview` with the edited sessions. The
 * card then shows Undo for 5 minutes (`plans.undoCreate`) and a To do / Doing / Done status per
 * session (`tasks.update`). Undo always takes the plan back in one click (HARD_RULES §1); when
 * that also took changes made since (sessions marked done or moved), a toast says so in words and
 * offers Bring it back for 5 minutes (`plans.redoUndo`). Reject sets the preview aside until the
 * form changes. While Undo is open the accepted plan stays on the card even if the form changes,
 * so it can't be added twice.
 * Above the form, ReplanPanel offers to move the saved plan's missed or clashing sessions.
 * Offline, a notice says so: the form and its preview still work on the device, while Accept,
 * Undo and "Use these times" send nothing and say why (`acceptBlock`), so no button waits forever.
 */
import { GuidedPlanCard, type GuidedStep, type GuidedStepStatus } from "@tempo/ui";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { OfflineNotice, useOnline, useSignedIn } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToastRoom } from "@/components/study/useToastRoom";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCountdown } from "@/lib/useCountdown";
import type { LocalDate } from "../../../../../packages/core/plan/calendar-math";
import { todayLocal } from "../MonthGrid";
import { pt, shortDate } from "../planCopy";
import { busyWindows } from "./busyWindows";
import { PlanForm, PlanPreview } from "./PlanParts";
import { useBusyTime } from "./planApi";
import { ReplanArea } from "./ReplanPanel";
import {
  acceptBlock,
  bringBackOffer,
  buildPreview,
  busyByDate,
  DEFAULT_FORM,
  firstStartToday,
  guidedLabels,
  type PlanFormValues,
  previewKey,
  sessionsFromSteps,
  shownDecision,
  toGuidedSteps,
  waysOut,
} from "./planForm";
import { SessionScheduler } from "./SessionScheduler";

export function PlanPathScreen() {
  const { lang } = useLocale();
  const signedIn = useSignedIn();
  const online = useOnline();
  const create = useMutation(api.plans.createFromPreview);
  const undoCreate = useMutation(api.plans.undoCreate);
  const redoUndo = useMutation(api.plans.redoUndo);
  const updateTask = useMutation(api.tasks.update);
  const plans = useQuery(api.plans.list, signedIn === "ready" ? {} : "skip");

  const [values, setValues] = useState<PlanFormValues>(DEFAULT_FORM);
  // No clock on the server: today and the time are read once the page is in the browser, and
  // again whenever the form changes, so today's sessions never start before now.
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => setClock(readClock()), []);
  const today = clock?.today ?? null;
  const nowMinute = clock?.minute;
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  // Back online: the "you're offline" words next to the card have done their job.
  useEffect(() => {
    if (online) setMessage((m) => (m === "pp.offline.add" || m === "pp.offline.undo" ? null : m));
  }, [online]);
  const [planId, setPlanId] = useState<Id<"studyPlans"> | null>(null);
  // What happened to which preview: a new preview (another key) is a fresh proposal.
  const [decision, setDecision] = useState<Decision | null>(null);
  // Statuses tapped on this screen, shown at once while the saved ones catch up.
  const [tapped, setTapped] = useState<Record<string, GuidedStepStatus>>({});
  const topicsRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // After an Undo that took changes made since: that plan, until Bring it back closes.
  const [bringBack, setBringBack] = useState<{ decision: Decision; until: number } | null>(null);
  const bringBackRef = useRef<HTMLDivElement>(null);
  useToastRoom(bringBack);

  // What is already on the calendar from today up to the deadline (read only), so the plan only
  // uses the time that is left on each day. Events come in windows of at most 31 days, which
  // `calendar_events.listInRange` accepts however far off the date is (busyWindows.ts).
  const planWindow =
    signedIn === "ready" && today !== null ? busyWindows(today, values.deadline) : null;
  const { events: fixedEvents, tasks: dueTasks } = useBusyTime(planWindow);
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
    () =>
      today ? buildPreview(values, today, lang, busy, nowMinute) : ({ status: "empty" } as const),
    [values, today, lang, busy, nowMinute]
  );
  const short = preview.status === "ok" && preview.result.shortBy > 0;
  const ways = useMemo(
    () => (short && today ? waysOut(values, today, busy, nowMinute) : null),
    [short, values, today, busy, nowMinute]
  );

  const change = (patch: Partial<PlanFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setClock((current) => {
      const next = readClock();
      return current?.today === next.today && current.minute === next.minute ? current : next;
    });
    if (patch.title !== undefined && patch.title.trim() !== "") setTitleError(false);
    setMessage(null);
  };

  const okSessions = preview.status === "ok" ? preview.sessions : null;
  const key = okSessions ? previewKey(okSessions) : "";
  // While Undo is open the accepted plan stays on the card, whatever the form says now.
  const undoLeft = useCountdown(decision?.status === "accepted" ? decision.undoUntil : undefined);
  const shown = shownDecision(decision, key, undoLeft !== null);
  const current = shown.decision;
  const pinned = shown.pinned ? shown.decision : null;
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
    // A plan whose Undo is still open is already saved: never add it (or a changed copy) twice.
    const block = acceptBlock({
      sessions: sessions.length,
      saving,
      pinned: pinned !== null,
      title: values.title,
      signedIn,
      online,
    });
    if (block === "skip") return;
    if (block) {
      // A missing name is flagged on the field, and said again next to the button that was pressed.
      if (block === "pp.err.title") setTitleError(true);
      setMessage(block);
      return;
    }
    setSaving(true);
    setMessage(null);
    // A new plan is the card's now: the one an earlier Undo took stays gone.
    setBringBack(null);
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
        steps,
        title: values.title.trim(),
      });
    } catch {
      setMessage("pp.error");
    } finally {
      setSaving(false);
    }
  };

  const undo = async () => {
    if (!current?.planId || saving) return;
    if (!online) {
      setMessage("pp.offline.undo");
      return;
    }
    const taken = current.planId;
    setSaving(true);
    setMessage(null);
    try {
      const answer = await undoCreate({ planId: taken });
      setPlanId((id) => (id === taken ? null : id));
      setDecision({ ...current, status: "undone" });
      setBringBack(bringBackOffer(answer, current, Date.now()));
    } catch {
      setMessage("pp.g.undoError");
    } finally {
      setSaving(false);
    }
  };

  // Bring it back: the plan and the sessions the Undo took return, and the card shows it again.
  const bringItBack = async () => {
    const back = bringBack?.decision;
    const backId = back?.planId;
    if (!back || !backId) return;
    await redoUndo({ planId: backId });
    setPlanId(backId);
    setTapped({});
    setDecision({ ...back, status: "accepted" });
  };
  // When the toast closes with the keyboard in it, the keyboard goes to the page heading.
  const closeBringBack = () => {
    const active = document.activeElement;
    if (!active || active === document.body || bringBackRef.current?.contains(active)) {
      window.setTimeout(() => headingRef.current?.focus(), 0);
    }
    setBringBack(null);
  };

  const reject = () => {
    setMessage(null);
    setDecision({ key, status: "rejected", stepIds: [], steps: [], title: "" });
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

  const card = (cardKey: string, title: string, steps: GuidedStep[]) => (
    <GuidedPlanCard
      key={cardKey}
      title={title}
      steps={steps}
      labels={labels}
      status={cardStatus}
      busy={saving}
      undoUntilMs={current?.undoUntil}
      stepStatuses={stepStatuses}
      formatDate={(date) => shortDate(lang, date as LocalDate)}
      message={messageNode}
      onAccept={(accepted) => void accept(accepted)}
      onReject={reject}
      onUndo={() => void undo()}
      onStepStatus={saved ? (id, status) => void setStepStatus(id, status) : undefined}
    />
  );

  return (
    <div className="tp-page tp-page--wide tp-plan" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <p className="tp-eyebrow">{pt(lang, "pp.eyebrow")}</p>
          <h1 className="tp-pagehead__title" ref={headingRef} tabIndex={-1}>
            {pt(lang, "pp.title")}
          </h1>
          <p className="tp-pagehead__sub">{pt(lang, "pp.sub")}</p>
        </div>
      </header>
      {online ? null : <OfflineNotice text={pt(lang, "pp.offline")} />}

      {signedIn === "ready" ? (
        <ReplanArea
          lang={lang}
          planId={activePlan}
          headingRef={headingRef}
          online={online}
          // The plan card's "Add these sessions" is the screen's one primary while it is offered.
          primary={!(preview.status === "ok" && cardStatus === "pending")}
        />
      ) : null}

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
        checkedUntil={planWindow?.checkedUntil ?? null}
        pinned={
          pinned ? card(pinned.key, pinned.title || pt(lang, "pp.preview.h"), pinned.steps) : null
        }
        renderSessions={(sessions) =>
          card(key, values.title.trim() || pt(lang, "pp.preview.h"), toGuidedSteps(sessions, lang))
        }
      />

      {signedIn === "ready" && activePlan ? (
        <SessionScheduler key={activePlan} lang={lang} planId={activePlan} />
      ) : null}

      {bringBack ? (
        <div className="tp-plan__toast" ref={bringBackRef}>
          <UndoToast
            key={bringBack.decision.planId}
            title={pt(lang, "pp.g.undoneEdited")}
            untilMs={bringBack.until}
            onUndo={bringItBack}
            onClose={closeBringBack}
            labels={{
              action: pt(lang, "pp.g.bringBack"),
              sub: pt(lang, "pp.g.bringBackSub"),
              error: pt(lang, "pp.g.bringBackError"),
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Today and the first start left today (now, rounded up to the quarter hour). */
type Clock = { today: LocalDate; minute: number };

function readClock(now: Date = new Date()): Clock {
  return {
    today: todayLocal(now),
    minute: firstStartToday(now.getHours() * 60 + now.getMinutes()),
  };
}

type Message =
  | "pp.signIn"
  | "pp.error"
  | "pp.err.title"
  | "pp.offline.add"
  | "pp.offline.undo"
  | "pp.g.undoError"
  | "pp.g.statusError";

type Decision = {
  /** The preview this decision belongs to (`previewKey`). */
  key: string;
  status: "accepted" | "undone" | "rejected";
  planId?: Id<"studyPlans">;
  undoUntil?: number;
  /** The accepted steps' ids, in the order their tasks were made. */
  stepIds: string[];
  /** The accepted steps and plan name, drawn while Undo is open even if the form changes. */
  steps: GuidedStep[];
  title: string;
};

/** Unix ms for a local `YYYY-MM-DD` date and clock minute, in this browser's time zone. */
function localStartMs(date: string, startMinute: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, startMinute).getTime();
}
