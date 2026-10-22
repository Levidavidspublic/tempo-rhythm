"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { brainDumpPageBody } from "@/lib/brain-dump-page";
import {
  type BrainDumpSession,
  clearBrainDumpSession,
  loadBrainDumpSession,
  saveBrainDumpSession,
  tabSessionStore,
} from "@/lib/brain-dump-session";
import { addedNotice, nowTaskIds } from "@/lib/brain-dump-today";
import { dayTokens } from "@/lib/editor/markdown-model";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";
import { tKb02, type Kb02Key } from "@/lib/i18n-groups/kb-02";
import "@/app/v3/kb-02.css";
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

export type CaptureState = "empty" | "draft" | "sorting" | "ready" | "error" | "offline" | "disabled";

const CAPTURE_KEY: Record<CaptureState, Kb02Key> = {
  empty: "kb02.empty",
  draft: "kb02.kept",
  sorting: "kb02.sorting",
  ready: "kb02.ready",
  error: "kb02.error",
  offline: "kb02.offline",
  disabled: "kb02.disabled",
};

/** The same short status view sits below the mounted capture box and in the gallery. */
export function CaptureStatus({ lang, state }: { lang: "en" | "he"; state: CaptureState }) {
  return <output className="kb02-capture-status" data-state={state} aria-live="polite">{tKb02(lang, CAPTURE_KEY[state])}</output>;
}

/** Shown only when a real tab draft has been restored; dismiss returns focus to the draft. */
export function DraftRecoveryNotice({ lang, onDismiss, disabled = false, withChoices = false }: { lang: "en" | "he"; onDismiss: () => void; disabled?: boolean; withChoices?: boolean }) {
  return (
    <output className="kb02-recovery">
      <span className="kb02-recovery__text">{tKb02(lang, withChoices ? "kb02.recovered" : "kb02.recoveredDraft")}</span>
      <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={onDismiss} disabled={disabled}>
        {tKb02(lang, "kb02.dismiss")}
      </button>
    </output>
  );
}

/** A saved page can be undone in one click for 5 minutes (HARD_RULES: AI-made changes stay reversible). */
const SAVE_UNDO_MS = 5 * 60 * 1000;

type SavedPage = { id: string; undoUntil: number };

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
      ? [{ id, undoUntil }]
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t, lang } = useLocale();
  const convex = useConvex();
  const prioritize = useAction(api.brain_dump.prioritize);
  const acceptPlan = useMutation(api.brain_dump.acceptPlan);
  const updateTask = useMutation(api.tasks.update);
  const bounds = useLocalDayBounds();
  const createNote = useMutation(api.notes.create);
  const removeNote = useMutation(api.notes.remove);

  const [draft, setDraft] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [accepted, setAccepted] = useState<number[]>([]);
  const [rejected, setRejected] = useState<number[]>([]);
  const [crisisCard, setCrisisCard] = useState<ResourcesCard | null>(null);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");
  const [doneOnToday, setDoneOnToday] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const editButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const [recovered, setRecovered] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  // Pages "Save as a page" made here, newest first: each keeps its Open link and its own Undo
  // until `undoUntil`. Null until the pages still in their window are read back after mount.
  const [savedState, setSavedPages] = useState<SavedPage[] | null>(null);
  const savedPages = savedState ?? [];
  const [undoingId, setUndoingId] = useState<string | null>(null);

  useEffect(() => setSavedPages(readSavedPages(Date.now())), []);
  useEffect(() => {
    if (savedState) writeSavedPages(savedState, Date.now());
  }, [savedState]);

  // The page "Save as a page" made from the plan on screen; while it stands, Save is off.
  const [savedPlan, setSavedPlan] = useState<{ plan: Plan; id: string } | null>(null);
  const savedPageId = savedPlan && savedPlan.plan === plan ? savedPlan.id : null;

  // Back then Forward, or a reload, brings back the dump, the sorted plan and the choices made.
  const restoreKept = useCallback((kept: BrainDumpSession) => {
    setRecovered(true);
    setDraft(kept.draft);
    setPlan(kept.plan);
    setAccepted(kept.accepted);
    setRejected(kept.rejected);
    setSavedPlan(kept.plan && kept.savedPageId ? { plan: kept.plan, id: kept.savedPageId } : null);
  }, []);
  useKeptBrainDump({ draft, plan, accepted, rejected, savedPageId }, restoreKept);

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
    setEditingIndex(null);
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
      const sorted = await prioritize({ rawText: draft });
      setPlan(sorted);
      // Kept at once, even if the person left while it was sorting, so the model call isn't wasted.
      const kept = { draft, plan: sorted, accepted: [], rejected: [], savedPageId: null };
      saveBrainDumpSession(tabSessionStore(), kept, Date.now());
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
    setEditingIndex((current) => current === index ? null : current);
  }, []);

  const saveEdit = useCallback(() => {
    const title = editValue.trim();
    if (editingIndex === null || !title) return;
    setPlan((prev) => prev ? {
      ...prev,
      priorities: prev.priorities.map((item, index) => index === editingIndex ? { ...item, title } : item),
    } : prev);
    setEditingIndex(null);
    requestAnimationFrame(() => editButtonRefs.current.get(editingIndex)?.focus());
  }, [editingIndex, editValue]);

  const cancelEdit = useCallback((index: number) => {
    setEditingIndex(null);
    requestAnimationFrame(() => editButtonRefs.current.get(index)?.focus());
  }, []);

  const handleAddAccepted = useCallback(async () => {
    if (toAdd.length === 0) return;
    setError("");
    setIsAdding(true);
    try {
      const result = await acceptPlan({ items: toAdd });
      // The lines are in Tasks now: Back then Forward must not offer them again.
      clearBrainDumpSession(tabSessionStore());
      // Now lines also go on today (lib/brain-dump-today.ts); one that fails stays in Tasks.
      const moved = await Promise.allSettled(
        nowTaskIds(toAdd, result.taskIds).map((taskId) => updateTask({ taskId, dueAt: bounds.endMs - 1 })),
      );
      const onToday = moved.filter((outcome) => outcome.status === "fulfilled").length;
      setDoneMessage(addedNotice(result.created, onToday, t));
      setDoneOnToday(onToday > 0);
      setDraft("");
      setRecovered(false);
      setPlan(null);
      setEditingIndex(null);
      setAccepted([]);
      setRejected([]);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("bd.error"));
    } finally {
      setIsAdding(false);
    }
  }, [acceptPlan, updateTask, bounds.endMs, toAdd, t]);

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
      setSavedPages((prev) => [{ id, undoUntil: Date.now() + SAVE_UNDO_MS }, ...(prev ?? [])]);
      setSavedPlan({ plan, id });
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
        setSavedPlan((prev) => (prev?.id === id ? null : prev));
        setDoneMessage(t("bd.pageRemoved"));
        setDoneOnToday(false);
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
      <div className="tp-page tp-page--narrow kb02-screen" data-component="PageLayout">
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
    <div className="tp-page tp-page--narrow kb02-screen" data-component="PageLayout">
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
            ref={textareaRef}
            id={textareaId}
            rows={7}
            dir="auto"
            value={draft}
            onChange={(event) => { setDraft(event.target.value); if (!event.target.value.trim() && !plan) setRecovered(false); }}
            disabled={busy}
            placeholder={t("bd.ph")}
            aria-describedby={`${textareaId}-help`}
          />
          <p className="tp-help" id={`${textareaId}-help`}>
            {t("bd.help")}
          </p>
        </div>
        {recovered && (draft.trim() || plan) ? (
          <DraftRecoveryNotice lang={lang} disabled={busy} withChoices={Boolean(plan)} onDismiss={() => {
            setRecovered(false);
            textareaRef.current?.focus();
          }} />
        ) : null}
        <CaptureStatus
          lang={lang}
          state={!online ? "offline" : isSorting ? "sorting" : error ? "error" : plan ? "ready" : draft.trim() ? "draft" : "empty"}
        />
        {error ? (
          <p role="alert" className="tp-notice" data-tone="caution">
            <span className="tp-notice__text">{error}</span>
          </p>
        ) : null}
        {doneMessage ? (
          <output className="tp-notice" data-tone="done">
            <span className="tp-notice__text">{doneMessage}</span>
            {doneOnToday ? (
              <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/today">
                {t("bd.openToday")}
              </Link>
            ) : null}
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
            className={plan ? "tp-btn tp-btn--secondary" : "tp-btn tp-btn--primary"}
            onClick={() => void handleSort()}
            // Not disabled when empty: the press itself shows the "type something first" hint.
            disabled={busy}
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
                setRecovered(false);
                setPlan(null);
                setEditingIndex(null);
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
                        {editingIndex === index ? (
                          <label className="tp-field kb02-edit-row">
                            <span className="tp-label">{tKb02(lang, "kb02.editLabel")}</span>
                            <input className="tp-input" dir="auto" value={editValue} onChange={(event) => setEditValue(event.target.value)}
                              onKeyDown={(event) => { if (event.key === "Enter") saveEdit(); if (event.key === "Escape") cancelEdit(index); }} />
                          </label>
                        ) : (
                          <p className="tp-import-row__text" dir="auto"><strong>{item.title}</strong></p>
                        )}
                        <div className="tp-import-row__bar">
                          {item.reason ? (
                            <span className="tp-chip" dir="auto">
                              {item.reason}
                            </span>
                          ) : null}
                          <span className="bd-row__actions">
                            {editingIndex === index ? (
                              <>
                                <button type="button" className="tp-btn tp-btn--secondary tp-btn--sm" disabled={!editValue.trim() || busy} onClick={saveEdit}>{tKb02(lang, "kb02.saveEdit")}</button>
                                <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={() => cancelEdit(index)}>{tKb02(lang, "kb02.cancelEdit")}</button>
                              </>
                            ) : (
                              <button ref={(node) => { if (node) editButtonRefs.current.set(index, node); else editButtonRefs.current.delete(index); }} type="button" className="tp-btn tp-btn--ghost tp-btn--sm" disabled={busy} onClick={() => { setEditingIndex(index); setEditValue(item.title); }}>{tKb02(lang, "kb02.edit")}</button>
                            )}
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
              disabled={toAdd.length === 0 || busy || editingIndex !== null}
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
                disabled={busy || savedPageId !== null || editingIndex !== null}
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

/** Typing is kept after this pause; a new plan, a choice or a saved page is kept at once. */
const KEEP_TYPING_MS = 400;

/**
 * Keeps this tab's dump, sorted plan and choices (lib/brain-dump-session.ts). The kept copy is read
 * in a layout effect: after hydration, so the server's HTML still matches, and before the first
 * paint, so the form doesn't flash empty. Leaving the screen or the page during the typing pause
 * still keeps the last change.
 */
function useKeptBrainDump(session: BrainDumpSession, restore: (kept: BrainDumpSession) => void) {
  const { draft, plan, accepted, rejected, savedPageId } = session;
  const [ready, setReady] = useState(false);
  const last = useRef<BrainDumpSession | null>(null);
  const pending = useRef<BrainDumpSession | null>(null);

  useLayoutEffect(() => {
    const kept = loadBrainDumpSession(tabSessionStore(), Date.now());
    if (kept) restore(kept);
    last.current = kept;
    setReady(true);
  }, [restore]);

  useEffect(() => {
    if (!ready) return;
    const prev = last.current;
    const next = { draft, plan, accepted, rejected, savedPageId };
    last.current = next;
    const sameChoices =
      prev !== null &&
      prev.plan === plan &&
      prev.accepted === accepted &&
      prev.rejected === rejected &&
      prev.savedPageId === savedPageId;
    // Just read back: nothing new to keep, and the 2-hour expiry doesn't restart.
    if (sameChoices && prev.draft === draft) return;
    pending.current = next;
    if (!sameChoices) {
      keepPending(pending);
      return;
    }
    const timer = window.setTimeout(() => keepPending(pending), KEEP_TYPING_MS);
    return () => window.clearTimeout(timer);
  }, [ready, draft, plan, accepted, rejected, savedPageId]);

  useEffect(() => {
    const flush = () => keepPending(pending);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
}

function keepPending(pending: { current: BrainDumpSession | null }) {
  if (pending.current) saveBrainDumpSession(tabSessionStore(), pending.current, Date.now());
  pending.current = null;
}

/** Isolated, fictional states for browser review; the route mounts the same two views above. */
export function Kb02Gallery() {
  const [lang, setLang] = useState<"en" | "he">(() =>
    typeof document !== "undefined" && document.documentElement.lang === "he" ? "he" : "en",
  );
  const [scenario, setScenario] = useState<"default" | "empty" | "loading" | "error" | "offline" | "disabled" | "overflow">("default");
  const [draft, setDraft] = useState("Maya wants a calmer week and time to see Dana and Yoni.");
  const [recovered, setRecovered] = useState(true);
  const [tries, setTries] = useState(0);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const state: CaptureState = scenario === "loading" ? "sorting" : scenario === "error" ? "error" : scenario === "offline" ? "offline"
    : scenario === "disabled" ? "disabled" : !draft ? "empty" : "draft";
  const scenarios = ["default", "empty", "loading", "error", "offline", "disabled", "overflow"] as const;
  const labels: Record<(typeof scenarios)[number], Kb02Key> = {
    default: "kb02.galleryDefault", empty: "kb02.galleryEmpty", loading: "kb02.galleryLoading",
    error: "kb02.galleryError", offline: "kb02.galleryOffline", disabled: "kb02.galleryDisabled", overflow: "kb02.galleryOverflow",
  };

  return (
    <main className="tp-page kb02-screen kb02-gallery" dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
      <h1 className="tp-pagehead__title">{tKb02(lang, "kb02.galleryTitle")}</h1>
      <fieldset className="kb02-gallery__controls">
        <legend className="tp-sr-only">{tKb02(lang, "kb02.galleryScenario")}</legend>
        {scenarios.map((choice) => (
          <button key={choice} type="button" className="tp-btn tp-btn--secondary" aria-pressed={scenario === choice}
            onClick={() => {
              setScenario(choice);
              setDraft(choice === "empty" ? "" : choice === "overflow"
                ? "Maya and Dana and Yoni want a gentle plan that leaves room for an unusually long thought about work, home, travel, books and every small thing that matters without pushing any decision too soon. ".repeat(3)
                : "Maya wants a calmer week and time to see Dana and Yoni.");
            }}>
            {tKb02(lang, labels[choice])}
          </button>
        ))}
        <button type="button" className="tp-btn tp-btn--secondary" onClick={() => setLang(lang === "en" ? "he" : "en")}>{tKb02(lang, lang === "en" ? "kb02.galleryHe" : "kb02.galleryEn")}</button>
      </fieldset>
      <section className="tp-surface" aria-label={tKb02(lang, "kb02.galleryDraft")}>
        <label className="tp-label" htmlFor="kb02-gallery-draft">{tKb02(lang, "kb02.galleryDraft")}</label>
        <textarea id="kb02-gallery-draft" ref={draftRef} className="tp-textarea" dir="auto" value={draft}
          disabled={scenario === "disabled" || scenario === "loading"} onChange={(event) => setDraft(event.target.value)} />
        {recovered ? <DraftRecoveryNotice lang={lang} withChoices disabled={scenario === "disabled" || scenario === "loading"} onDismiss={() => { setRecovered(false); draftRef.current?.focus(); }} />
          : <button type="button" className="tp-btn tp-btn--ghost" onClick={() => setRecovered(true)}>{tKb02(lang, "kb02.galleryRestored")}</button>}
        <CaptureStatus lang={lang} state={state} />
        <button type="button" className="tp-btn tp-btn--primary" disabled={scenario === "disabled" || scenario === "loading"}
          onClick={() => setTries((count) => count + 1)}>{tKb02(lang, "kb02.galleryTry")}</button>
        {tries > 0 ? <output className="tp-notice">{tKb02(lang, "kb02.galleryTried")} <bdi>{tries}</bdi></output> : null}
      </section>
    </main>
  );
}
