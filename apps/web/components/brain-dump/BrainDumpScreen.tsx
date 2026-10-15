"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { brainDumpPageBody } from "@/lib/brain-dump-page";
import { dayTokens } from "@/lib/editor/markdown-model";
import { localIsoDate } from "@/lib/period-pages";
import {
  acceptedItems,
  canSubmit,
  groupByUrgency,
  MAX_ACCEPTED,
  type Plan,
  toggleItem,
  type Urgency,
} from "./brainDumpState";

type ResourcesCard = {
  title: string;
  body: string;
  resources: { label: string; detail: string }[];
};

/** A saved page can be undone in one click for 5 minutes (HARD_RULES: AI-made changes stay reversible). */
const SAVE_UNDO_MS = 5 * 60 * 1000;

/** `plan` is the plan the page was made from; null for a page restored after leaving the screen. */
type SavedPage = { id: string; undoUntil: number; plan: Plan | null };

/**
 * Pending saves outlive this screen for their Undo window, so opening the page and coming back
 * keeps Undo. Per tab (sessionStorage), ids and times only; a page past its window is dropped.
 * The same list is kept in module memory, which lasts across in-app navigation, so Undo also
 * survives Open and back when storage is blocked.
 */
const SAVED_PAGES_KEY = "tempo:brain-dump:saved-pages:v1";
let savedPagesInMemory: unknown[] = [];

function readSavedPages(now: number): SavedPage[] {
  let rows: unknown = null;
  try {
    rows = JSON.parse(window.sessionStorage.getItem(SAVED_PAGES_KEY) ?? "null");
  } catch {
    rows = null;
  }
  const source = Array.isArray(rows) ? rows : savedPagesInMemory;
  return source.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const { id, undoUntil } = row as Record<string, unknown>;
    return typeof id === "string" && typeof undoUntil === "number" && undoUntil > now
      ? [{ id, undoUntil, plan: null }]
      : [];
  });
}

function writeSavedPages(pages: SavedPage[], now: number) {
  const live = pages.filter((page) => page.undoUntil > now).map(({ id, undoUntil }) => ({ id, undoUntil }));
  savedPagesInMemory = live;
  try {
    if (live.length === 0) window.sessionStorage.removeItem(SAVED_PAGES_KEY);
    else window.sessionStorage.setItem(SAVED_PAGES_KEY, JSON.stringify(live));
  } catch {
    // Storage blocked: the module copy above keeps Undo across in-app navigation.
  }
}

const URGENCY_KEY = { now: "bd.now", soon: "bd.soon", later: "bd.later" } as const;
const URGENCY_TONE: Record<Urgency, string | undefined> = { now: "caution", soon: "info", later: undefined };

/**
 * Brain dump (docs/design/v3/screens/web/brain-dump.html): type everything, sort it into a
 * proposal, accept lines one by one. Nothing reaches the lists until "Add accepted"; "Save as a
 * page" keeps the sorted plan as an ordinary Markdown page instead (decision 6).
 */
export function BrainDumpScreen() {
  const textareaId = `${useId()}-brain-dump`;
  const { t, lang } = useLocale();
  const convex = useConvex();
  const prioritize = useAction(api.brain_dump.prioritize);
  const acceptPlan = useMutation(api.brain_dump.acceptPlan);
  const createNote = useMutation(api.notes.create);
  const removeNote = useMutation(api.notes.remove);

  const [draft, setDraft] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [accepted, setAccepted] = useState<number[]>([]);
  const [rejected, setRejected] = useState<number[]>([]);
  const [crisisCard, setCrisisCard] = useState<ResourcesCard | null>(null);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [isSorting, setIsSorting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Pages "Save as a page" made here, newest first: each keeps its Open link and its own Undo
  // until `undoUntil`. Null until the pages still in their window are read back after mount.
  const [savedState, setSavedPages] = useState<SavedPage[] | null>(null);
  const savedPages = savedState ?? [];
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => setSavedPages(readSavedPages(Date.now())), []);
  useEffect(() => {
    if (savedState) writeSavedPages(savedState, Date.now());
  }, [savedState]);

  const groups = useMemo(() => (plan ? groupByUrgency(plan) : []), [plan]);
  const toAdd = useMemo(() => (plan ? acceptedItems(plan, accepted) : []), [plan, accepted]);
  const visibleCount = plan ? plan.priorities.length - rejected.length : 0;
  const busy = isSorting || isAdding || isSaving;

  const handleSort = useCallback(async () => {
    if (!canSubmit(draft)) {
      setError(t("bd.needText"));
      return;
    }
    setError("");
    setDoneMessage("");
    setPlan(null);
    setAccepted([]);
    setRejected([]);
    setCrisisCard(null);
    setIsSorting(true);
    try {
      const { isCrisis } = await convex.query(api.crisis.check, { text: draft });
      if (isCrisis) {
        setCrisisCard(await convex.query(api.crisis.resourcesCard, {}));
        return;
      }
      setPlan(await prioritize({ rawText: draft }));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("bd.error"));
    } finally {
      setIsSorting(false);
    }
  }, [convex, draft, prioritize, t]);

  const handleAccept = useCallback((index: number) => {
    setRejected((prev) => prev.filter((i) => i !== index));
    setAccepted((prev) => toggleItem(prev, index));
  }, []);

  const handleReject = useCallback((index: number) => {
    setAccepted((prev) => prev.filter((i) => i !== index));
    setRejected((prev) => (prev.includes(index) ? prev : [...prev, index]));
  }, []);

  const handleAddAccepted = useCallback(async () => {
    if (toAdd.length === 0) return;
    setError("");
    setIsAdding(true);
    try {
      const result = await acceptPlan({ items: toAdd });
      setDoneMessage(t("bd.added").replace("{n}", String(result.created)));
      setDraft("");
      setPlan(null);
      setAccepted([]);
      setRejected([]);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("bd.error"));
    } finally {
      setIsAdding(false);
    }
  }, [acceptPlan, toAdd, t]);

  const handleSavePage = useCallback(async () => {
    if (!plan || isSaving) return;
    setError("");
    setIsSaving(true);
    try {
      const day = dayTokens(localIsoDate(new Date()), lang).day ?? "";
      const body = brainDumpPageBody(plan, {
        skip: rejected,
        labels: { now: t("bd.now"), soon: t("bd.soon"), later: t("bd.later") },
      });
      const id = await createNote({ title: t("bd.pageTitle").replace("{day}", day), body });
      // Stay here with Open and Undo: the page holds AI-sorted text, so it is one click to take back.
      setDoneMessage("");
      setSavedPages((prev) => [{ id, undoUntil: Date.now() + SAVE_UNDO_MS, plan }, ...(prev ?? [])]);
    } catch {
      setError(t("bd.saveError"));
    } finally {
      setIsSaving(false);
    }
  }, [createNote, isSaving, lang, plan, rejected, t]);

  const handleUndoSave = useCallback(
    async (id: string) => {
      if (undoingId) return;
      setUndoingId(id);
      try {
        await removeNote({ noteId: id as Id<"notes"> });
        setSavedPages((prev) => (prev ?? []).filter((page) => page.id !== id));
        setDoneMessage(t("bd.pageRemoved"));
      } catch {
        setError(t("bd.undoError"));
      } finally {
        setUndoingId(null);
      }
    },
    [removeNote, t, undoingId],
  );

  if (crisisCard) {
    return (
      <div className="tp-page tp-page--narrow" data-component="PageLayout">
        <section className="tp-surface" aria-label={crisisCard.title}>
          <h1 className="tp-pagehead__title">{crisisCard.title}</h1>
          <p>{crisisCard.body}</p>
          <ul className="tpl-card__adds">
            {crisisCard.resources.map((resource) => (
              <li key={resource.label}>
                <strong>{resource.label}</strong>
                <span className="tp-muted"> — {resource.detail}</span>
              </li>
            ))}
          </ul>
          <div className="bd-actions">
            <button type="button" className="tp-btn tp-btn--secondary" onClick={() => setCrisisCard(null)}>
              {t("bd.back")}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="tp-page tp-page--narrow" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("bd.title")}</h1>
          <p className="tp-pagehead__sub">{t("bd.sub")}</p>
        </div>
      </header>

      <section className="tp-surface" data-component="Surface" aria-labelledby={`${textareaId}-label`}>
        <div className="tp-field" data-component="Field">
          <label className="tp-label" htmlFor={textareaId} id={`${textareaId}-label`}>
            {t("bd.label")}
          </label>
          <textarea
            className="tp-textarea"
            id={textareaId}
            rows={7}
            dir="auto"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            placeholder={t("bd.ph")}
            aria-describedby={`${textareaId}-help`}
          />
          <p className="tp-help" id={`${textareaId}-help`}>
            {t("bd.help")}
          </p>
        </div>
        {error ? (
          <p role="alert" className="tp-notice" data-tone="caution">
            <span className="tp-notice__text">{error}</span>
          </p>
        ) : null}
        {doneMessage ? (
          <output className="tp-notice" data-tone="done">
            <span className="tp-notice__text">{doneMessage}</span>
          </output>
        ) : null}
        {savedPages.map((page) => (
          <SavedPageNotice
            key={page.id}
            page={page}
            undoing={undoingId !== null}
            onUndo={() => void handleUndoSave(page.id)}
          />
        ))}
        <div className="bd-actions">
          <button
            type="button"
            className="tp-btn tp-btn--primary"
            onClick={() => void handleSort()}
            disabled={busy || !canSubmit(draft)}
          >
            <TpIcon name="sparkle" size="sm" />
            <span>{isSorting ? t("bd.sorting") : t("bd.sort")}</span>
          </button>
          {draft ? (
            <button
              type="button"
              className="tp-btn tp-btn--ghost"
              disabled={busy}
              onClick={() => {
                setDraft("");
                setPlan(null);
                setAccepted([]);
                setRejected([]);
                setError("");
              }}
            >
              {t("bd.clear")}
            </button>
          ) : null}
        </div>
      </section>

      {isSorting ? (
        <div className="tp-section" aria-busy="true">
          <output className="tp-sr-only">{t("bd.loading")}</output>
          <div className="tp-skeleton" style={{ minHeight: 56 }} />
          <div className="tp-skeleton" style={{ minHeight: 56 }} />
          <div className="tp-skeleton" style={{ minHeight: 56 }} />
        </div>
      ) : null}

      {plan ? (
        <section className="tp-section" data-component="Section" aria-labelledby="bd-order">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="bd-order">
              {t("bd.order")}
            </h2>
            <span className="tp-section__count tp-num">{t("bd.count").replace("{n}", String(visibleCount))}</span>
          </div>
          {plan.summary ? (
            <p className="tp-muted" dir="auto">
              {plan.summary}
            </p>
          ) : null}
          {plan.priorities.length === 0 ? (
            <p className="tp-muted">{t("bd.empty")}</p>
          ) : visibleCount === 0 ? (
            <p className="tp-muted">{t("bd.allAside")}</p>
          ) : (
            <p className="tp-small tp-muted">{t("bd.reviewHelp")}</p>
          )}
          {groups.map((group) => {
            const rows = group.items.filter((entry) => !rejected.includes(entry.index));
            if (rows.length === 0) return null;
            return (
              <section key={group.urgency} className="bd-group" aria-label={t(URGENCY_KEY[group.urgency])}>
                <h3 className="bd-group__title">
                  <span className="tp-badge" data-tone={URGENCY_TONE[group.urgency]}>
                    {t(URGENCY_KEY[group.urgency])}
                  </span>
                </h3>
                <ul className="tp-import-list" data-component="ImportReview">
                  {rows.map(({ index, item }) => {
                    const isAccepted = accepted.includes(index);
                    return (
                      <li key={index} className="tp-import-row" data-choice={isAccepted ? "keep" : undefined}>
                        <p className="tp-import-row__text" dir="auto">
                          <strong>{item.title}</strong>
                        </p>
                        <div className="tp-import-row__bar">
                          {item.reason ? (
                            <span className="tp-chip" dir="auto">
                              {item.reason}
                            </span>
                          ) : null}
                          <span className="bd-row__actions">
                            <button
                              type="button"
                              className={isAccepted ? "tp-btn tp-btn--primary tp-btn--sm" : "tp-btn tp-btn--secondary tp-btn--sm"}
                              aria-pressed={isAccepted}
                              disabled={isAdding || isSaving || (!isAccepted && accepted.length >= MAX_ACCEPTED)}
                              onClick={() => handleAccept(index)}
                            >
                              <TpIcon name="check" size="sm" />
                              <span>{isAccepted ? t("bd.accepted") : t("bd.accept")}</span>
                            </button>
                            <button
                              type="button"
                              className="tp-btn tp-btn--ghost tp-btn--sm"
                              disabled={isAdding || isSaving}
                              onClick={() => handleReject(index)}
                            >
                              <TpIcon name="x" size="sm" />
                              <span>{t("bd.reject")}</span>
                            </button>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <div className="bd-actions">
            <button
              type="button"
              className="tp-btn tp-btn--primary"
              onClick={() => void handleAddAccepted()}
              disabled={toAdd.length === 0 || busy}
            >
              <TpIcon name="plus" size="sm" />
              <span>
                {t("bd.add")}
                {toAdd.length > 0 ? ` (${toAdd.length})` : ""}
              </span>
            </button>
            {visibleCount > 0 ? (
              <button
                type="button"
                className="tp-btn tp-btn--secondary"
                onClick={() => void handleSavePage()}
                disabled={busy || (plan !== null && savedPages.some((page) => page.plan === plan))}
              >
                <TpIcon name="page" size="sm" />
                <span>{isSaving ? t("bd.saving") : t("bd.savePage")}</span>
              </button>
            ) : null}
            <p className="tp-small tp-muted">{t("bd.max").replace("{n}", String(MAX_ACCEPTED))}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** "Saved as a page." with an Open link, and Undo until the page's own 5-minute window ends. */
function SavedPageNotice({
  page,
  undoing,
  onUndo,
}: {
  page: SavedPage;
  undoing: boolean;
  onUndo: () => void;
}) {
  const { t } = useLocale();
  const [canUndo, setCanUndo] = useState(() => page.undoUntil > Date.now());

  useEffect(() => {
    const remaining = page.undoUntil - Date.now();
    if (remaining <= 0) {
      setCanUndo(false);
      return;
    }
    const timer = window.setTimeout(() => setCanUndo(false), remaining);
    return () => window.clearTimeout(timer);
  }, [page.undoUntil]);

  return (
    <output className="tp-notice bd-saved" data-tone="done" data-component="SavedPageNotice">
      <span className="tp-notice__text">{t("bd.saved")}</span>
      <span className="tp-notice__action">
        {/* A new tab keeps this screen, its plan and its Undo where they are. */}
        <Link
          className="tp-btn tp-btn--secondary tp-btn--sm"
          href={`/notes/${page.id}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("bd.openPage")}
          <span className="tp-sr-only"> {t("bd.newTab")}</span>
        </Link>
        {canUndo ? (
          <button
            type="button"
            className="tp-btn tp-btn--ghost tp-btn--sm"
            onClick={onUndo}
            disabled={undoing}
          >
            {t("bd.undoSave")}
          </button>
        ) : null}
      </span>
    </output>
  );
}
