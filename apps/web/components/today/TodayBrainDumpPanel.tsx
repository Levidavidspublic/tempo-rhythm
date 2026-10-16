"use client";

import { useAction, useConvex, useMutation } from "convex/react";
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
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { addAcceptedToToday, addedNotice, sortDump } from "@/lib/brain-dump-today";
import { prioritizeBrainDump } from "@/lib/brainDumpPrioritizer";

const URGENCIES: readonly Urgency[] = ["now", "soon", "later"];

const URGENCY_KEY = { now: "bd.now", soon: "bd.soon", later: "bd.later" } as const;

/** Badge tones for the lanes: a word always rides with the colour (DESIGN.md §2). */
const URGENCY_TONE: Record<Urgency, "caution" | "info" | undefined> = {
  now: "caution",
  soon: "info",
  later: undefined,
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
 * Drawn with the v3 classes (tp-surface, tp-field, tp-import-row, tp-badge, tp-crisis), so it follows
 * the light and dark themes and Hebrew right to left like the rest of Today.
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
    <section className="tp-surface tbd" data-component="TodayBrainDump" aria-labelledby="today-brain-dump-heading">
      <div className="tbd__head">
        <span className="tp-eyebrow">{t("bd.title")}</span>
        <h2 id="today-brain-dump-heading" className="tp-section__title">
          {t("bd.today.heading")}
        </h2>
        <p className="tp-help">{t("bd.today.lede")}</p>
        <p className="tp-help">
          <strong>{t("bd.today.goodTitle")}:</strong> {t("bd.today.goodBody")}
        </p>
        <Link href="/brain-dump" className="tp-btn tp-btn--link">
          {t("bd.today.full")}
        </Link>
      </div>

      {crisisCard ? (
        <div className="tbd__crisis">
          <section className="tp-crisis" data-component="CrisisCard" aria-labelledby={`${baseId}-crisis`}>
            <h3 id={`${baseId}-crisis`} className="tp-crisis__title">
              {crisisCard.title}
            </h3>
            <p className="tp-crisis__body">{crisisCard.body}</p>
            <ul className="tp-crisis__list">
              {crisisCard.resources.map((resource) => (
                <li key={resource.label} className="tp-crisis__item">
                  <span className="tp-crisis__item-text">
                    <span className="tp-crisis__name">{resource.label}</span>
                    <span className="tp-crisis__detail">{resource.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <div className="bd-actions">
            <button type="button" className="tp-btn tp-btn--secondary" onClick={() => setCrisisCard(null)}>
              {t("bd.back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="tbd__grid">
          <div className="tbd__col">
            <div className="tp-field" data-component="Field">
              <label htmlFor={textareaId} className="tp-label">
                {t("bd.label")}
              </label>
              <textarea
                id={textareaId}
                className="tp-textarea"
                rows={6}
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
              />
              <p id={helpId} className="tp-help">
                {t("bd.help")}
              </p>
            </div>

            <div className="bd-actions">
              <button
                type="button"
                className="tp-btn tp-btn--secondary"
                onClick={() => void runSort("planner")}
                disabled={busy || !hasText}
              >
                <TpIcon name="sparkle" size="sm" />
                <span>{sorting === "planner" ? t("bd.sorting") : t("bd.sort")}</span>
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--ghost"
                onClick={() => void runSort("quick")}
                disabled={busy || !hasText}
              >
                {t("bd.today.quick")}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--ghost"
                onClick={handleClear}
                disabled={(draft.length === 0 && !plan && !doneMessage) || busy}
              >
                {t("bd.clear")}
              </button>
            </div>

            {error ? (
              <p className="tp-notice" data-tone="caution" role="alert">
                <span className="tp-notice__icon">
                  <TpIcon name="alert" size="sm" />
                </span>
                <span className="tp-notice__text">{error}</span>
              </p>
            ) : null}

            {doneMessage ? (
              <output className="tp-notice" data-tone="done" aria-live="polite">
                <span className="tp-notice__icon">
                  <TpIcon name="check" size="sm" />
                </span>
                <span className="tp-notice__text">{doneMessage}</span>
              </output>
            ) : null}
          </div>

          <div className="tbd__col">
            {isPlanning ? (
              <output className="tbd__wait" aria-live="polite">
                <span className="tp-typing">
                  <span className="tp-typing__dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span>{t("bd.loading")}</span>
                </span>
                <span className="tp-help">{t("bd.today.wait")}</span>
              </output>
            ) : !plan ? (
              <div className="tp-state tp-state--empty tbd__empty" data-component="StateEmpty">
                <h3 className="tp-state__title">{t("bd.today.emptyTitle")}</h3>
                <p className="tp-state__body">{t("bd.today.emptyBody")}</p>
                <div className="tbd__lanes">
                  {URGENCIES.map((urgency) => (
                    <span key={urgency} className="tp-badge" data-tone={URGENCY_TONE[urgency]}>
                      {t(URGENCY_KEY[urgency])}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="tp-section" data-component="BrainDumpPlan">
                <div className="tp-section__head">
                  <h3 className="tp-section__title">{t("bd.order")}</h3>
                  <span className="tp-section__count">{t("bd.count").replace("{n}", String(plan.priorities.length))}</span>
                </div>
                {laneSummary ? (
                  <div className="tbd__lanes">
                    {laneSummary.map(({ urgency, count }) => (
                      <span key={urgency} className="tp-badge" data-tone={URGENCY_TONE[urgency]}>
                        <span className="tp-num">{count}</span> {t(URGENCY_KEY[urgency])}
                      </span>
                    ))}
                  </div>
                ) : null}

                {planSource === "quick" ? (
                  <p className="tp-help">{t("bd.today.quickNote")}</p>
                ) : plan.summary ? (
                  <p className="tp-help" dir="auto">
                    {plan.summary}
                  </p>
                ) : null}

                {isStale ? <p className="tp-help">{t("bd.today.stale")}</p> : null}

                {plan.priorities.length === 0 ? (
                  <p className="tp-help">{t("bd.empty")}</p>
                ) : (
                  <>
                    <p className="tp-help">{t("bd.reviewHelp")}</p>
                    <ol className="tp-import-list">
                      {plan.priorities.map((priority, index) => {
                        const titleId = `${baseId}-line-${index}`;
                        const isAccepted = accepted.includes(index);
                        return (
                          <li
                            key={`${titleId}-${priority.title}`}
                            className="tp-import-row"
                            data-choice={isAccepted ? "keep" : undefined}
                          >
                            <span id={titleId} className="tp-import-row__text" dir="auto">
                              <span className="tp-num tbd__n">{index + 1}.</span> {priority.title}
                            </span>
                            {/* The quick sort's reasons are fixed English lines, so they are left out. */}
                            {planSource === "planner" && priority.reason ? (
                              <span className="tp-import-row__note" dir="auto">
                                {priority.reason}
                              </span>
                            ) : null}
                            <div className="tp-import-row__bar">
                              <span className="tp-badge" data-tone={URGENCY_TONE[priority.urgency]}>
                                {t(URGENCY_KEY[priority.urgency])}
                              </span>
                              <button
                                type="button"
                                className={`tp-btn tp-btn--sm ${isAccepted ? "tp-btn--secondary" : "tp-btn--ghost"}`}
                                aria-pressed={isAccepted}
                                aria-describedby={titleId}
                                disabled={isAdding || (!isAccepted && accepted.length >= MAX_ACCEPTED)}
                                onClick={() => setAccepted((prev) => toggleItem(prev, index))}
                              >
                                <TpIcon name="check" size="sm" />
                                <span>{isAccepted ? t("bd.accepted") : t("bd.accept")}</span>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    <div className="bd-actions">
                      <button
                        type="button"
                        className="tp-btn tp-btn--secondary"
                        onClick={() => void handleAddAccepted()}
                        disabled={toAdd.length === 0 || busy}
                      >
                        <TpIcon name="plus" size="sm" />
                        <span>{t("bd.add")}</span>
                        {toAdd.length > 0 ? <span className="tp-num">({toAdd.length})</span> : null}
                      </button>
                      <span className="tp-help">{t("bd.max").replace("{n}", String(MAX_ACCEPTED))}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
