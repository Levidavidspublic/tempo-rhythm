"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateLoading } from "@/components/you/ScreenStates";
import { api } from "@/convex/_generated/api";
import {
  BAD_DAY_BANNER,
  EMPTY_COPY,
  ERROR_COPY,
  REJECTED_COPY,
  nextLoadNote,
  toView,
} from "./proposalView";

type Outcome = { status: "accepted" | "rejected"; taskLoad: number };

/**
 * Today's plan in /coach's side column (ProposalCard, DESIGN.md §9): the coach proposes, you
 * accept or say not today. v3 card, list and button classes; logical properties, so the list's
 * markers sit on the right side in Hebrew. (Edit and a 5-minute Undo need a backend undo for
 * coach.decideProposal, which doesn't exist yet.)
 */
export function CoachProposalCard() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const args = isAuthenticated ? {} : "skip";
  const settings = useQuery(api.coach.getSettings, args);
  const badDay = useQuery(api.coach.badDay, args);
  const proposal = useQuery(api.coach.currentProposal, args);
  const tasks = useQuery(api.tasks.list, args);
  const createProposal = useMutation(api.coach.createProposal);
  const decideProposal = useMutation(api.coach.decideProposal);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const lock = useRef(false);

  if (authLoading || (isAuthenticated && proposal === undefined)) {
    return (
      <section aria-busy="true" aria-label="Plan my day" className="tp-card cp-card">
        <StateLoading label="Loading your plan." rows={2} box={false} />
      </section>
    );
  }
  if (!isAuthenticated || proposal === undefined) return null;

  const onPlan = () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    setEmpty(false);
    setOutcome(null);
    // Convex redacts plain Error text in production, so emptiness comes from the
    // task list, never from the error message.
    if (tasks !== undefined && !tasks.some((t) => t.status === "todo" || t.status === "in_progress")) {
      setEmpty(true);
      lock.current = false;
      setBusy(false);
      return;
    }
    createProposal({})
      .catch(() => setError(true))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  const onDecide = (decision: "accept" | "reject") => {
    if (lock.current || !proposal) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    decideProposal({ proposalId: proposal._id, decision })
      .then((result) => setOutcome({ status: result.status, taskLoad: result.taskLoad }))
      .catch(() => setError(true))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  const errorLine = error ? (
    <p role="alert" className="tp-error-text">
      <TpIcon name="alert" size="sm" />
      <span>{ERROR_COPY}</span>
    </p>
  ) : null;

  if (proposal === null) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="tp-card cp-card">
        <h2 id="coach-proposal-heading" className="tp-section__title">
          Today&rsquo;s plan
        </h2>
        {outcome ? (
          <output className="tp-notice" data-tone={outcome.status === "rejected" ? undefined : "done"}>
            <span className="tp-notice__text">
              <span>{outcome.status === "rejected" ? REJECTED_COPY : "Plan accepted. You can start with the first one."}</span>
              <span className="tp-muted">{nextLoadNote(outcome.taskLoad)}</span>
            </span>
          </output>
        ) : null}
        {empty ? <p className="tp-help">{EMPTY_COPY}</p> : null}
        {errorLine}
        <div className="cp-actions">
          <button className="tp-btn tp-btn--secondary" type="button" onClick={onPlan} disabled={busy}>
            <TpIcon name={error ? "refresh" : "sparkle"} size="sm" />
            <span>{error ? "Try again" : "Plan my day"}</span>
          </button>
        </div>
      </section>
    );
  }

  const view = toView(proposal, settings, badDay);

  if (proposal.tasks.length === 0) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="tp-card cp-card">
        <h2 id="coach-proposal-heading" className="tp-section__title">
          {view.heading}
        </h2>
        <p className="tp-help">{EMPTY_COPY}</p>
        {errorLine}
        <div className="cp-actions">
          <button className="tp-btn tp-btn--secondary" type="button" onClick={() => onDecide("reject")} disabled={busy}>
            Not today
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tp-proposal cp-card" data-component="ProposalCard" aria-labelledby="coach-proposal-heading">
      <div className="tp-proposal__head">
        <TpIcon name="today" size="sm" />
        <strong id="coach-proposal-heading">{view.heading}</strong>
      </div>
      <div className="cp-body">
        {badDay?.isBadDay ? <p className="tp-help">{BAD_DAY_BANNER}</p> : null}
        <p className="tp-help">{view.loadNote}</p>
        <ol className="cp-lines">
          {view.taskLines.map((line, i) => (
            <li key={proposal.tasks[i].taskId} dir="auto">
              {line}
            </li>
          ))}
        </ol>
        <div className="cp-first">
          <span className="tp-label">First, a 10-second action</span>
          <p dir="auto">{view.tenSecondAction}</p>
        </div>
        <p className="tp-help">{view.realismNote}</p>
        {errorLine}
      </div>
      <div className="tp-proposal__actions">
        <button className="tp-btn tp-btn--primary" type="button" onClick={() => onDecide("accept")} disabled={busy}>
          <TpIcon name="check" size="sm" />
          <span>Accept</span>
        </button>
        <button className="tp-btn tp-btn--secondary" type="button" onClick={() => onDecide("reject")} disabled={busy}>
          Not today
        </button>
      </div>
    </section>
  );
}
