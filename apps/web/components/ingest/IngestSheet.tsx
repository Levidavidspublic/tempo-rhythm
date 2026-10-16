"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
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
  isTooLarge,
  toPageBody,
} from "./ingest-text";
import { canReadPhotos, readIngestFile, readPhotoText } from "./read-sources";

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
  /** Whether the browser can read text in photos. Default: detected (`window.TextDetector`). */
  photoSupported?: boolean;
  /** Text already in the sheet when it opens. */
  initialText?: string;
};

type FileState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "read"; name: string }
  | { status: "problem"; problem: IngestProblem };

type PhotoState = "idle" | "reading" | "read" | "none" | "error" | "too_large";

const PHOTO_PROBLEM = {
  none: "ig.photo.none",
  error: "ig.photo.error",
  too_large: "ig.photo.tooLarge",
} as const;

type SaveState = "idle" | "saving" | "waiting" | "error";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FILE_PROBLEM = {
  type: "ig.file.type",
  empty: "ig.file.empty",
  too_large: "ig.file.tooLarge",
  unreadable: "ig.file.unreadable",
} as const;

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
  const [canPhoto] = useState(() => photoSupported ?? canReadPhotos());
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [needText, setNeedText] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const sheet = useRef<HTMLElement | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus();
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // After saving, the Save button is gone: move focus to "Open the page".
  useEffect(() => {
    if (savedId) sheet.current?.querySelector<HTMLElement>("[data-ingest-open]")?.focus();
  }, [savedId]);

  const tooLarge = isTooLarge(text);
  const hasText = text.trim().length > 0;

  const takeText = (next: string, nextTitle: string) => {
    setText(next);
    setNeedText(false);
    if (!titleEdited) setTitle(nextTitle);
  };

  const save = async () => {
    if (busy.current || savedId) return;
    if (!hasText) {
      setNeedText(true);
      return;
    }
    if (tooLarge) return;
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
    if (event.shiftKey && document.activeElement === first) {
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
    if (!file) return;
    setFileState({ status: "reading" });
    void readIngestFile(file).then((result) => {
      if (!mounted.current) return;
      if (result.ok) {
        takeText(result.text, result.title);
        setFileState({ status: "read", name: file.name });
      } else {
        setFileState({ status: "problem", problem: result.problem });
      }
    });
  };

  const onPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const image = input.files?.[0];
    // RAM-ONLY: the photo is read in memory and dropped; it is never uploaded or stored.
    input.value = "";
    if (!image) return;
    setPhotoState("reading");
    void readPhotoText(image).then((result) => {
      if (!mounted.current) return;
      if (result.ok) {
        takeText(result.text, deriveTitle(result.text));
        setPhotoState("read");
      } else {
        setPhotoState(result.problem);
      }
    });
  };

  const onTextChange = (next: string) => {
    takeText(next, deriveTitle(next));
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
                onChange={setTab}
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
                  <FilePanel id={id} t={t} state={fileState} onFile={onFile} />
                ) : null}
                {tab === "photo" ? (
                  <PhotoPanel
                    id={id}
                    t={t}
                    supported={canPhoto}
                    state={photoState}
                    onPhoto={onPhoto}
                    onUsePaste={() => setTab("paste")}
                  />
                ) : null}

                {showText ? (
                  <div className="tp-field" data-component="Field">
                    <label className="tp-label" htmlFor={`${id}-text`}>
                      {tab === "paste" ? t("ig.paste.label") : t("ig.text.label")}
                    </label>
                    <textarea
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
                    <p className="tp-help" id={`${id}-count`} aria-live="polite">
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
              <button
                className="tp-btn tp-btn--primary"
                type="submit"
                form={formId}
                disabled={saving || waiting || tooLarge}
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

function FilePanel({
  id,
  t,
  state,
  onFile,
}: {
  id: string;
  t: IngestT;
  state: FileState;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const problem = state.status === "problem" ? state.problem : null;
  return (
    <div className="tp-field" data-component="Field">
      <label className="tp-label" htmlFor={`${id}-file`}>
        {t("ig.file.label")}
      </label>
      <input
        className="tp-input"
        id={`${id}-file`}
        type="file"
        accept={INGEST_ACCEPT}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-file-help ${id}-file-status` : `${id}-file-help`}
        disabled={state.status === "reading"}
        onChange={onFile}
      />
      <p className="tp-help" id={`${id}-file-help`}>
        {t("ig.file.help")}
      </p>
      {state.status === "reading" ? (
        <output className="tp-help" id={`${id}-file-status`}>
          {t("ig.file.reading")}
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
          </span>
        </output>
      ) : null}
      {problem ? (
        <p className="tp-error-text" id={`${id}-file-status`} role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t(FILE_PROBLEM[problem])}</span>
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
  onPhoto,
  onUsePaste,
}: {
  id: string;
  t: IngestT;
  supported: boolean;
  state: PhotoState;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
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
  const problem = state === "none" || state === "error" || state === "too_large";
  return (
    <div className="tp-field" data-component="Field">
      <label className="tp-label" htmlFor={`${id}-photo`}>
        {t("ig.photo.label")}
      </label>
      <input
        className="tp-input"
        id={`${id}-photo`}
        type="file"
        accept="image/*"
        capture="environment"
        aria-invalid={problem || undefined}
        aria-describedby={problem ? `${id}-photo-help ${id}-photo-status` : `${id}-photo-help`}
        disabled={state === "reading"}
        onChange={onPhoto}
      />
      <p className="tp-help" id={`${id}-photo-help`}>
        {t("ig.photo.help")}
      </p>
      {state === "reading" ? (
        <output className="tp-help" id={`${id}-photo-status`}>
          {t("ig.photo.reading")}
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
          <span className="tp-notice__text">{t(PHOTO_PROBLEM[state])}</span>
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
