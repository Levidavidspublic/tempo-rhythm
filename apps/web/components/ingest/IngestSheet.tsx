"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { Segmented } from "@/components/you/Controls";
import { api } from "@/convex/_generated/api";
import { useOnline } from "@/lib/useOnline";
import { type IngestT, useIngestCopy } from "./copy";
import {
  deriveTitle,
  INGEST_ACCEPT,
  type IngestProblem,
  type IngestSourceKind,
  ingestKind,
  isTooLarge,
  toPageBody,
} from "./ingest-text";
import {
  canReadPhotos,
  type IngestReaders,
  type OcrProgress,
  readIngestFile,
  readPhotoText,
} from "./read-sources";

export type IngestTab = "file" | "paste" | "photo";

export type IngestSave = (page: { title: string; body: string }) => Promise<string>;

export type IngestSheetProps = {
  /** Id of the dialog element (the opener's `aria-controls`). */
  id?: string;
  /** Which source is chosen when the sheet opens. Default "file". */
  initialTab?: IngestTab;
  /** Esc, the Close button, the scrim and "Done" call this. */
  onClose: () => void;
  /** Called with the new page's id after it is saved. */
  onSaved?: (noteId: string) => void;
};

export type IngestSheetViewProps = IngestSheetProps & {
  /** Saves the page and resolves to its id (IngestSheet passes `api.notes.create`). */
  onSave: IngestSave;
  /** The browser's online flag. Offline, saving waits. */
  online: boolean;
  /** Whether the browser can read text in photos. Default: detected (a web worker and WASM). */
  photoSupported?: boolean;
  /**
   * The readers for photos (tesseract.js), PDFs (pdf.js) and Word files (mammoth). Default: the
   * real ones, loaded on first use; tests and the gallery pass stand-ins.
   */
  readers?: Partial<IngestReaders>;
  /** Text already in the sheet when it opens. */
  initialText?: string;
};

type FileState =
  | { status: "idle" }
  | { status: "reading"; kind: IngestSourceKind; done?: number; total?: number }
  | { status: "read"; name: string; pages?: { read: number; total: number } }
  | { status: "stopped" }
  | {
      status: "problem";
      problem: Exclude<IngestProblem, "cancelled">;
      kind: IngestSourceKind | null;
    };

type PhotoState =
  | "idle"
  | "loading"
  | "reading"
  | "read"
  | "stopped"
  | "none"
  | "error"
  | "too_large"
  | "pixels"
  | "load";

const PHOTO_PROBLEM = {
  none: "ig.photo.none",
  error: "ig.photo.error",
  too_large: "ig.photo.tooLarge",
  pixels: "ig.photo.pixels",
  load: "ig.photo.load",
} as const;

type PhotoProblem = keyof typeof PHOTO_PROBLEM;

function isPhotoProblem(state: PhotoState): state is PhotoProblem {
  return state in PHOTO_PROBLEM;
}

type SaveState = "idle" | "saving" | "waiting" | "error";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FILE_PROBLEM = {
  type: "ig.file.type",
  empty: "ig.file.empty",
  too_large: "ig.file.tooLarge",
  unreadable: "ig.file.unreadable",
  doc: "ig.file.doc",
  no_text: "ig.file.noText",
  locked: "ig.file.locked",
  file_too_big: "ig.file.bigPdf",
  docx_too_big: "ig.file.docxUnpacked",
  not_docx: "ig.file.notDocx",
  timeout: "ig.file.timeout",
} as const;

function fileProblemKey(problem: keyof typeof FILE_PROBLEM, kind: IngestSourceKind | null) {
  return problem === "file_too_big" && kind === "docx" ? "ig.file.bigDocx" : FILE_PROBLEM[problem];
}

/**
 * IngestSheet (T8-T10 spec, S2): bring a file, pasted text or a photo of text into a new page.
 * Connected to `api.notes.create`; everything else lives in IngestSheetView.
 */
export function IngestSheet(props: IngestSheetProps) {
  const create = useMutation(api.notes.create);
  const online = useOnline();
  const onSave = useCallback<IngestSave>(
    async ({ title, body }) => String(await create({ title, body })),
    [create]
  );
  return <IngestSheetView {...props} onSave={onSave} online={online} />;
}

/**
 * The sheet itself (MobileSheet, components.md §2.17): a bottom sheet on a phone and a centred
 * dialog from 768 px. Esc, Close and the scrim close it; Tab stays inside; focus goes back to
 * the button that opened it.
 *
 * RAM-ONLY (HARD_RULES §6.4): files and photos are read in this browser and let go straight
 * after. Only the text the person checks and saves is sent, as the body of a new page.
 */
export function IngestSheetView({
  id: idProp,
  initialTab = "file",
  onClose,
  onSaved,
  onSave,
  online,
  photoSupported,
  readers,
  initialText = "",
}: IngestSheetViewProps) {
  const t = useIngestCopy();
  const autoId = useId();
  const id = idProp ?? `ingest-${autoId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const [tab, setTab] = useState<IngestTab>(initialTab);
  const [text, setText] = useState(initialText);
  const [title, setTitle] = useState(() => deriveTitle(initialText));
  const [titleEdited, setTitleEdited] = useState(false);
  const [fileState, setFileState] = useState<FileState>({ status: "idle" });
  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [photoRatio, setPhotoRatio] = useState(0);
  const [canPhoto] = useState(() => photoSupported ?? canReadPhotos());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [needText, setNeedText] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const textBox = useRef<HTMLTextAreaElement | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  // Set by "Paste text instead": the text box gets focus once it is on screen.
  const focusText = useRef(false);
  // Set by Stop reading and "Use a photo instead": that picker gets focus once it is on screen.
  const focusPicker = useRef<"file" | "photo" | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  // The read in progress, if any: aborting it stops pdf.js or terminates the OCR worker.
  const fileJob = useRef<AbortController | null>(null);
  const photoJob = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      mounted.current = false;
      // RAM-ONLY: closing the sheet mid-read stops the reader and lets the file or photo go.
      fileJob.current?.abort();
      photoJob.current?.abort();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // After saving, the Save button is gone: move focus to "Open the page".
  useEffect(() => {
    if (savedId) sheet.current?.querySelector<HTMLElement>("[data-ingest-open]")?.focus();
  }, [savedId]);

  // After every render: "Paste text instead" hands focus to the text box it opened. A control
  // that had focus and is now gone (Retry, Paste text instead, a cleared text box) would drop
  // focus to the page, where Esc and the Tab loop don't reach; the sheet takes it instead.
  useEffect(() => {
    const root = sheet.current;
    if (!root) return;
    if (focusText.current && textBox.current) {
      focusText.current = false;
      textBox.current.focus();
      return;
    }
    if (focusPicker.current) {
      const target = focusPicker.current === "file" ? fileInput.current : photoInput.current;
      focusPicker.current = null;
      if (target) {
        target.focus();
        return;
      }
    }
    const active = document.activeElement;
    if (!active || active === document.body || !document.contains(active)) root.focus();
  });

  const tooLarge = isTooLarge(text);
  const hasText = text.trim().length > 0;

  const takeText = (next: string, nextTitle: string) => {
    setText(next);
    setNeedText(false);
    if (!titleEdited) setTitle(nextTitle);
  };

  const save = async () => {
    if (busy.current || savedId) return;
    // The two early returns also end an offline wait: the text may have been cleared or grown
    // past the limit while offline, and Save must not stay on "Saves when you're back online".
    if (!hasText) {
      setNeedText(true);
      setSaveState("idle");
      return;
    }
    if (tooLarge) {
      setSaveState("idle");
      return;
    }
    if (!online) {
      setSaveState("waiting");
      return;
    }
    busy.current = true;
    setSaveState("saving");
    try {
      const noteId = await onSave({
        title: title.trim() || t("ig.untitled"),
        body: toPageBody(text),
      });
      if (!mounted.current) return;
      setSavedId(noteId);
      setSaveState("idle");
      onSaved?.(noteId);
    } catch {
      if (mounted.current) setSaveState("error");
    } finally {
      busy.current = false;
    }
  };

  // Saving waits while offline and goes ahead by itself once the browser is back online.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (online && saveState === "waiting") void saveRef.current();
  }, [online, saveState]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    const root = sheet.current;
    if (event.key !== "Tab" || !root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (document.activeElement === root) {
      // Focus is on the sheet itself (see the effect above): Tab goes in, never out.
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Let go of the picked file straight away; only its text is kept (RAM-only).
    input.value = "";
    if (!file || fileState.status === "reading") return;
    const kind = ingestKind(file.name, file.type);
    const job = new AbortController();
    fileJob.current = job;
    setFileState({ status: "reading", kind: kind ?? "text" });
    const current = () => mounted.current && fileJob.current === job;
    void readIngestFile(file, {
      readers,
      signal: job.signal,
      onProgress: (progress) => {
        if (current()) setFileState({ status: "reading", ...progress });
      },
    }).then((result) => {
      if (!current()) return;
      fileJob.current = null;
      if (result.ok) {
        takeText(result.text, result.title);
        setFileState({ status: "read", name: file.name, pages: result.pages });
      } else if (result.problem === "cancelled") {
        setFileState({ status: "stopped" });
      } else {
        setFileState({ status: "problem", problem: result.problem, kind });
      }
    });
  };

  const stopFile = () => {
    fileJob.current?.abort();
    fileJob.current = null;
    focusPicker.current = "file";
    setFileState({ status: "stopped" });
  };

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const image = input.files?.[0];
    // RAM-ONLY: the photo is read in memory and dropped; it is never uploaded or stored.
    input.value = "";
    if (!image || photoState === "loading" || photoState === "reading") return;
    const job = new AbortController();
    photoJob.current = job;
    setPhotoState("loading");
    setPhotoRatio(0);
    const current = () => mounted.current && photoJob.current === job;
    void readPhotoText(image, {
      readers,
      signal: job.signal,
      onProgress: ({ stage, ratio }: OcrProgress) => {
        if (!current()) return;
        setPhotoState(stage);
        setPhotoRatio(stage === "reading" ? ratio : 0);
      },
    }).then((result) => {
      if (!current()) return;
      photoJob.current = null;
      if (result.ok) {
        takeText(result.text, deriveTitle(result.text));
        setPhotoState("read");
      } else {
        setPhotoState(result.problem === "cancelled" ? "stopped" : result.problem);
      }
    });
  };

  // Terminates the OCR worker (read-sources.ts); the photo is dropped with it.
  const stopPhoto = () => {
    photoJob.current?.abort();
    photoJob.current = null;
    focusPicker.current = "photo";
    setPhotoState("stopped");
  };

  /**
   * A new source stops the one being read, so a late result can't replace text typed meanwhile.
   * Aborting stops pdf.js and terminates the OCR or Word worker (read-sources.ts).
   */
  const changeTab = (next: IngestTab) => {
    if (next === tab) return;
    if (fileJob.current) {
      fileJob.current.abort();
      fileJob.current = null;
      setFileState({ status: "stopped" });
    }
    if (photoJob.current) {
      photoJob.current.abort();
      photoJob.current = null;
      setPhotoState("stopped");
    }
    setTab(next);
  };

  const switchToPhoto = () => {
    focusPicker.current = "photo";
    changeTab("photo");
  };

  const onTextChange = (next: string) => {
    takeText(next, deriveTitle(next));
  };

  const switchToPaste = () => {
    focusText.current = true;
    changeTab("paste");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save();
  };

  const formId = `${id}-form`;
  const showText = tab === "paste" || hasText;
  const saving = saveState === "saving";
  const waiting = saveState === "waiting";
  const textDescribedBy = [
    `${id}-text-help`,
    `${id}-count`,
    tooLarge ? `${id}-too-large` : "",
    needText ? `${id}-need-text` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <button
        type="button"
        className="tp-sheet-scrim"
        aria-label={t("ig.close")}
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        ref={sheet}
        className="tp-sheet tp-glass"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        data-component="MobileSheet"
        data-testid="ingest-sheet"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="tp-sheet__grabber" aria-hidden="true" />
        <div className="tp-sheet__head">
          <h2 className="tp-sheet__title" id={`${id}-title`}>
            {savedId ? t("ig.done.title") : t("ig.title")}
          </h2>
          <button
            className="tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close"
            type="button"
            aria-label={t("ig.close")}
            onClick={onClose}
          >
            <TpIcon name="x" />
          </button>
        </div>

        {savedId ? (
          <>
            <div className="tp-sheet__body">
              <IngestDone noteId={savedId} t={t} />
            </div>
            <div className="tp-sheet__foot">
              <button className="tp-btn tp-btn--ghost" type="button" onClick={onClose}>
                <span>{t("ig.done.close")}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tp-sheet__body">
              <p className="tp-muted">{t("ig.lede")}</p>
              {online ? null : (
                <output className="tp-notice" data-tone="caution" data-component="StateOffline">
                  <span className="tp-notice__icon">
                    <TpIcon name="wifi-off" size="sm" />
                  </span>
                  <span className="tp-notice__text">{t("ig.offline")}</span>
                </output>
              )}
              <Segmented<IngestTab>
                label={t("ig.source")}
                value={tab}
                onChange={changeTab}
                options={[
                  { value: "file", label: t("ig.tab.file") },
                  { value: "paste", label: t("ig.tab.paste") },
                  { value: "photo", label: t("ig.tab.photo") },
                ]}
              />

              <form
                className="tp-form"
                id={formId}
                data-component="Form"
                noValidate
                onSubmit={submit}
              >
                {tab === "file" ? (
                  <FilePanel
                    id={id}
                    t={t}
                    state={fileState}
                    inputRef={fileInput}
                    onFile={onFile}
                    onStop={stopFile}
                    onUsePhoto={switchToPhoto}
                  />
                ) : null}
                {tab === "photo" ? (
                  <PhotoPanel
                    id={id}
                    t={t}
                    supported={canPhoto}
                    state={photoState}
                    ratio={photoRatio}
                    inputRef={photoInput}
                    onPhoto={onPhoto}
                    onStop={stopPhoto}
                    onUsePaste={switchToPaste}
                  />
                ) : null}

                {showText ? (
                  <div className="tp-field" data-component="Field">
                    <label className="tp-label" htmlFor={`${id}-text`}>
                      {tab === "paste" ? t("ig.paste.label") : t("ig.text.label")}
                    </label>
                    <textarea
                      ref={textBox}
                      className="tp-textarea"
                      id={`${id}-text`}
                      dir="auto"
                      rows={8}
                      value={text}
                      aria-invalid={tooLarge || needText || undefined}
                      aria-describedby={textDescribedBy}
                      data-component="Textarea"
                      onChange={(event) => onTextChange(event.target.value)}
                    />
                    <p className="tp-help" id={`${id}-text-help`}>
                      {tab === "paste" ? t("ig.paste.help") : t("ig.text.help")}
                    </p>
                    {/* Read with the field (aria-describedby); a live region here spoke on every key. */}
                    <p className="tp-help" id={`${id}-count`}>
                      <CharCount text={text} t={t} />
                    </p>
                    {tooLarge ? (
                      <p className="tp-error-text" id={`${id}-too-large`}>
                        <TpIcon name="alert" size="sm" />
                        <span>{t("ig.tooLarge")}</span>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {needText && !hasText ? (
                  <p className="tp-error-text" id={`${id}-need-text`} role="alert">
                    <TpIcon name="alert" size="sm" />
                    <span>{t("ig.needText")}</span>
                  </p>
                ) : null}

                {hasText ? (
                  <div className="tp-field" data-component="Field">
                    <label className="tp-label" htmlFor={`${id}-page-title`}>
                      {t("ig.pageTitle")}
                    </label>
                    <input
                      className="tp-input"
                      id={`${id}-page-title`}
                      type="text"
                      dir="auto"
                      autoComplete="off"
                      maxLength={200}
                      placeholder={t("ig.untitled")}
                      value={title}
                      aria-describedby={`${id}-page-title-help`}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setTitleEdited(true);
                      }}
                    />
                    <p className="tp-help" id={`${id}-page-title-help`}>
                      {t("ig.pageTitle.help")}
                    </p>
                  </div>
                ) : null}

                {saveState === "error" ? (
                  <div className="tp-notice" data-tone="danger" role="alert">
                    <span className="tp-notice__icon">
                      <TpIcon name="alert" size="sm" />
                    </span>
                    <span className="tp-notice__text">{t("ig.saveError")}</span>
                    <button
                      className="tp-btn tp-btn--secondary tp-notice__action"
                      type="button"
                      onClick={() => void save()}
                    >
                      <TpIcon name="refresh" size="sm" />
                      <span>{t("ig.retry")}</span>
                    </button>
                  </div>
                ) : null}
              </form>
            </div>
            <div className="tp-sheet__foot">
              {/* Saving and waiting use aria-disabled, so the button keeps focus (save() won't
                  run twice: the busy ref). Too large can't happen while Save has focus. */}
              <button
                className="tp-btn tp-btn--primary"
                type="submit"
                form={formId}
                disabled={tooLarge}
                aria-disabled={saving || waiting || undefined}
                aria-busy={saving || undefined}
                data-component="Button"
              >
                <TpIcon name={waiting ? "wifi-off" : "page"} size="sm" />
                <span>{saving ? t("ig.saving") : waiting ? t("ig.waiting") : t("ig.save")}</span>
              </button>
              <button className="tp-btn tp-btn--ghost" type="button" onClick={onClose}>
                <span>{t("ig.close")}</span>
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function CharCount({ text, t }: { text: string; t: IngestT }) {
  // UTF-16 length: O(1). Array.from(text) walked the whole text on every key press.
  const n = text.length;
  if (n === 1) return <>{t("ig.count.one")}</>;
  const [before, after = ""] = t("ig.count").split("{n}");
  return (
    <>
      {before}
      <span className="tp-num">{n.toLocaleString("en-US")}</span>
      {after}
    </>
  );
}

/** "Stop reading": a secondary button beside the reading status. */
function StopButton({ t, onStop }: { t: IngestT; onStop: () => void }) {
  return (
    <button className="tp-btn tp-btn--secondary" type="button" onClick={onStop}>
      <TpIcon name="x" size="sm" />
      <span>{t("ig.stop")}</span>
    </button>
  );
}

/** A plain bar for how far reading has got (no animation, so nothing moves on its own). */
function ReadingBar({
  t,
  value,
  max,
  label,
}: {
  t: IngestT;
  value: number;
  max: number;
  label: string;
}) {
  return (
    <>
      <progress
        className="tp-ingest-progress"
        max={max}
        value={value}
        aria-label={t("ig.progress")}
      />
      <p className="tp-help tp-num">{label}</p>
    </>
  );
}

const READING_KEY = { pdf: "ig.file.readingPdf", docx: "ig.file.readingDocx" } as const;

function FilePanel({
  id,
  t,
  state,
  inputRef,
  onFile,
  onStop,
  onUsePhoto,
}: {
  id: string;
  t: IngestT;
  state: FileState;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onStop: () => void;
  onUsePhoto: () => void;
}) {
  const problem = state.status === "problem" ? state.problem : null;
  const reading = state.status === "reading" ? state : null;
  // Text files read at once; a PDF or a Word file can take a while, so it can be stopped.
  const slow = reading?.kind === "pdf" || reading?.kind === "docx";
  return (
    <div className="tp-field" data-component="Field">
      <label className="tp-label" htmlFor={`${id}-file`}>
        {t("ig.file.label")}
      </label>
      <input
        ref={inputRef}
        className="tp-input"
        id={`${id}-file`}
        type="file"
        accept={INGEST_ACCEPT}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-file-help ${id}-file-status` : `${id}-file-help`}
        aria-disabled={reading ? true : undefined}
        onClick={(event) => {
          // aria-disabled, not disabled, so focus stays here; no second picker while reading.
          if (reading) event.preventDefault();
        }}
        onChange={onFile}
      />
      <p className="tp-help" id={`${id}-file-help`}>
        {t("ig.file.help")}
      </p>
      {reading ? (
        <div className="tp-ingest-reading" data-testid="ingest-file-reading">
          <output className="tp-help" id={`${id}-file-status`}>
            {t(
              reading.kind === "pdf" || reading.kind === "docx"
                ? READING_KEY[reading.kind]
                : "ig.file.reading"
            )}
          </output>
          {slow ? <StopButton t={t} onStop={onStop} /> : null}
        </div>
      ) : null}
      {reading?.kind === "pdf" && reading.total ? (
        <ReadingBar
          t={t}
          value={reading.done ?? 0}
          max={reading.total}
          label={t("ig.file.pages", { n: reading.done ?? 0, total: reading.total })}
        />
      ) : null}
      {state.status === "stopped" ? (
        <output className="tp-help" id={`${id}-file-status`}>
          {t("ig.file.stopped")}
        </output>
      ) : null}
      {state.status === "read" ? (
        <output className="tp-notice" data-tone="done" id={`${id}-file-status`}>
          <span className="tp-notice__icon">
            <TpIcon name="check" size="sm" />
          </span>
          <span className="tp-notice__text">
            {t("ig.file.read").split("{name}")[0]}
            <bdi>{state.name}</bdi>
            {t("ig.file.read").split("{name}")[1] ?? ""}
            {state.pages ? (
              <> {t("ig.file.pagesCut", { read: state.pages.read, total: state.pages.total })}</>
            ) : null}
          </span>
        </output>
      ) : null}
      {problem === "no_text" ? (
        <div className="tp-notice" data-tone="caution" id={`${id}-file-status`} role="alert">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">{t("ig.file.noText")}</span>
          <button
            className="tp-btn tp-btn--secondary tp-notice__action"
            type="button"
            onClick={onUsePhoto}
          >
            <span>{t("ig.file.usePhoto")}</span>
          </button>
        </div>
      ) : problem && state.status === "problem" ? (
        <p className="tp-error-text" id={`${id}-file-status`} role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t(fileProblemKey(problem, state.kind))}</span>
        </p>
      ) : null}
    </div>
  );
}

function PhotoPanel({
  id,
  t,
  supported,
  state,
  ratio,
  inputRef,
  onPhoto,
  onStop,
  onUsePaste,
}: {
  id: string;
  t: IngestT;
  supported: boolean;
  state: PhotoState;
  /** How much of the photo the OCR has read, 0 to 1. */
  ratio: number;
  inputRef: RefObject<HTMLInputElement | null>;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  onStop: () => void;
  onUsePaste: () => void;
}) {
  if (!supported) {
    return (
      <div className="tp-notice" data-tone="info" data-testid="ingest-photo-unsupported">
        <span className="tp-notice__icon">
          <TpIcon name="info" size="sm" />
        </span>
        <span className="tp-notice__text">{t("ig.photo.unsupported")}</span>
        <button
          className="tp-btn tp-btn--secondary tp-notice__action"
          type="button"
          onClick={onUsePaste}
        >
          <span>{t("ig.photo.usePaste")}</span>
        </button>
      </div>
    );
  }
  const problem = isPhotoProblem(state) ? state : null;
  const busy = state === "loading" || state === "reading";
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div className="tp-field" data-component="Field">
      <label className="tp-label" htmlFor={`${id}-photo`}>
        {t("ig.photo.label")}
      </label>
      <input
        ref={inputRef}
        className="tp-input"
        id={`${id}-photo`}
        type="file"
        accept="image/*"
        capture="environment"
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-photo-help ${id}-photo-status` : `${id}-photo-help`}
        aria-disabled={busy || undefined}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
        onChange={onPhoto}
      />
      <p className="tp-help" id={`${id}-photo-help`}>
        {t("ig.photo.help")}
      </p>
      {busy ? (
        <div className="tp-ingest-reading" data-testid="ingest-photo-reading">
          {/* One polite live region: it speaks once when the reader is ready and reading starts,
              not on every percent. */}
          <output className="tp-help" id={`${id}-photo-status`}>
            {t(state === "loading" ? "ig.photo.loading" : "ig.photo.reading")}
          </output>
          <StopButton t={t} onStop={onStop} />
        </div>
      ) : null}
      {state === "reading" ? (
        <ReadingBar t={t} value={percent} max={100} label={t("ig.photo.percent", { n: percent })} />
      ) : null}
      {state === "stopped" ? (
        <output className="tp-help" id={`${id}-photo-status`}>
          {t("ig.photo.stopped")}
        </output>
      ) : null}
      {state === "read" ? (
        <output className="tp-notice" data-tone="done" id={`${id}-photo-status`}>
          <span className="tp-notice__icon">
            <TpIcon name="check" size="sm" />
          </span>
          <span className="tp-notice__text">{t("ig.photo.read")}</span>
        </output>
      ) : null}
      {problem ? (
        <div className="tp-notice" data-tone="caution" id={`${id}-photo-status`} role="alert">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">{t(PHOTO_PROBLEM[problem])}</span>
          <button
            className="tp-btn tp-btn--secondary tp-notice__action"
            type="button"
            onClick={onUsePaste}
          >
            <span>{t("ig.photo.usePaste")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type StudyKind = "flashcards" | "quiz" | "test";

/** Where "Turn into …" goes: T3's `/study/new` with the page as the source. */
export function studyHref(noteId: string, kind: StudyKind): string {
  return `/study/new?from=${encodeURIComponent(noteId)}&kind=${kind}`;
}

/** The success state: open the new page, or turn it into something to study. */
export function IngestDone({ noteId, t }: { noteId: string; t: IngestT }) {
  return (
    <output className="tp-state" data-component="StateEmpty" data-testid="ingest-done">
      <span className="tp-state__icon">
        <TpIcon name="check" size="lg" />
      </span>
      <p className="tp-state__body">{t("ig.done.body")}</p>
      <div className="tp-state__actions">
        <Link
          className="tp-btn tp-btn--primary"
          href={`/notes/${encodeURIComponent(noteId)}`}
          data-ingest-open=""
        >
          <TpIcon name="page" size="sm" />
          <span>{t("ig.done.open")}</span>
        </Link>
      </div>
      <nav className="tp-state__actions" aria-label={t("ig.done.study")}>
        <Link className="tp-btn tp-btn--secondary" href={studyHref(noteId, "flashcards")}>
          <span>{t("ig.done.flashcards")}</span>
        </Link>
        <Link className="tp-btn tp-btn--secondary" href={studyHref(noteId, "quiz")}>
          <span>{t("ig.done.quiz")}</span>
        </Link>
        <Link className="tp-btn tp-btn--secondary" href={studyHref(noteId, "test")}>
          <span>{t("ig.done.test")}</span>
        </Link>
      </nav>
    </output>
  );
}
