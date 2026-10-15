"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

export function CoachProposalCard() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const args = isAuthenticated ? {} : "skip";
  const settings = useQuery(api.coach.getSettings, args);
  const badDay = useQuery(api.coach.badDay, args);
  const proposal = useQuery(api.coach.currentProposal, args);
  const tasks = useQuery(api.tasks.list, args);
  const createProposal =useMutation(api.coach.createProposal);
  const decideProposal = useMutation(api.coach.decideProposal);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const lock = useRef(false);

  if (authLoading || (isAuthenticated && proposal === undefined)) {
    return (
      <section aria-busy="true" aria-label="Plan my day" className="max-w-xl">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <p className="sr-only">Loading your plan.</p>
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
    <p role="alert" className="text-sm text-destructive">
      {ERROR_COPY}
    </p>
  ) : null;

  if (proposal === null) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="max-w-xl space-y-3">
        <h2 id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          Today&rsquo;s plan
        </h2>
        {outcome ? (
          <output className="block space-y-1">
            <p className="text-sm text-foreground">
              {outcome.status === "rejected" ? REJECTED_COPY : "Plan accepted. You can start with the first one."}
            </p>
            <p className="text-sm text-muted-foreground">{nextLoadNote(outcome.taskLoad)}</p>
          </output>
        ) : null}
        {empty ? <p className="text-sm text-muted-foreground">{EMPTY_COPY}</p> : null}
        {errorLine}
        <Button type="button" onClick={onPlan} disabled={busy}>
          {error ? "Try again" : "Plan my day"}
        </Button>
      </section>
    );
  }

  const view = toView(proposal, settings, badDay);

  if (proposal.tasks.length === 0) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="max-w-xl space-y-3">
        <h2 id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          {view.heading}
        </h2>
        <p className="text-sm text-muted-foreground">{EMPTY_COPY}</p>
        {errorLine}
        <Button type="button" variant="outline" onClick={() => onDecide("reject")} disabled={busy}>
          Not today
        </Button>
      </section>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          {view.heading}
        </CardTitle>
        {badDay?.isBadDay ? <p className="text-sm text-muted-foreground">{BAD_DAY_BANNER}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{view.loadNote}</p>
        <ul className="list-disc space-y-1 pl-5 text-foreground">
          {view.taskLines.map((line, i) => (
            <li key={proposal.tasks[i].taskId}>{line}</li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-medium text-foreground">First, a 10-second action</p>
          <p className="text-foreground">{view.tenSecondAction}</p>
        </div>
        <p className="text-sm text-muted-foreground">{view.realismNote}</p>
        {errorLine}
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" onClick={() => onDecide("accept")} disabled={busy}>
          Accept
        </Button>
        <Button type="button" variant="outline" onClick={() => onDecide("reject")} disabled={busy}>
          Not today
        </Button>
      </CardFooter>
    </Card>
  );
}
