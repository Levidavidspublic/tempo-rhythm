"use client";

import { useAction, useMutation } from "convex/react";
import { ListChecks, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  prioritizeBrainDump,
  type BrainDumpPlan,
  type BrainDumpPriority,
} from "@/lib/brainDumpPrioritizer";
import { cn } from "@/lib/utils";

const urgencyTone: Record<BrainDumpPriority["urgency"], string> = {
  now: "border-primary/30 bg-primary/10 text-primary",
  soon: "border-primary/20 bg-primary/10 text-primary",
  later: "border-border bg-muted/60 text-muted-foreground",
};

const urgencyLabel: Record<BrainDumpPriority["urgency"], string> = {
  now: "Now",
  soon: "Soon",
  later: "Later",
};

export type TodayBrainDumpPanelProps = {
  /** Timestamp inside the local calendar day so created tasks appear on Today. */
  dueAt: number;
};

export function TodayBrainDumpPanel({ dueAt }: TodayBrainDumpPanelProps) {
  const baseId = useId();
  const textareaId = `${baseId}-raw-dump`;
  const prioritizeAction = useAction(api.brain_dump.prioritize);
  const createQuick = useMutation(api.tasks.createQuick);

  const [draft, setDraft] = useState("");
  const [submittedDraft, setSubmittedDraft] = useState("");
  const [plan, setPlan] = useState<BrainDumpPlan | null>(null);
  const [planSource, setPlanSource] = useState<"ai" | "local" | null>(null);
  const [error, setError] = useState("");
  const [applyHint, setApplyHint] = useState("");
  const [isPlanning, setIsPlanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const trimmedDraft = draft.trim();
  const characterCount = draft.length;
  const isStale = submittedDraft.length > 0 && submittedDraft !== draft;

  const laneSummary = useMemo(() => {
    if (!plan) return null;
    return {
      now: plan.priorities.filter((item) => item.urgency === "now").length,
      soon: plan.priorities.filter((item) => item.urgency === "soon").length,
      later: plan.priorities.filter((item) => item.urgency === "later").length,
    };
  }, [plan]);

  useEffect(() => {
    if (!plan) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(plan.priorities.map((_, i) => i)));
  }, [plan]);

  const toggleSelected = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!plan) return;
    setSelected(new Set(plan.priorities.map((_, i) => i)));
  }, [plan]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  const runLocalPlan = useCallback(() => {
    if (!trimmedDraft) {
      setError("Paste the messy version first. Even a rough list is enough.");
      return;
    }
    setError("");
    setApplyHint("");
    setSubmittedDraft(draft);
    setPlan(prioritizeBrainDump(draft));
    setPlanSource("local");
  }, [draft, trimmedDraft]);

  const runAiPlan = useCallback(async () => {
    if (!trimmedDraft) {
      setError("Paste the messy version first. Even a rough list is enough.");
      return;
    }
    setError("");
    setApplyHint("");
    setIsPlanning(true);
    try {
      const result = await prioritizeAction({ rawText: draft });
      setSubmittedDraft(draft);
      setPlan(result);
      setPlanSource("ai");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong while planning.";
      setError(message);
    } finally {
      setIsPlanning(false);
    }
  }, [draft, prioritizeAction, trimmedDraft]);

  const handleSubmit = useCallback(() => {
    void runAiPlan();
  }, [runAiPlan]);

  const handleAddSelectedToToday = useCallback(async () => {
    if (!plan || selected.size === 0) {
      setApplyHint("Pick at least one line to add.");
      return;
    }
    setApplyHint("");
    setIsApplying(true);
    let added = 0;
    let failed = 0;
    const addedIndices: number[] = [];
    const ordered = [...selected].sort((a, b) => a - b);
    for (const index of ordered) {
      const row = plan.priorities[index];
      if (!row) continue;
      const title = row.title.trim();
      if (!title) continue;
      try {
        await createQuick({ title, dueAt });
        added += 1;
        addedIndices.push(index);
      } catch {
        failed += 1;
      }
    }
    if (addedIndices.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const i of addedIndices) next.delete(i);
        return next;
      });
    }
    setIsApplying(false);
    if (added > 0 && failed === 0) {
      setApplyHint(
        added === 1 ? "Added 1 task to today." : `Added ${added} tasks to today.`,
      );
    } else if (added > 0 && failed > 0) {
      setApplyHint(`Added ${added}. ${failed} did not go through — try those again?`);
    } else {
      setApplyHint("Could not add those right now. Try again?");
    }
  }, [createQuick, dueAt, plan, selected]);

  const handleClear = useCallback(() => {
    setDraft("");
    setSubmittedDraft("");
    setPlan(null);
    setPlanSource(null);
    setError("");
    setApplyHint("");
    setSelected(new Set());
  }, []);

  const planningDisabled = isPlanning || isApplying;
  const selectedCount = selected.size;

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
              Brain dump to plan
            </div>
            <div>
              <h2
                id="today-brain-dump-heading"
                className="font-heading text-3xl font-semibold tracking-tight text-foreground"
              >
                Pour it out messy. Keep only the next useful moves.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                We run a planning pass on the server when it is available. Nothing here is saved as a
                note unless you add tasks below. If the planner is unavailable, you can still sort
                locally on this page.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Best input
            </p>
            <p className="mt-2 max-w-[16rem] text-sm text-foreground">
              Tasks, worries, reminders, errands, and half-finished thoughts all in one pile.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
              Raw dump
            </label>
            <textarea
              id={textareaId}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError("");
                if (applyHint) setApplyHint("");
              }}
              disabled={planningDisabled}
              placeholder="Pay rent, answer Dana, call dentist, I am behind on groceries, maybe plan Sunday, fix the weird task bug, submit that form before tonight..."
              className="min-h-64 w-full resize-y rounded-[1.5rem] border border-border bg-background/85 px-4 py-4 text-base leading-7 text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] outline-none transition focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {characterCount === 0
                ? "Nothing pasted yet."
                : `${characterCount} characters of raw context.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={(draft.length === 0 && !plan) || isApplying}
                className="rounded-full"
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  runLocalPlan();
                }}
                disabled={planningDisabled || !trimmedDraft}
                className="rounded-full"
              >
                Sort locally
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={planningDisabled || !trimmedDraft}
                className="rounded-full bg-linear-to-r from-[#D97757] to-[#E8A87C] text-primary-foreground shadow-[0_10px_24px_rgba(217,119,87,0.24)]"
              >
                {isPlanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Planning…
                  </>
                ) : (
                  <>
                    <ListChecks className="h-4 w-4" aria-hidden />
                    Turn this into a plan
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-dashed border-border bg-muted/30 px-4 py-4">
            <p className="text-sm font-medium text-foreground">Useful mess looks like:</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              &quot;Need to reply to Maya today, groceries are low, finish invoice, maybe plan Sunday,
              dentist appointment, figure out why quick add feels clunky.&quot;
            </p>
          </div>

          {error ? (
            <div className="space-y-3">
              <div
                className="rounded-[1.25rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  setError("");
                  runLocalPlan();
                }}
                disabled={!trimmedDraft || isPlanning}
              >
                Use local sort instead
              </Button>
            </div>
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
                <p className="font-heading text-lg font-semibold text-foreground">Planning…</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Turning your dump into a short, ordered list. This can take a few seconds.
                </p>
              </div>
            </output>
          ) : !plan ? (
            <div className="flex min-h-64 flex-col justify-between rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,var(--color-card),var(--color-surface-sunken))] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Prioritized output
                </p>
                <h3 className="mt-3 font-heading text-2xl font-semibold text-foreground">
                  Your plan will appear here.
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  The first pass keeps things practical: what needs attention now, what can wait a
                  beat, and what should stay parked for later.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {["Now", "Soon", "Later"].map((lane) => (
                  <div
                    key={lane}
                    className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-4 text-sm text-muted-foreground"
                  >
                    <p className="font-medium text-foreground">{lane}</p>
                    <p className="mt-2">Empty until you run the first sorting pass.</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/80 bg-[linear-gradient(180deg,var(--color-card),var(--color-surface-sunken))] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Prioritized output
                    </p>
                    <h3 className="mt-2 font-heading text-2xl font-semibold text-foreground">
                      Draft next moves
                    </h3>
                    {planSource ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Source: {planSource === "ai" ? "server planner" : "local sort"}
                      </p>
                    ) : null}
                  </div>
                  {laneSummary ? (
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
                        {laneSummary.now} now
                      </span>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
                        {laneSummary.soon} soon
                      </span>
                      <span className="rounded-full border border-border bg-muted/60 px-3 py-1 text-muted-foreground">
                        {laneSummary.later} later
                      </span>
                    </div>
                  ) : null}
                </div>

                <p className="mt-4 text-sm leading-6 text-foreground">{plan.summary}</p>

                {isStale ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    The draft changed since this plan was generated. Run it again when you want a
                    fresh cut.
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                  <p className="text-sm font-medium text-foreground">Add to Today</p>
                  <span className="text-sm text-muted-foreground">
                    Choose what becomes real tasks — nothing is added until you confirm.
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={selectAll}
                    disabled={!plan || isApplying}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={selectNone}
                    disabled={!plan || isApplying}
                  >
                    Clear selection
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full bg-linear-to-r from-[#D97757] to-[#E8A87C] text-primary-foreground"
                    onClick={() => void handleAddSelectedToToday()}
                    disabled={selectedCount === 0 || isApplying || isPlanning}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Adding…
                      </>
                    ) : (
                      <>Add {selectedCount || "selected"} to Today</>
                    )}
                  </Button>
                </div>
                {applyHint ? (
                  <output className="mt-3 block text-sm text-muted-foreground" aria-live="polite">
                    {applyHint}
                  </output>
                ) : null}
              </div>

              <ol className="space-y-3">
                {plan.priorities.map((priority, index) => {
                  const checkId = `${baseId}-pick-${index}`;
                  const isChecked = selected.has(index);
                  return (
                    <li
                      key={`${checkId}-${priority.title}`}
                      className="rounded-[1.5rem] border border-border/80 bg-card/90 p-4 shadow-[0_8px_24px_rgba(26,25,23,0.05)]"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex h-9 shrink-0 items-center pt-0.5">
                          <input
                            id={checkId}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelected(index)}
                            disabled={isApplying}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <label htmlFor={checkId} className="cursor-pointer">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
                                    {index + 1}
                                  </span>
                                  <h4 className="font-medium text-foreground">{priority.title}</h4>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                  {priority.reason}
                                </p>
                              </label>
                            </div>

                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
                                urgencyTone[priority.urgency],
                              )}
                            >
                              {urgencyLabel[priority.urgency]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
