"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { Check, ListChecks, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";
import {
  acceptedItems,
  canSubmit,
  MAX_ACCEPTED,
  type Plan,
  toggleItem,
  type Urgency,
} from "@/components/brain-dump/brainDumpState";
import { useLocale } from "@/components/providers/LocaleProvider";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { addAcceptedToToday, addedNotice, sortDump } from "@/lib/brain-dump-today";
import { prioritizeBrainDump } from "@/lib/brainDumpPrioritizer";
import { cn } from "@/lib/utils";

const URGENCIES: readonly Urgency[] = ["now", "soon", "later"];

const URGENCY_KEY = { now: "bd.now", soon: "bd.soon", later: "bd.later" } as const;

const urgencyTone: Record<Urgency, string> = {
  now: "border-primary/30 bg-primary/10 text-primary",
  soon: "border-primary/20 bg-primary/10 text-primary",
  later: "border-border bg-muted/60 text-muted-foreground",
};

type ResourcesCard = {
  title: string;
  body: string;
  resources: { label: string; detail: string }[];
};

/** "planner" is the same sorter /brain-dump uses; "quick" is the word-based sort in this browser. */
type SortMode = "planner" | "quick";

export type TodayBrainDumpPanelProps = {
  /** Timestamp inside the local calendar day, so the Now lines appear on Today. */
  dueAt: number;
};

/**
 * Today's brain dump, with the same rules as /brain-dump (lib/brain-dump-today.ts): crisis words
 * get the resources card, nothing is accepted at first, nothing is added until Add accepted, and
 * then the Now lines go on today while Soon and Later are added without a date.
 */
export function TodayBrainDumpPanel({ dueAt }: TodayBrainDumpPanelProps) {
  const baseId = useId();
  const textareaId = `${baseId}-raw-dump`;
  const helpId = `${baseId}-help`;
  const { t } = useLocale();
  const convex = useConvex();
  const prioritize = useAction(api.brain_dump.prioritize);
  const acceptPlan = useMutation(api.brain_dump.acceptPlan);
  const updateTask = useMutation(api.tasks.update);

  const [draft, setDraft] = useState("");
  const [submittedDraft, setSubmittedDraft] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planSource, setPlanSource] = useState<SortMode | null>(null);
  const [crisisCard, setCrisisCard] = useState<ResourcesCard | null>(null);
  // As on /brain-dump: nothing is accepted until the person accepts it.
  const [accepted, setAccepted] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [sorting, setSorting] = useState<SortMode | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const isPlanning = sorting !== null;
  const busy = isPlanning || isAdding;
  const hasText = canSubmit(draft);
  const isStale = plan !== null && submittedDraft !== draft;
  const toAdd = useMemo(() => (plan ? acceptedItems(plan, accepted) : []), [plan, accepted]);

  const laneSummary = useMemo(() => {
    if (!plan) return null;
    return URGENCIES.map((urgency) => ({
      urgency,
      count: plan.priorities.filter((item) => item.urgency === urgency).length,
    }));
  }, [plan]);

  const runSort = useCallback(
    async (mode: SortMode) => {
      if (!canSubmit(draft)) {
        setError(t("bd.needText"));
        return;
      }
      const text = draft;
      setError("");
      setDoneMessage("");
      setPlan(null);
      setPlanSource(null);
      setAccepted([]);
      setCrisisCard(null);
      setSorting(mode);
      try {
        const outcome = await sortDump<Plan, ResourcesCard>(text, {
          isCrisis: async (value) => (await convex.query(api.crisis.check, { text: value })).isCrisis,
          crisisCard: () => convex.query(api.crisis.resourcesCard, {}),
          sort: async (value) =>
            mode === "planner" ? await prioritize({ rawText: value }) : prioritizeBrainDump(value),
        });
        if (outcome.kind === "crisis") {
          setCrisisCard(outcome.card);
          return;
        }
        setSubmittedDraft(text);
        setPlan(outcome.plan);
        setPlanSource(mode);
      } catch {
        setError(t("bd.error"));
      } finally {
        setSorting(null);
      }
    },
    [convex, draft, prioritize, t],
  );

  const handleAddAccepted = useCallback(async () => {
    if (toAdd.length === 0) return;
    setError("");
    setIsAdding(true);
    try {
      const { created, onToday } = await addAcceptedToToday(toAdd, {
        acceptPlan: (items) => acceptPlan({ items }),
        putOnToday: (taskId) => updateTask({ taskId, dueAt }),
      });
      setDoneMessage(addedNotice(created, onToday, t));
      setDraft("");
      setSubmittedDraft("");
      setPlan(null);
      setPlanSource(null);
      setAccepted([]);
    } catch {
      setError(t("bd.error"));
    } finally {
      setIsAdding(false);
    }
  }, [acceptPlan, dueAt, t, toAdd, updateTask]);

  const handleClear = useCallback(() => {
    setDraft("");
    setSubmittedDraft("");
    setPlan(null);
    setPlanSource(null);
    setCrisisCard(null);
    setError("");
    setDoneMessage("");
    setAccepted([]);
  }, []);

  return (
    <section
      className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/95 shadow-[0_16px_45px_rgba(26,25,23,0.08)]"
      aria-labelledby="today-brain-dump-heading"
    >
      <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(232,168,124,0.22),transparent_40%),linear-gradient(135deg,var(--color-card),var(--color-surface-sunken))] px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("bd.title")}
            </div>
            <div>
              <h2
                id="today-brain-dump-heading"
                className="font-heading text-3xl font-semibold tracking-tight text-foreground"
              >
                {t("bd.today.heading")}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{t("bd.today.lede")}</p>
              <p className="mt-3">
                <Link
                  href="/brain-dump"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("bd.today.full")}
                </Link>
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {t("bd.today.goodTitle")}
            </p>
            <p className="mt-2 max-w-[16rem] text-sm text-foreground">{t("bd.today.goodBody")}</p>
          </div>
        </div>
      </div>

      {crisisCard ? (
        <div className="px-6 py-6">
          <section
            className="rounded-[1.5rem] border border-border/80 bg-card/90 p-5"
            aria-labelledby={`${baseId}-crisis`}
          >
            <h3 id={`${baseId}-crisis`} className="font-heading text-xl font-semibold text-foreground">
              {crisisCard.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-foreground">{crisisCard.body}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {crisisCard.resources.map((resource) => (
                <li key={resource.label}>
                  <strong>{resource.label}</strong>
                  <span className="text-muted-foreground"> — {resource.detail}</span>
                </li>
              ))}
            </ul>
            <Button type="button" variant="secondary" className="mt-4 rounded-full" onClick={() => setCrisisCard(null)}>
              {t("bd.back")}
            </Button>
          </section>
        </div>
      ) : (
        <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
                {t("bd.label")}
              </label>
              <textarea
                id={textareaId}
                dir="auto"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) setError("");
                  if (doneMessage) setDoneMessage("");
                }}
                disabled={busy}
                placeholder={t("bd.ph")}
                aria-describedby={helpId}
                className="min-h-64 w-full resize-y rounded-[1.5rem] border border-border bg-background/85 px-4 py-4 text-base leading-7 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p id={helpId} className="text-sm text-muted-foreground">
                {t("bd.help")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={(draft.length === 0 && !plan && !doneMessage) || busy}
                  className="rounded-full"
                >
                  {t("bd.clear")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void runSort("quick")}
                  disabled={busy || !hasText}
                  className="rounded-full"
                >
                  {t("bd.today.quick")}
                </Button>
                <Button
                  type="button"
                  onClick={() => void runSort("planner")}
                  disabled={busy || !hasText}
                  className="rounded-full bg-linear-to-r from-[#D97757] to-[#E8A87C] text-primary-foreground shadow-[0_10px_24px_rgba(217,119,87,0.24)]"
                >
                  {sorting === "planner" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t("bd.sorting")}
                    </>
                  ) : (
                    <>
                      <ListChecks className="h-4 w-4" aria-hidden />
                      {t("bd.sort")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error ? (
              <div
                className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            ) : null}

            {doneMessage ? (
              <output
                className="block rounded-[1.25rem] border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
                aria-live="polite"
              >
                {doneMessage}
              </output>
            ) : null}
          </div>

          <div className="space-y-4">
            {isPlanning ? (
              <output
                className="flex min-h-64 flex-col justify-center gap-4 rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,var(--color-card),var(--color-surface-sunken))] p-8 text-center"
                aria-live="polite"
              >
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-hidden />
                <div>
                  <p className="font-heading text-lg font-semibold text-foreground">{t("bd.loading")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{t("bd.today.wait")}</p>
                </div>
              </output>
            ) : !plan ? (
              <div className="flex min-h-64 flex-col justify-between gap-4 rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,var(--color-card),var(--color-surface-sunken))] p-5">
                <div>
                  <h3 className="font-heading text-2xl font-semibold text-foreground">
                    {t("bd.today.emptyTitle")}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {t("bd.today.emptyBody")}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {URGENCIES.map((urgency) => (
                    <div
                      key={urgency}
                      className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-4 text-sm text-muted-foreground"
                    >
                      <p className="font-medium text-foreground">{t(URGENCY_KEY[urgency])}</p>
                      <p className="mt-2">{t("bd.today.laneEmpty")}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,var(--color-card),var(--color-surface-sunken))] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-2xl font-semibold text-foreground">{t("bd.order")}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("bd.count").replace("{n}", String(plan.priorities.length))}
                      </p>
                    </div>
                    {laneSummary ? (
                      <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                        {laneSummary.map(({ urgency, count }) => (
                          <span key={urgency} className={cn("rounded-full border px-3 py-1", urgencyTone[urgency])}>
                            <span className="tp-num">{count}</span> {t(URGENCY_KEY[urgency])}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {planSource === "quick" ? (
                    <p className="mt-4 text-sm leading-6 text-foreground">{t("bd.today.quickNote")}</p>
                  ) : plan.summary ? (
                    <p className="mt-4 text-sm leading-6 text-foreground" dir="auto">
                      {plan.summary}
                    </p>
                  ) : null}

                  {isStale ? <p className="mt-4 text-sm text-muted-foreground">{t("bd.today.stale")}</p> : null}

                  {plan.priorities.length === 0 ? (
                    <p className="mt-5 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                      {t("bd.empty")}
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
                      <p className="text-sm text-muted-foreground">{t("bd.reviewHelp")}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full bg-linear-to-r from-[#D97757] to-[#E8A87C] text-primary-foreground"
                          onClick={() => void handleAddAccepted()}
                          disabled={toAdd.length === 0 || busy}
                        >
                          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                          {t("bd.add")}
                          {toAdd.length > 0 ? <span className="tp-num">({toAdd.length})</span> : null}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {t("bd.max").replace("{n}", String(MAX_ACCEPTED))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <ol className="space-y-3">
                  {plan.priorities.map((priority, index) => {
                    const titleId = `${baseId}-line-${index}`;
                    const isAccepted = accepted.includes(index);
                    return (
                      <li
                        key={`${titleId}-${priority.title}`}
                        className={cn(
                          "rounded-[1.5rem] border bg-card/90 p-4 shadow-[0_8px_24px_rgba(26,25,23,0.05)]",
                          isAccepted ? "border-primary/40" : "border-border/80",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="tp-num inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                                {index + 1}
                              </span>
                              <h4 id={titleId} className="font-medium text-foreground" dir="auto">
                                {priority.title}
                              </h4>
                            </div>
                            {/* The quick sort's reasons are fixed English lines, so they are left out. */}
                            {planSource === "planner" && priority.reason ? (
                              <p className="mt-3 text-sm leading-6 text-muted-foreground" dir="auto">
                                {priority.reason}
                              </p>
                            ) : null}
                          </div>

                          <span
                            className={cn(
                              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                              urgencyTone[priority.urgency],
                            )}
                          >
                            {t(URGENCY_KEY[priority.urgency])}
                          </span>
                        </div>
                        <div className="mt-3">
                          <Button
                            type="button"
                            size="sm"
                            variant={isAccepted ? "default" : "outline"}
                            className="rounded-full"
                            aria-pressed={isAccepted}
                            aria-describedby={titleId}
                            disabled={isAdding || (!isAccepted && accepted.length >= MAX_ACCEPTED)}
                            onClick={() => setAccepted((prev) => toggleItem(prev, index))}
                          >
                            <Check className="h-4 w-4" aria-hidden />
                            {isAccepted ? t("bd.accepted") : t("bd.accept")}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
