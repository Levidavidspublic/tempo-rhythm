"use client";

import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { safeFilename, toBlobParts } from "@/components/memory-export/download";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { ConfirmSheet, Segmented } from "@/components/you/Controls";
import {
  LiveMessage,
  RetryRoot,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useLoadingTimeout,
} from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import {
  checkMemory,
  MEMORY_FILTERS,
  type MemoryFilter,
  type MemoryProblem,
  shownMemories,
} from "@/lib/you/memory";
import {
  deriveScreenState,
  fill,
  intlLocale,
  localDayStart,
  UNDO_WINDOW_MS,
} from "@/lib/you/screenState";

/**
 * What Tempo remembers (docs/design/v3/screens/web/memory.html). Forget one (soft delete,
 * 5-minute Undo), forget everything (asks first, Undo too), export as Markdown, and import
 * from ChatGPT or Claude. The "settings-memory" test id, the "What Tempo remembers" heading
 * and the #memory-new field with "Remember this" are e2e contracts.
 */

type Memory = {
  _id: Id<"memories">;
  content: string;
  createdAt: number;
  importedFrom?: "chatgpt" | "claude" | "grok" | "other";
};
type Toast = { title: string; untilMs: number; onUndo?: () => Promise<unknown> };

/** Memories forgotten one by one whose Undo window is still open (each keeps its own window). */
type Forgotten = { id: Id<"memories">; untilMs: number };

const LIST_LIMIT = 200;
const FILTER_LABEL: Record<MemoryFilter, MessageKey> = {
  all: "mm.f.all",
  you: "mm.f.you",
  imported: "mm.f.imported",
};
const SOURCE_LABEL: Record<NonNullable<Memory["importedFrom"]>, MessageKey> = {
  chatgpt: "mm.src.chatgpt",
  claude: "mm.src.claude",
  grok: "mm.src.grok",
  other: "mm.src.other",
};
const DRAFT_PROBLEM: Record<MemoryProblem, MessageKey> = {
  empty: "mm.add.empty",
  long: "mm.add.long",
};

function MemoryHead() {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("mm.title")}</h1>
        <p className="tp-pagehead__sub">{t("mm.sub")}</p>
      </div>
      <div className="tp-pagehead__actions">
        <Link className="tp-btn tp-btn--secondary" href="/settings/memory/import">
          <TpIcon name="upload" size="sm" />
          <span>{t("mm.import")}</span>
        </Link>
      </div>
    </header>
  );
}

export function MemoryManager() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={(retry) => <MemoryContent onRetry={retry} />}
      fallback={(retry) => (
        <div
          className="tp-page tp-page--narrow"
          data-component="PageLayout"
          data-testid="settings-memory"
        >
          <MemoryHead />
          <StateError
            className="mm-state"
            title={t("mm.error.t")}
            body={t("mm.error.b")}
            onRetry={retry}
          />
        </div>
      )}
    />
  );
}

function MemoryContent({ onRetry }: { onRetry: () => void }) {
  const { t, lang } = useLocale();
  const convex = useConvex();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // memory.list calls requireUser: wait for the users row.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const memories = useQuery(
    api.memory.list,
    isAuthenticated && profile ? { limit: LIST_LIMIT } : "skip"
  );
  const remember = useMutation(api.memory.remember);
  const forget = useMutation(api.memory.forget);
  const restore = useMutation(api.memory.restore);
  const forgetAll = useMutation(api.memory.forgetAll);
  const restoreAll = useMutation(api.memory.restoreAll);
  const input = { isAuthLoading, isAuthenticated, profile, data: memories };
  const timedOut = useLoadingTimeout(deriveScreenState({ ...input, failed: false }) === "loading");
  const state = deriveScreenState({ ...input, failed: timedOut });

  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [rowError, setRowError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  // Forgets inside the Undo window share one toast, so a second Forget never takes away the
  // first one's Undo (Codex P2 on #928). Kept in a ref too, so Undo reads the current list.
  const [forgotten, setForgotten] = useState<Forgotten[]>([]);
  const forgottenRef = useRef<Forgotten[]>([]);
  const setForgottenList = (next: Forgotten[]) => {
    forgottenRef.current = next;
    setForgotten(next);
  };
  const [live, setLive] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [forgettingAll, setForgettingAll] = useState(false);
  const [forgetAllFailed, setForgetAllFailed] = useState(false);
  const [exporting, setExporting] = useState<{
    status: "idle" | "working" | "ready" | "error";
    file?: string;
  }>({
    status: "idle",
  });
  const [draft, setDraft] = useState("");
  const [draftProblem, setDraftProblem] = useState<MemoryProblem | null>(null);
  const [addFailed, setAddFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const forgetButtons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);

  const all: Memory[] = (memories ?? []).filter((m) => !hidden.has(m._id));
  const capped = (memories?.length ?? 0) >= LIST_LIMIT;
  const shown = shownMemories(all, filter);

  // After Undo brings a memory back, focus returns to its Forget button.
  useEffect(() => {
    const id = pendingFocus.current;
    const button = id ? forgetButtons.current.get(id) : undefined;
    if (button) {
      button.focus();
      pendingFocus.current = null;
    }
  });

  const setHiddenId = (id: string, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const onForget = async (memory: Memory, nextId: string | undefined) => {
    setRowError(null);
    setHiddenId(memory._id, true);
    const nextButton = nextId ? forgetButtons.current.get(nextId) : undefined;
    if (nextButton) nextButton.focus();
    else listHeading.current?.focus();
    try {
      await forget({ memoryId: memory._id });
      setLive(`${t("mm.forgot")}: ${memory.content}`);
      const now = Date.now();
      setToast(null);
      setForgottenList([
        ...forgottenRef.current.filter((item) => item.untilMs > now),
        { id: memory._id, untilMs: now + UNDO_WINDOW_MS },
      ]);
    } catch {
      setHiddenId(memory._id, false);
      setRowError(memory._id);
    }
  };

  /** Brings back every one-by-one Forget whose window is still open. */
  const undoForgotten = async () => {
    const now = Date.now();
    const open = forgottenRef.current.filter((item) => item.untilMs > now);
    await Promise.all(open.map((item) => restore({ memoryId: item.id })));
    for (const item of open) setHiddenId(item.id, false);
    pendingFocus.current = open.at(-1)?.id ?? null;
    setForgottenList([]);
  };

  const onForgetAll = async () => {
    setForgettingAll(true);
    setForgetAllFailed(false);
    try {
      const result = await forgetAll({});
      setSheetOpen(false);
      setForgottenList([]);
      setToast({
        title: t("mm.forgotAll"),
        untilMs: Date.now() + UNDO_WINDOW_MS,
        onUndo: async () => {
          await restoreAll({ forgottenAt: result.forgottenAt });
          setLive(t("mm.restoredAll"));
        },
      });
    } catch {
      setForgetAllFailed(true);
    } finally {
      setForgettingAll(false);
    }
  };

  const onExport = async () => {
    setExporting({ status: "working" });
    try {
      const result = await convex.query(api.memory.exportAll, {});
      const { parts, type } = toBlobParts(result.markdown);
      const file = safeFilename(result.filename);
      const url = URL.createObjectURL(new Blob(parts, { type }));
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file;
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setExporting({ status: "ready", file });
    } catch {
      setExporting({ status: "error" });
    }
  };

  const onAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (adding) return;
    const check = checkMemory(draft);
    if (!check.ok) {
      setDraftProblem(check.problem);
      return;
    }
    setDraftProblem(null);
    setAddFailed(false);
    setAdding(true);
    try {
      await remember({ content: check.text });
      setDraft("");
      setLive(t("mm.added"));
    } catch {
      setAddFailed(true);
    } finally {
      setAdding(false);
    }
  };

  const today = localDayStart(Date.now());
  const dateFormat = new Intl.DateTimeFormat(intlLocale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const draftError = draftProblem
    ? t(DRAFT_PROBLEM[draftProblem])
    : addFailed
      ? t("you.saveError")
      : null;
  const exportNote =
    exporting.status === "working"
      ? t("mm.ex.working")
      : exporting.status === "ready"
        ? fill(t("mm.ex.ready"), { file: exporting.file ?? "" })
        : exporting.status === "error"
          ? t("mm.ex.error")
          : t("mm.ex.note");

  return (
    <div
      className="tp-page tp-page--narrow"
      data-component="PageLayout"
      data-testid="settings-memory"
    >
      <MemoryHead />
      <StateOffline body={t("mm.offBody")} />
      <LiveMessage text={live} />
      {state === "loading" ? (
        <div className="mm-state">
          <StateLoading label={t("mm.loading")} box={false} />
        </div>
      ) : null}
      {state === "error" ? (
        <StateError
          className="mm-state"
          title={t("mm.error.t")}
          body={t("mm.error.b")}
          onRetry={onRetry}
        />
      ) : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "ready" ? (
        <div className="mm-body">
          {all.length === 0 ? (
            <StateEmpty
              className="mm-state"
              icon="memory"
              title={t("mm.empty.t")}
              body={t("mm.empty.b")}
              action={
                <Link className="tp-btn tp-btn--secondary" href="/settings/memory/import">
                  <TpIcon name="upload" size="sm" />
                  <span>{t("mm.import")}</span>
                </Link>
              }
            />
          ) : (
            <section
              className="tp-section"
              aria-labelledby="mm-list-title"
              data-component="Section"
            >
              <div className="tp-section__head">
                <h2
                  className="tp-section__title"
                  id="mm-list-title"
                  ref={listHeading}
                  tabIndex={-1}
                >
                  {t("mm.list.title")}
                </h2>
                <span className="tp-section__count">
                  <span className="tp-num">{capped ? `${all.length}+` : all.length}</span> {t("mm.count")}
                </span>
              </div>
              <Segmented
                label={t("mm.filter")}
                value={filter}
                onChange={setFilter}
                options={MEMORY_FILTERS.map((value) => ({ value, label: t(FILTER_LABEL[value]) }))}
              />
              {shown.length === 0 ? (
                <p className="tp-muted tp-small">{t("mm.none.filter")}</p>
              ) : (
                <ul className="tp-memory-list mm-list" data-component="MemoryItem">
                  {shown.map((memory, index) => {
                    const factId = `mm-${memory._id}`;
                    const nextId = (shown[index + 1] ?? shown[index - 1])?._id;
                    const source = memory.importedFrom
                      ? t(SOURCE_LABEL[memory.importedFrom])
                      : t("mm.src.saved");
                    const when =
                      localDayStart(memory.createdAt) === today
                        ? t("you.today")
                        : dateFormat.format(memory.createdAt);
                    return (
                      <li key={memory._id}>
                        <div className="tp-memory-row">
                          <span className="tp-memory-row__fact" dir="auto" id={factId}>
                            {memory.content}
                          </span>
                          <span className="tp-memory-row__source">
                            <TpIcon name={memory.importedFrom ? "download" : "memory"} size="sm" />
                            <span>{source}</span> · <span>{when}</span>
                          </span>
                          <span className="tp-memory-row__action">
                            <button
                              ref={(el) => {
                                if (el) forgetButtons.current.set(memory._id, el);
                                else forgetButtons.current.delete(memory._id);
                              }}
                              className="tp-btn tp-btn--danger-ghost tp-btn--sm"
                              type="button"
                              aria-describedby={factId}
                              onClick={() => void onForget(memory, nextId)}
                            >
                              <TpIcon name="x" size="sm" />
                              <span>{t("mm.forget")}</span>
                            </button>
                          </span>
                        </div>
                        {rowError === memory._id ? (
                          <p className="tp-error-text" role="alert">
                            {t("mm.forgetError")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <section className="tp-surface" aria-labelledby="mm-add-title">
            <h2 className="tp-section__title" id="mm-add-title">
              {t("mm.add.title")}
            </h2>
            <form
              className="tp-form"
              data-component="Form"
              noValidate
              onSubmit={(event) => void onAdd(event)}
            >
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor="memory-new">
                  {t("mm.add.label")}
                </label>
                <input
                  className="tp-input"
                  id="memory-new"
                  dir="auto"
                  autoComplete="off"
                  value={draft}
                  aria-invalid={draftError ? true : undefined}
                  aria-describedby={
                    draftError ? "memory-new-help memory-new-error" : "memory-new-help"
                  }
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setDraftProblem(null);
                    setAddFailed(false);
                  }}
                />
                <p className="tp-help" id="memory-new-help">
                  {t("mm.add.help")}
                </p>
                {draftError ? (
                  <p className="tp-error-text" id="memory-new-error" role="alert">
                    {draftError}
                  </p>
                ) : null}
              </div>
              <div className="tp-form__actions">
                <button className="tp-btn tp-btn--secondary" type="submit" disabled={adding}>
                  <TpIcon name="plus" size="sm" />
                  <span>{adding ? t("mm.add.saving") : t("mm.add.btn")}</span>
                </button>
              </div>
            </form>
          </section>

          {all.length > 0 ? (
            <section className="tp-section" aria-labelledby="mm-keep-title">
              <h2 className="tp-section__title" id="mm-keep-title">
                {t("mm.keep.title")}
              </h2>
              <div className="tp-export" data-component="ExportArea">
                <TpIcon name="download" size="lg" />
                <div className="tp-export__text">
                  <span className="tp-export__title">{t("mm.ex.title")}</span>
                  <output className="tp-export__note">{exportNote}</output>
                </div>
                <button
                  className="tp-btn tp-btn--secondary"
                  type="button"
                  disabled={exporting.status === "working"}
                  onClick={() => void onExport()}
                >
                  <TpIcon name="download" size="sm" />
                  <span>{t("mm.ex.btn")}</span>
                </button>
              </div>
              <div
                className="tp-setting-row tp-surface"
                data-tone="danger"
                data-component="SettingRow"
              >
                <div className="tp-setting-row__text">
                  <span className="tp-setting-row__label">{t("mm.fa.label")}</span>
                  <span className="tp-help">{t("mm.fa.help")}</span>
                </div>
                <div className="tp-setting-row__control">
                  <button
                    className="tp-btn tp-btn--danger-ghost"
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={sheetOpen}
                    onClick={() => setSheetOpen(true)}
                  >
                    <TpIcon name="x" size="sm" />
                    <span>{t("mm.fa.btn")}</span>
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
      {sheetOpen ? (
        <ConfirmSheet
          title={t("mm.fs.title")}
          body={
            <>
              {/* The list stops at LIST_LIMIT; past that the exact total is unknown here, so the
                  confirm says "at least" instead of a number it can't vouch for. */}
              {capped ? fill(t("mm.fs.bodyMany"), { n: all.length }) : fill(t("mm.fs.body"), { n: all.length })}
              {forgetAllFailed ? (
                <span className="tp-error-text" role="alert">
                  {" "}
                  {t("you.saveError")}
                </span>
              ) : null}
            </>
          }
          confirmLabel={t("mm.fs.confirm")}
          cancelLabel={t("mm.fs.keep")}
          busy={forgettingAll}
          onConfirm={() => void onForgetAll()}
          onClose={() => {
            setSheetOpen(false);
            setForgetAllFailed(false);
          }}
        />
      ) : null}
      {toast ? (
        <UndoToast
          key={toast.untilMs}
          title={toast.title}
          untilMs={toast.untilMs}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      ) : forgotten.length > 0 ? (
        <UndoToast
          key={`forgot-${forgotten.length}`}
          title={forgotten.length === 1 ? t("mm.forgot") : fill(t("mm.forgotN"), { n: forgotten.length })}
          untilMs={Math.max(...forgotten.map((item) => item.untilMs))}
          onUndo={undoForgotten}
          onClose={() => setForgottenList([])}
        />
      ) : null}
    </div>
  );
}
