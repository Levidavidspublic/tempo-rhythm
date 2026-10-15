"use client";

import { DecisionSteps, type DecisionStep } from "@tempo/ui/blocks/decision-steps";
import { useMutation } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { useFlushCoachPage } from "./CoachPage";

/** A change the coach proposes: one new task, page or template. */
type ChangeData =
  | { kind: "task"; title: string; minutes: number; when: "today" | "later" }
  | { kind: "note"; title: string; body: string }
  | { kind: "template"; name: string; body: string; period: "daily" | "weekly" | "none" };

/** An order for things the person already has to do; saving it adds the steps to today's page. */
type DecisionData = { kind: "decision"; title?: string; steps: DecisionStep[] };

export type ChatProposalData = ChangeData | DecisionData;

type ProposalStatus = {
  status: "pending" | "accepted" | "rejected" | "undone";
  createdId?: string;
  undoUntilMs?: number;
};

export type ChatProposalState = ChatProposalData & ProposalStatus;
type ChangeState = ChangeData & ProposalStatus;
type DecisionState = DecisionData & ProposalStatus;

function isStep(value: unknown): value is DecisionStep {
  if (!value || typeof value !== "object") return false;
  const step = value as Record<string, unknown>;
  return typeof step.title === "string" && typeof step.minutes === "number";
}

/** The proposal stored on a coach reply (`toolCalls.coachProposal`), or null. */
export function proposalOf(toolCalls: unknown): ChatProposalState | null {
  if (!toolCalls || typeof toolCalls !== "object") return null;
  const raw = (toolCalls as { coachProposal?: unknown }).coachProposal;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as ChatProposalState;
  const known =
    p.kind === "task" ||
    p.kind === "note" ||
    p.kind === "template" ||
    (p.kind === "decision" && Array.isArray(p.steps) && p.steps.every(isStep));
  return known && typeof p.status === "string" ? p : null;
}

const KIND_ICON: Record<ChangeData["kind"], TpIconName> = { task: "task", note: "page", template: "template" };

/** The first line of a body, as plain words. */
function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim()) ?? "";
  return line.replace(/^\s*(#{1,6}\s|[-*+]\s(\[[ xX]\]\s)?|\d+[.)]\s|>\s?)/, "").trim().slice(0, 120);
}

/** The fields a person can change before Accept. The kind never changes. */
type ProposalDraft = {
  title: string;
  minutes: string;
  when: "today" | "later";
  name: string;
  body: string;
  period: "daily" | "weekly" | "none";
};

function draftOf(p: ChangeData): ProposalDraft {
  return {
    title: p.kind === "template" ? "" : p.title,
    minutes: p.kind === "task" ? String(p.minutes) : "",
    when: p.kind === "task" ? p.when : "today",
    name: p.kind === "template" ? p.name : "",
    body: p.kind === "task" ? "" : p.body,
    period: p.kind === "template" ? p.period : "none",
  };
}

/** The `edit` argument of `coach.acceptProposal` for this kind, or null when a field is empty. */
function editOf(kind: ChangeData["kind"], d: ProposalDraft) {
  if (kind === "task") {
    const minutes = Number(d.minutes);
    return d.title.trim() && Number.isFinite(minutes) && minutes >= 1
      ? { title: d.title, minutes, when: d.when }
      : null;
  }
  if (kind === "note") return d.title.trim() && d.body.trim() ? { title: d.title, body: d.body } : null;
  return d.name.trim() && d.body.trim() ? { name: d.name, body: d.body, period: d.period } : null;
}

/** m:ss until `untilMs`, counting down each second while it lasts. */
function useCountdown(untilMs: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  const live = untilMs !== undefined && now < untilMs;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);
  if (!live || untilMs === undefined) return null;
  const s = Math.ceil((untilMs - now) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The card for a coach proposal: a decision card for an order, a ProposalCard for a change. */
export function ChatProposal({ messageId, proposal }: { messageId: Id<"messages">; proposal: ChatProposalState }) {
  return proposal.kind === "decision" ? (
    <DecisionProposal messageId={messageId} proposal={proposal} />
  ) : (
    <ChangeProposal messageId={messageId} proposal={proposal} />
  );
}

/**
 * The decision card (weekend alpha run, L5): the coach's answer to "what order should I do these
 * in?", each step drawn as the catalog's TaskBlock through json-render. Nothing changes until
 * Save to today, which saves the page's pending edits first, then adds these exact steps to the
 * end of today's page; Undo takes them off again for 5 minutes (HARD_RULES §1, §6.2).
 */
function DecisionProposal({ messageId, proposal }: { messageId: Id<"messages">; proposal: DecisionState }) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const flushPage = useFlushCoachPage();
  const accept = useMutation(api.coach.acceptProposal);
  const reject = useMutation(api.coach.rejectProposal);
  const undo = useMutation(api.coach.undoProposal);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const left = useCountdown(proposal.status === "accepted" ? proposal.undoUntilMs : undefined);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  // Today's page saves 500 ms after typing stops. Save it first, so its next save can't write
  // over the steps this adds.
  const save = () =>
    act(async () => {
      await flushPage();
      await accept({ messageId, todayDate: localIsoDate(new Date(bounds.startMs)) });
    });
  // Undo the same way: a save still waiting would write the removed steps back.
  const takeBack = () =>
    act(async () => {
      await flushPage();
      await undo({ messageId });
    });

  const titleId = `proposal-${messageId}`;
  return (
    <section
      className="tp-proposal"
      data-component="DecisionCard"
      data-kind="decision"
      data-status={proposal.status}
      aria-labelledby={titleId}
    >
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name="sort" size="sm" />
          <span>{t("proposal.kind.decision")}</span>
        </span>
        <strong id={titleId} dir="auto">
          {proposal.title ?? t("proposal.title.decision")}
        </strong>
        <span className="tp-proposal__target">{t("proposal.target.today")}</span>
      </div>
      <DecisionSteps steps={proposal.steps} labels={{ list: t("proposal.decision.list"), minutes: t("proposal.min") }} />
      {proposal.status === "pending" ? (
        <div className="tp-proposal__actions">
          <button className="tp-btn tp-btn--secondary" type="button" disabled={busy} onClick={() => void save()}>
            <TpIcon name="check" size="sm" />
            <span>{t("proposal.decision.save")}</span>
          </button>
          <button className="tp-btn tp-btn--ghost" type="button" disabled={busy} onClick={() => void act(() => reject({ messageId }))}>
            <span>{t("proposal.reject")}</span>
          </button>
        </div>
      ) : (
        <p className="tp-proposal__note">
          <TpIcon name={proposal.status === "accepted" ? "check" : "undo"} size="sm" />
          <span>
            {proposal.status === "accepted"
              ? left
                ? t("proposal.decision.saved")
                : t("proposal.decision.kept")
              : proposal.status === "undone"
                ? t("proposal.undone")
                : t("proposal.rejected")}
          </span>
          {proposal.status === "accepted" ? (
            // The page that got the steps: on a later day /today is another page.
            <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={proposal.createdId ? `/notes/${proposal.createdId}` : "/today"}>
              {t("proposal.open")}
            </Link>
          ) : null}
          {left ? (
            <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={busy} onClick={() => void takeBack()}>
              <TpIcon name="undo" size="sm" />
              <span>{t("proposal.undo")}</span>
              <span className="tp-num tp-mono" aria-hidden="true">
                {left}
              </span>
            </button>
          ) : null}
        </p>
      )}
      {failed ? (
        <p className="tp-proposal__note" role="alert">
          {t("proposal.decision.error")}
        </p>
      ) : null}
    </section>
  );
}

/**
 * ProposalCard (coach-thread.html): the exact change the coach proposes. Nothing changes until
 * Accept; after Accept, Undo stays for 5 minutes (HARD_RULES §1, §6.2).
 */
function ChangeProposal({ messageId, proposal }: { messageId: Id<"messages">; proposal: ChangeState }) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const accept = useMutation(api.coach.acceptProposal);
  const reject = useMutation(api.coach.rejectProposal);
  const undo = useMutation(api.coach.undoProposal);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProposalDraft>(() => draftOf(proposal));
  const [invalid, setInvalid] = useState(false);
  const formId = useId();
  const set = (patch: Partial<ProposalDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const left = useCountdown(proposal.status === "accepted" ? proposal.undoUntilMs : undefined);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const acceptEdits = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const edit = editOf(proposal.kind, draft);
    setInvalid(edit === null);
    if (!edit) return;
    void act(() => accept({ messageId, dueTodayAt: bounds.endMs - 1, edit }));
  };

  const titleId = `proposal-${messageId}`;
  const href =
    proposal.status === "accepted" && proposal.createdId
      ? proposal.kind === "note"
        ? `/notes/${proposal.createdId}`
        : proposal.kind === "template"
          ? "/templates"
          : proposal.when === "today"
            ? "/today"
            : "/tasks"
      : null;
  const target =
    proposal.kind === "task"
      ? proposal.when === "today"
        ? t("proposal.target.today")
        : t("nav.tasks")
      : proposal.kind === "note"
        ? t("nav.notes")
        : t("nav.templates");

  return (
    <section
      className="tp-proposal"
      data-component="ProposalCard"
      data-kind={proposal.kind}
      data-status={proposal.status}
      aria-labelledby={titleId}
    >
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name={KIND_ICON[proposal.kind]} size="sm" />
          <span>{t(`proposal.kind.${proposal.kind}`)}</span>
        </span>
        <strong id={titleId}>{t(`proposal.title.${proposal.kind}`)}</strong>
        <span className="tp-proposal__target">{target}</span>
      </div>
      {proposal.kind === "task" ? (
        <ul className="tp-proposal__changes">
          <li className="tp-change" data-op="add" data-component="ChangePreview">
            <span className="tp-change__sign">
              <TpIcon name="plus" size="sm" />
              <span>{t("proposal.add")}</span>
            </span>
            <span className="tp-change__body">
              <span className="tp-change__title" dir="auto">
                {proposal.title}
              </span>
              <span className="tp-change__detail">
                {t("proposal.kind.task")} · <span className="tp-num">{proposal.minutes}</span> {t("proposal.min")}
              </span>
            </span>
          </li>
        </ul>
      ) : (
        <dl className="tp-proposal__what">
          <div className="tp-what-row">
            <dt>{t("proposal.name")}</dt>
            <dd>
              <span className="tp-change__title" dir="auto">
                {proposal.kind === "note" ? proposal.title : proposal.name}
              </span>
            </dd>
          </div>
          <div className="tp-what-row">
            <dt>{t("proposal.startsWith")}</dt>
            <dd dir="auto">{firstLine(proposal.body)}</dd>
          </div>
          {proposal.kind === "template" ? (
            // Accept stores this as the template's page type, so it is part of the preview.
            <div className="tp-what-row">
              <dt>{t("proposal.field.period")}</dt>
              <dd>{t(`proposal.period.${proposal.period}`)}</dd>
            </div>
          ) : null}
        </dl>
      )}
      {proposal.status === "pending" && proposal.kind !== "task" && !editing ? (
        // The whole page or template, before Accept: the card's two lines are only its start.
        <details className="tp-proposal__what">
          <summary>{t("proposal.showAll")}</summary>
          <textarea className="tp-textarea" readOnly rows={8} value={proposal.body} dir="auto" aria-label={t("proposal.field.body")} />
        </details>
      ) : null}
      {proposal.status === "pending" && editing ? (
        <form className="tp-proposal__what" id={formId} onSubmit={acceptEdits} noValidate>
          {proposal.kind === "template" ? (
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${formId}-name`}>
                {t("proposal.name")}
              </label>
              <input
                id={`${formId}-name`}
                className="tp-input"
                dir="auto"
                value={draft.name}
                maxLength={200}
                aria-invalid={invalid && !draft.name.trim()}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>
          ) : (
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${formId}-title`}>
                {t("proposal.field.title")}
              </label>
              <input
                id={`${formId}-title`}
                className="tp-input"
                dir="auto"
                value={draft.title}
                maxLength={200}
                aria-invalid={invalid && !draft.title.trim()}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
          )}
          {proposal.kind === "task" ? (
            <>
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor={`${formId}-minutes`}>
                  {t("proposal.field.minutes")}
                </label>
                <input
                  id={`${formId}-minutes`}
                  className="tp-input tp-num"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={480}
                  value={draft.minutes}
                  aria-invalid={invalid && !(Number(draft.minutes) >= 1)}
                  onChange={(e) => set({ minutes: e.target.value })}
                />
              </div>
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor={`${formId}-when`}>
                  {t("proposal.field.when")}
                </label>
                <span className="tp-select" data-component="Select">
                  <select
                    id={`${formId}-when`}
                    className="tp-select__input"
                    value={draft.when}
                    onChange={(e) => set({ when: e.target.value === "later" ? "later" : "today" })}
                  >
                    <option value="today">{t("proposal.target.today")}</option>
                    <option value="later">{t("proposal.when.later")}</option>
                  </select>
                </span>
              </div>
            </>
          ) : (
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${formId}-body`}>
                {t("proposal.field.body")}
              </label>
              <textarea
                id={`${formId}-body`}
                className="tp-textarea"
                dir="auto"
                rows={8}
                value={draft.body}
                aria-invalid={invalid && !draft.body.trim()}
                onChange={(e) => set({ body: e.target.value })}
              />
            </div>
          )}
          {proposal.kind === "template" ? (
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${formId}-period`}>
                {t("proposal.field.period")}
              </label>
              <span className="tp-select" data-component="Select">
                <select
                  id={`${formId}-period`}
                  className="tp-select__input"
                  value={draft.period}
                  onChange={(e) =>
                    set({ period: e.target.value === "daily" ? "daily" : e.target.value === "weekly" ? "weekly" : "none" })
                  }
                >
                  <option value="daily">{t("proposal.period.daily")}</option>
                  <option value="weekly">{t("proposal.period.weekly")}</option>
                  <option value="none">{t("proposal.period.none")}</option>
                </select>
              </span>
            </div>
          ) : null}
          {invalid ? (
            <p className="tp-error-text" role="alert">
              {t("proposal.invalid")}
            </p>
          ) : null}
        </form>
      ) : null}
      {proposal.status === "pending" ? (
        <div className="tp-proposal__actions">
          {editing ? (
            <>
              <button className="tp-btn tp-btn--secondary" type="submit" form={formId} disabled={busy}>
                <TpIcon name="check" size="sm" />
                <span>{t("proposal.acceptEdits")}</span>
              </button>
              <button
                className="tp-btn tp-btn--ghost"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setInvalid(false);
                  setDraft(draftOf(proposal));
                }}
              >
                <span>{t("proposal.cancelEdit")}</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="tp-btn tp-btn--secondary"
                type="button"
                disabled={busy}
                onClick={() => void act(() => accept({ messageId, dueTodayAt: bounds.endMs - 1 }))}
              >
                <TpIcon name="check" size="sm" />
                <span>{t("proposal.accept")}</span>
              </button>
              <button className="tp-btn tp-btn--ghost" type="button" disabled={busy} onClick={() => setEditing(true)}>
                <TpIcon name="edit" size="sm" />
                <span>{t("proposal.edit")}</span>
              </button>
              <button className="tp-btn tp-btn--ghost" type="button" disabled={busy} onClick={() => void act(() => reject({ messageId }))}>
                <span>{t("proposal.reject")}</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <p className="tp-proposal__note">
          <TpIcon name={proposal.status === "accepted" ? "check" : "undo"} size="sm" />
          <span>
            {proposal.status === "accepted"
              ? left
                ? t("proposal.accepted")
                : t("proposal.kept")
              : proposal.status === "undone"
                ? t("proposal.undone")
                : t("proposal.rejected")}
          </span>
          {href ? (
            <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={href}>
              {t("proposal.open")}
            </Link>
          ) : null}
          {left ? (
            <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={busy} onClick={() => void act(() => undo({ messageId }))}>
              <TpIcon name="undo" size="sm" />
              <span>{t("proposal.undo")}</span>
              {/* The thread is a live region: the ticking time is visual only, so screen readers
                  are not read a new number every second. */}
              <span className="tp-num tp-mono" aria-hidden="true">
                {left}
              </span>
            </button>
          ) : null}
        </p>
      )}
      {failed ? (
        <p className="tp-proposal__note" role="alert">
          {t("proposal.error")}
        </p>
      ) : null}
    </section>
  );
}
