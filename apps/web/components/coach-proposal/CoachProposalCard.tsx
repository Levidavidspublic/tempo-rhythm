"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { type MessageKey, translate } from "@/lib/i18n";

type Outcome = { status: "accepted" | "rejected"; taskLoad: number };
type Translate = (key: MessageKey) => string;
type CountKeys = { one: MessageKey; many: MessageKey };

const TODAY: CountKeys = { one: "cp.today.one", many: "cp.today.many" };
const LIGHTER: CountKeys = { one: "cp.lighter.one", many: "cp.lighter.many" };
const NEXT: CountKeys = { one: "cp.next.one", many: "cp.next.many" };

/**
 * The server picks the 10-second action from a fixed English list (convex/lib/coachLoad.ts).
 * Each has a cp.action key whose English is the same text, so it reads in the app language.
 */
const ACTION_KEYS = [
  "cp.action.breath",
  "cp.action.water",
  "cp.action.title",
  "cp.action.jaw",
  "cp.action.desk",
] as const satisfies readonly MessageKey[];

function actionKey(text: string): MessageKey | undefined {
  return ACTION_KEYS.find((key) => translate("en", key) === text);
}

/** "1 task" for exactly one, "{n} tasks" otherwise. */
function countCopy(t: Translate, keys: CountKeys, n: number): string {
  return n === 1 ? t(keys.one) : t(keys.many).replace("{n}", () => String(n));
}

/** Whole minutes, at least 1. */
function minutesCopy(t: Translate, minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1;
  return t("cp.minutes").replace("{n}", () => String(m));
}

export function CoachProposalCard() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const args = isAuthenticated ? {} : "skip";
  // The card has always subscribed to the coach settings; kept so nothing else changes.
  useQuery(api.coach.getSettings, args);
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
      <section aria-busy="true" aria-label={t("cp.plan")} className="max-w-xl">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <p className="sr-only">{t("cp.loading")}</p>
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
    if (
      tasks !== undefined &&
      !tasks.some((task) => task.status === "todo" || task.status === "in_progress")
    ) {
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

  // Error copy is always ours; the server's message never reaches the page.
  const errorLine = error ? (
    <p role="alert" className="text-sm text-destructive">
      {t("cp.error")}
    </p>
  ) : null;

  if (proposal === null) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="max-w-xl space-y-3">
        <h2 id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          {t("cp.title")}
        </h2>
        {outcome ? (
          <output className="block space-y-1">
            <p className="text-sm text-foreground">
              {outcome.status === "rejected" ? t("cp.rejected") : t("cp.accepted")}
            </p>
            <p className="text-sm text-muted-foreground">{countCopy(t, NEXT, outcome.taskLoad)}</p>
          </output>
        ) : null}
        {empty ? <p className="text-sm text-muted-foreground">{t("cp.empty")}</p> : null}
        {errorLine}
        <Button type="button" onClick={onPlan} disabled={busy}>
          {error ? t("cp.retry") : t("cp.plan")}
        </Button>
      </section>
    );
  }

  if (proposal.tasks.length === 0) {
    return (
      <section aria-labelledby="coach-proposal-heading" className="max-w-xl space-y-3">
        <h2 id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          {t("cp.heading")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("cp.empty")}</p>
        {errorLine}
        <Button type="button" variant="outline" onClick={() => onDecide("reject")} disabled={busy}>
          {t("cp.notToday")}
        </Button>
      </section>
    );
  }

  const count = proposal.tasks.length;
  const action = actionKey(proposal.tenSecondAction);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle id="coach-proposal-heading" className="font-heading text-xl font-semibold">
          {t("cp.heading")}
        </CardTitle>
        {badDay?.isBadDay ? (
          <p className="text-sm text-muted-foreground">{t("cp.badDay")}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {countCopy(t, badDay?.isBadDay ? LIGHTER : TODAY, count)}
        </p>
        <ul className="list-disc space-y-1 ps-5 text-foreground">
          {proposal.tasks.map((task) => (
            <li key={task.taskId}>
              {/* The person's own title, in its own direction. */}
              <span dir="auto">{task.title}</span> {minutesCopy(t, task.minutes)}
            </li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-medium text-foreground">{t("cp.firstAction")}</p>
          {action ? (
            <p className="text-foreground">{t(action)}</p>
          ) : (
            <p dir="auto" className="text-foreground">
              {proposal.tenSecondAction}
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {proposal.realism.ok ? t("cp.realism.ok") : t("cp.realism.tooMuch")}
        </p>
        {errorLine}
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" onClick={() => onDecide("accept")} disabled={busy}>
          {t("cp.accept")}
        </Button>
        <Button type="button" variant="outline" onClick={() => onDecide("reject")} disabled={busy}>
          {t("cp.notToday")}
        </Button>
      </CardFooter>
    </Card>
  );
}
