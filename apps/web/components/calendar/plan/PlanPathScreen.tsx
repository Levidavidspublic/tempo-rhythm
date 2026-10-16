"use client";

/**
 * "Plan back from a deadline" (S3 PlanPath) and its SessionScheduler (S4).
 *
 * The preview is computed live from `planBack` (packages/core/plan) and nothing is saved until
 * the one primary button, "Add these sessions", calls `plans.createFromPreview`. The Undo toast
 * then gives 5 minutes to take the whole plan back (`plans.undoCreate`).
 */
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeToast, type ToastState, UndoToast, useSignedIn } from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LocalDate } from "../../../../../packages/core/plan/calendar-math";
import { todayLocal } from "../MonthGrid";
import { pt } from "../planCopy";
import { PlanForm, PlanPreview } from "./PlanParts";
import { buildPreview, DEFAULT_FORM, type PlanFormValues, waysOut } from "./planForm";
import { SessionScheduler } from "./SessionScheduler";

export function PlanPathScreen() {
  const { lang } = useLocale();
  const signedIn = useSignedIn();
  const create = useMutation(api.plans.createFromPreview);
  const undoCreate = useMutation(api.plans.undoCreate);
  const plans = useQuery(api.plans.list, signedIn === "ready" ? {} : "skip");

  const [values, setValues] = useState<PlanFormValues>(DEFAULT_FORM);
  // No clock on the server: today is read once the page is in the browser.
  const [today, setToday] = useState<LocalDate | null>(null);
  useEffect(() => setToday(todayLocal()), []);
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"pp.signIn" | "pp.error" | null>(null);
  const [planId, setPlanId] = useState<Id<"studyPlans"> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const topicsRef = useRef<HTMLTextAreaElement>(null);

  const preview = useMemo(
    () => (today ? buildPreview(values, today, lang) : ({ status: "empty" } as const)),
    [values, today, lang]
  );
  const short = preview.status === "ok" && preview.result.shortBy > 0;
  const ways = useMemo(
    () => (short && today ? waysOut(values, today) : null),
    [short, values, today]
  );

  const change = (patch: Partial<PlanFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    if (patch.title !== undefined && patch.title.trim() !== "") setTitleError(false);
    setMessage(null);
  };

  const closeToast = useCallback(() => setToast(null), []);

  const add = async () => {
    if (preview.status !== "ok" || preview.sessions.length === 0 || saving) return;
    if (values.title.trim() === "") {
      setTitleError(true);
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
        sessions: preview.sessions.map((s) => ({
          title: s.label,
          date: s.date,
          startMinute: s.startMinute,
          // Each session's own local start, so a daylight-saving change in the plan is honoured.
          startAt: localStartMs(s.date, s.startMinute),
          minutes: s.minutes,
          kind: s.kind,
        })),
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
      const created = result.planId;
      setPlanId(created);
      setToast({
        ...makeToast(pt(lang, "pp.added", { n: preview.sessions.length }), async () => {
          await undoCreate({ planId: created });
          setPlanId((current) => (current === created ? null : current));
        }),
        undoUntilMs: result.undoUntil,
      });
    } catch {
      setMessage("pp.error");
    } finally {
      setSaving(false);
    }
  };

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
      />

      <div className="tp-plan__actions">
        <button
          className="tp-btn tp-btn--primary"
          type="button"
          disabled={preview.status !== "ok" || preview.sessions.length === 0 || saving}
          aria-busy={saving || undefined}
          onClick={() => void add()}
        >
          <TpIcon name="plus" size="sm" />
          <span>{pt(lang, saving ? "pp.adding" : "pp.add")}</span>
        </button>
        {message ? (
          <p className={message === "pp.error" ? "tp-error-text" : "tp-help"} role="alert">
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
        ) : null}
      </div>

      {signedIn === "ready" && activePlan ? (
        <SessionScheduler key={activePlan} lang={lang} planId={activePlan} />
      ) : null}

      {toast ? <UndoToast onClose={closeToast} toast={toast} /> : null}
    </div>
  );
}

/** Unix ms for a local `YYYY-MM-DD` date and clock minute, in this browser's time zone. */
function localStartMs(date: string, startMinute: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, startMinute).getTime();
}
