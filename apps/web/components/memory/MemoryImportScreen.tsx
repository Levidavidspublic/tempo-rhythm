"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { Segmented } from "@/components/you/Controls";
import {
  LiveMessage,
  RetryRoot,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
} from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import {
  type ImportChoice,
  type ImportItem,
  itemsToSave,
  MAX_IMPORT_BYTES,
  readImport,
} from "@/lib/you/memory";
import { deriveScreenState, fill, UNDO_WINDOW_MS } from "@/lib/you/screenState";

/**
 * Import memory (docs/design/v3/screens/web/memory-import.html).
 *
 * RAM-ONLY (HARD_RULES §6.4): the pasted text or file is read and split into items in the
 * browser and never sent anywhere. Only the items the person keeps or edits on the review
 * step reach Convex (memoryImport.saveReviewed); the source text is dropped after saving.
 * Saving has a 5-minute Undo that forgets exactly that batch.
 */

type Source = "chatgpt" | "claude";
type How = "paste" | "upload";
type Step = "text" | "review" | "saved";
type Saved = { added: number; skipped: number; memoryIds: Id<"memories">[] };
type Toast = { title: string; untilMs: number; onUndo?: () => Promise<unknown> };

const SOURCE_NAME: Record<Source, string> = { chatgpt: "ChatGPT", claude: "Claude" };
const CHOICE_LABEL: Record<ImportChoice, MessageKey> = {
  keep: "mi.c.keep",
  edit: "mi.c.edit",
  drop: "mi.c.drop",
};
const CHOICE_NOTE: Record<ImportChoice, MessageKey> = {
  keep: "mi.n.keep",
  edit: "mi.n.edit",
  drop: "mi.n.drop",
};
const CHOICES: readonly ImportChoice[] = ["keep", "edit", "drop"];

function ImportHead() {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <Link className="tp-btn tp-btn--link" href="/settings/memory">
          <TpIcon name="chevron" size="sm" className="tp-icon--back" />
          <span>{t("mm.title")}</span>
        </Link>
        <h1 className="tp-pagehead__title">{t("mi.title")}</h1>
        <p className="tp-pagehead__sub">{t("mi.sub")}</p>
      </div>
    </header>
  );
}

export function MemoryImportScreen() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={() => <MemoryImportContent />}
      fallback={(retry) => (
        <div
          className="tp-page tp-page--narrow"
          data-component="PageLayout"
          data-testid="settings-memory-import"
        >
          <ImportHead />
          <StateError
            className="mi-state"
            title={t("mi.error.t")}
            body={t("mi.error.b")}
            onRetry={retry}
          />
        </div>
      )}
    />
  );
}

function MemoryImportContent() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const ready = isAuthenticated && profile != null;
  // Only used to mark items Tempo already remembers.
  const existing = useQuery(api.memory.list, ready ? { limit: 200 } : "skip");
  const saveReviewed = useMutation(api.memoryImport.saveReviewed);
  const forgetAll = useMutation(api.memory.forgetAll);
  const state = deriveScreenState({
    isAuthLoading,
    isAuthenticated,
    profile,
    data: profile,
    failed: false,
  });

  const [source, setSource] = useState<Source>("chatgpt");
  const [how, setHow] = useState<How>("paste");
  // RAM-ONLY: the raw text and file stay in this component's memory.
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("text");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [fieldError, setFieldError] = useState<MessageKey | null>(null);
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [nothingFound, setNothingFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<MessageKey | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [live, setLive] = useState("");
  const focusTarget = useRef<"paste" | "review" | "saved" | null>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const savedPanel = useRef<HTMLDivElement>(null);

  // Moves focus to the step that just appeared.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    const el =
      target === "paste"
        ? pasteRef.current
        : target === "review"
          ? reviewHeading.current
          : savedPanel.current;
    if (el) {
      el.focus();
      focusTarget.current = null;
    }
  });

  const backToText = () => {
    setNothingFound(false);
    setReadFailed(false);
    setStep("text");
    focusTarget.current = "paste";
  };

  const onFind = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    let raw = text;
    if (how === "upload") {
      if (!file) {
        setFieldError("mi.s1.fileErr");
        return;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        setFieldError("mi.s1.tooLarge");
        return;
      }
      setReading(true);
      try {
        raw = await file.text();
      } catch {
        setReadFailed(true);
        return;
      } finally {
        setReading(false);
      }
    }
    const read = readImport(
      raw,
      source,
      (existing ?? []).map((memory) => memory.content)
    );
    if (!read.ok) {
      setFieldError(
        read.reason === "too-large"
          ? "mi.s1.tooLarge"
          : how === "paste"
            ? "mi.s1.err"
            : "mi.s1.fileErr"
      );
      if (how === "paste") pasteRef.current?.focus();
      return;
    }
    if (read.items.length === 0) {
      setNothingFound(true);
      return;
    }
    setItems(read.items);
    setSaveError(null);
    setStep("review");
    focusTarget.current = "review";
  };

  const updateItem = (id: string, patch: Partial<ImportItem>) => {
    setItems((all) => all.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setSaveError(null);
  };

  const onSave = async () => {
    const toSave = itemsToSave(items);
    if (toSave.length === 0) {
      setSaveError("mi.nothingKept");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveReviewed({ source, items: toSave });
      // The source text has done its job; drop it.
      setText("");
      setFile(null);
      setSaved(result);
      setStep("saved");
      focusTarget.current = "saved";
      setLive(`${result.added} ${t("mi.sv.title")}`);
      if (result.added > 0) {
        setToast({
          title: t("mi.sv.toast"),
          untilMs: Date.now() + UNDO_WINDOW_MS,
          onUndo: async () => {
            await forgetAll({ memoryIds: result.memoryIds });
            setSaved(null);
            setStep("review");
            focusTarget.current = "review";
            setLive(t("mi.sv.undone"));
          },
        });
      }
    } catch {
      setSaveError("mi.saveError");
    } finally {
      setSaving(false);
    }
  };

  const kept = items.filter((item) => item.choice !== "drop").length;

  return (
    <div
      className="tp-page tp-page--narrow"
      data-component="PageLayout"
      data-testid="settings-memory-import"
    >
      <ImportHead />
      <StateOffline body={t("mi.offBody")} />
      <LiveMessage text={live} />
      {state === "loading" ? (
        <div className="mi-state">
          <StateLoading label={t("mm.loading")} rows={4} box={false} />
        </div>
      ) : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "ready" ? (
        <div className="mi-body">
          {reading ? (
            <div className="mi-state">
              <StateLoading label={t("mi.loading")} rows={4} box={false} />
            </div>
          ) : readFailed ? (
            <StateError
              className="mi-state"
              title={t("mi.error.t")}
              body={t("mi.error.b")}
              onRetry={backToText}
            />
          ) : nothingFound ? (
            <StateEmpty
              className="mi-state"
              icon="search"
              title={t("mi.empty.t")}
              body={t("mi.empty.b")}
              action={
                <button className="tp-btn tp-btn--secondary" type="button" onClick={backToText}>
                  <TpIcon name="text" size="sm" />
                  <span>{t("mi.empty.a")}</span>
                </button>
              }
            />
          ) : step === "text" ? (
            <section className="mi-step tp-surface" aria-labelledby="mi-s1-title">
              <h2 className="tp-section__title" id="mi-s1-title">
                <span className="tp-num">1.</span> <span>{t("mi.s1.title")}</span>
              </h2>
              <form
                className="tp-form"
                data-component="Form"
                noValidate
                onSubmit={(event) => void onFind(event)}
              >
                <div className="tp-field" data-component="Field">
                  <span className="tp-label" id="mi-src-label">
                    {t("mi.s1.from")}
                  </span>
                  <Segmented
                    labelledBy="mi-src-label"
                    value={source}
                    onChange={setSource}
                    options={[
                      { value: "chatgpt", label: SOURCE_NAME.chatgpt },
                      { value: "claude", label: SOURCE_NAME.claude },
                    ]}
                  />
                </div>
                <div className="tp-field" data-component="Field">
                  <span className="tp-label" id="mi-how-label">
                    {t("mi.s1.how")}
                  </span>
                  <Segmented
                    labelledBy="mi-how-label"
                    value={how}
                    onChange={(next) => {
                      setHow(next);
                      setFieldError(null);
                    }}
                    options={[
                      { value: "paste", label: t("mi.s1.paste"), icon: "text" },
                      { value: "upload", label: t("mi.s1.upload"), icon: "upload" },
                    ]}
                  />
                </div>
                {how === "paste" ? (
                  <div className="tp-field" data-component="Field">
                    <label className="tp-label" htmlFor="mi-paste">
                      {t("mi.s1.pasteLabel")}
                    </label>
                    <textarea
                      ref={pasteRef}
                      className="tp-textarea"
                      id="mi-paste"
                      rows={6}
                      dir="auto"
                      value={text}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={
                        fieldError ? "mi-paste-help mi-field-error" : "mi-paste-help"
                      }
                      data-component="Textarea"
                      onChange={(event) => {
                        setText(event.target.value);
                        setFieldError(null);
                      }}
                    />
                    <p className="tp-help" id="mi-paste-help">
                      {t("mi.s1.tip")}
                    </p>
                    {fieldError ? (
                      <p className="tp-error-text" id="mi-field-error" role="alert">
                        {t(fieldError)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="tp-field" data-component="Field">
                    <label className="tp-label" htmlFor="mi-file">
                      {t("mi.s1.fileLabel")}
                    </label>
                    <input
                      className="tp-input"
                      id="mi-file"
                      type="file"
                      accept=".txt,.md,text/plain,text/markdown"
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? "mi-file-help mi-field-error" : "mi-file-help"}
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null);
                        setFieldError(null);
                      }}
                    />
                    <p className="tp-help" id="mi-file-help">
                      {t("mi.s1.fileHelp")}
                    </p>
                    {fieldError ? (
                      <p className="tp-error-text" id="mi-field-error" role="alert">
                        {t(fieldError)}
                      </p>
                    ) : null}
                  </div>
                )}
                <div className="tp-form__actions">
                  <button className="tp-btn tp-btn--secondary" type="submit">
                    <TpIcon name="search" size="sm" />
                    <span>{t("mi.s1.find")}</span>
                  </button>
                </div>
              </form>
            </section>
          ) : step === "review" ? (
            <section className="mi-step" aria-labelledby="mi-s2-title">
              <div className="tp-section__head">
                <h2
                  className="tp-section__title"
                  id="mi-s2-title"
                  ref={reviewHeading}
                  tabIndex={-1}
                >
                  <span className="tp-num">2.</span> <span>{t("mi.s2.title")}</span>
                </h2>
                <span className="tp-section__count">
                  <span className="tp-num">{items.length}</span>{" "}
                  {fill(t("mi.s2.found"), { source: SOURCE_NAME[source] })}
                </span>
              </div>
              <p className="tp-muted">{t("mi.s2.help")}</p>
              <ol className="tp-import-list" data-component="ImportReview">
                {items.map((item) => {
                  const textId = `mi-${item.id}`;
                  return (
                    <li className="tp-import-row" key={item.id} data-choice={item.choice}>
                      {item.choice === "edit" ? (
                        <textarea
                          className="tp-textarea tp-import-row__text"
                          id={textId}
                          rows={2}
                          dir="auto"
                          aria-label={t("mi.editLabel")}
                          value={item.text}
                          onChange={(event) => updateItem(item.id, { text: event.target.value })}
                        />
                      ) : (
                        <p className="tp-import-row__text" dir="auto" id={textId}>
                          {item.text}
                        </p>
                      )}
                      <div className="tp-import-row__bar">
                        <Segmented
                          labelledBy={textId}
                          value={item.choice}
                          onChange={(choice) => updateItem(item.id, { choice })}
                          options={CHOICES.map((choice) => ({
                            value: choice,
                            label: t(CHOICE_LABEL[choice]),
                            icon: choice === "keep" ? "check" : choice === "edit" ? "edit" : "x",
                          }))}
                        />
                        <span className="tp-import-row__note">{t(CHOICE_NOTE[item.choice])}</span>
                      </div>
                      {item.duplicate ? (
                        <p className="tp-small tp-muted">
                          <TpIcon name="info" size="sm" /> <span>{t("mi.dup")}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {saveError ? (
                <p className="tp-error-text" role="alert">
                  {t(saveError)}
                </p>
              ) : null}
              <div className="mi-actions">
                <button
                  className="tp-btn tp-btn--primary"
                  type="button"
                  disabled={saving}
                  onClick={() => void onSave()}
                >
                  <TpIcon name="check" size="sm" />
                  {saving ? (
                    <span>{t("mi.saving")}</span>
                  ) : (
                    <>
                      <span>{t("mi.s2.save1")}</span> <span className="tp-num">{kept}</span>{" "}
                      <span>{t("mi.s2.save2")}</span>
                    </>
                  )}
                </button>
                <button className="tp-btn tp-btn--ghost" type="button" onClick={backToText}>
                  <TpIcon name="chevron" size="sm" className="tp-icon--back" />
                  <span>{t("mi.s2.back")}</span>
                </button>
              </div>
            </section>
          ) : saved ? (
            <div
              className="tp-status-panel"
              data-tone="done"
              data-component="StatusPanel"
              ref={savedPanel}
              tabIndex={-1}
            >
              <span className="tp-status-panel__icon">
                <TpIcon name="check" size="lg" />
              </span>
              <h2 className="tp-status-panel__title">
                <span className="tp-num">{saved.added}</span> <span>{t("mi.sv.title")}</span>
              </h2>
              <p className="tp-status-panel__body">{t("mi.sv.body")}</p>
              {saved.skipped > 0 ? (
                <p className="tp-status-panel__body">
                  {fill(t("mi.sv.skipped"), { n: saved.skipped })}
                </p>
              ) : null}
              <div className="tp-status-panel__actions">
                <Link className="tp-btn tp-btn--secondary" href="/settings/memory">
                  <TpIcon name="memory" size="sm" />
                  <span>{t("mm.title")}</span>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {toast ? (
        <UndoToast
          key={toast.untilMs}
          title={toast.title}
          untilMs={toast.untilMs}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
