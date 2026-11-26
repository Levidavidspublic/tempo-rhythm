"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { HABIT_NAME_MAX } from "@/components/habits-library/habitForm";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { kb61Copy } from "@/lib/i18n-groups/kb-61";
import "@/app/v3/kb-61.css";

export type Cadence = "daily" | "weekly";

export type HabitDraft = { name: string; cadence: Cadence };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * MobileSheet with the habit form (habits.html "New habit"): name and a gentle rhythm. A glass
 * bottom sheet on a phone, a floating card from 768 px. Esc, Close, Cancel and the scrim close it;
 * Tab stays inside; focus goes back to the button that opened it.
 *
 * The design's "When, usually" field and the "Weekdays" rhythm are left out: habits store only a
 * daily or weekly cadence today (convex/schema.ts), so neither could be saved.
 */
export function HabitSheet({
  id,
  title,
  initial,
  submitVariant = "primary",
  onSubmit,
  onClose,
}: {
  id: string;
  title: string;
  initial: HabitDraft;
  submitVariant?: "primary" | "secondary";
  onSubmit: (draft: HabitDraft) => Promise<void>;
  onClose: () => void;
}) {
  const { t, lang } = useLocale();
  const copy = kb61Copy[lang];
  const [name, setName] = useState(initial.name);
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);
  const [invalid, setInvalid] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheet = useRef<HTMLElement | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const active = useRef(true);
  const closed = useRef(false);
  const request = useRef<object | null>(null);
  const formId = `${id}-form`;

  // Invalidate synchronously: the parent may not have unmounted this sheet yet.
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    request.current = null;
    onClose();
  };

  // Layout cleanup fences a parent-driven removal before a promise can settle in that commit.
  useLayoutEffect(() => {
    active.current = true;
    closed.current = false;
    return () => {
      active.current = false;
      request.current = null;
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameInput.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!active.current || closed.current || request.current) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setInvalid(true);
      nameInput.current?.focus();
      return;
    }
    setInvalid(false);
    setSaveError(false);
    const mine = {};
    request.current = mine;
    setBusy(true);
    // A disabled submit loses browser focus; the read-only name remains in the focus trap.
    nameInput.current?.focus();
    const ownsRequest = () => active.current && !closed.current && request.current === mine;
    try {
      await onSubmit({ name: trimmed, cadence });
      if (ownsRequest()) close();
    } catch {
      if (ownsRequest()) {
        request.current = null;
        setSaveError(true);
        setBusy(false);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        className="tp-sheet-scrim kb61-scrim"
        aria-label={t("hr.close")}
        tabIndex={-1}
        onClick={close}
      />
      <section
        ref={sheet}
        className="tp-sheet tp-glass kb61-sheet"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        data-component="MobileSheet"
        onKeyDown={onKeyDown}
      >
        <div className="tp-sheet__grabber" aria-hidden="true" />
        <div className="tp-sheet__head">
          <h2 className="tp-sheet__title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            className="tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close"
            type="button"
            aria-label={t("hr.close")}
            onClick={close}
          >
            <TpIcon name="x" />
          </button>
        </div>
        <div className="tp-sheet__body">
          <form className="hb-form" id={formId} data-component="Form" noValidate onSubmit={submit}>
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${id}-name`}>
                {t("hb.nh.name")}
              </label>
              <input
                ref={nameInput}
                className="tp-input"
                id={`${id}-name`}
                type="text"
                dir="auto"
                autoComplete="off"
                maxLength={HABIT_NAME_MAX}
                placeholder={t("hb.nh.ph")}
                value={name}
                readOnly={busy}
                aria-invalid={invalid || undefined}
                aria-describedby={[
                  `${id}-help`,
                  invalid ? `${id}-error` : null,
                  saveError ? `${id}-save-error` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                onChange={(event) => {
                  if (!closed.current && !request.current) setName(event.target.value);
                }}
              />
              <p className="tp-help" id={`${id}-help`}>
                {t("hb.nh.help")}
              </p>
              {invalid ? (
                <p className="tp-error-text" id={`${id}-error`}>
                  {t("hb.nh.err")}
                </p>
              ) : null}
            </div>
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor={`${id}-rhythm`}>
                {t("hb.nh.rhythm")}
              </label>
              <div className="tp-select" data-component="Select">
                <select
                  className="tp-select__input"
                  id={`${id}-rhythm`}
                  value={cadence}
                  disabled={busy}
                  onChange={(event) => {
                    if (!closed.current && !request.current)
                      setCadence(event.target.value === "weekly" ? "weekly" : "daily");
                  }}
                >
                  <option value="daily">{t("hb.rh.most")}</option>
                  <option value="weekly">{t("hb.rh.few")}</option>
                </select>
                <span className="tp-select__icon">
                  <TpIcon name="down" size="sm" />
                </span>
              </div>
            </div>
            {saveError ? (
              <p className="tp-error-text" id={`${id}-save-error`} role="alert">
                {copy.error}
              </p>
            ) : null}
          </form>
          {busy ? (
            <output className="kb61-saving">
              <span>{copy.saving}</span>
              <span>{copy.closing}</span>
            </output>
          ) : null}
        </div>
        <div className="tp-sheet__foot">
          <button
            className={`tp-btn tp-btn--${submitVariant}`}
            type="submit"
            form={formId}
            disabled={busy}
            aria-busy={busy || undefined}
            data-component="Button"
          >
            <TpIcon name="check" size="sm" />
            <span>{saveError ? copy.retry : t("hb.nh.save")}</span>
          </button>
          <button className="tp-btn tp-btn--ghost" type="button" onClick={close}>
            <span>{t("hb.nh.cancel")}</span>
          </button>
        </div>
      </section>
    </>
  );
}

/** Fictional deferred saves; no backend call. Existing sheet, zero new primary views. */
export function Kb61Gallery() {
  const { lang, t } = useLocale();
  const copy = kb61Copy[lang];
  const [open, setOpen] = useState(false);
  const [rejectSave, setRejectSave] = useState(false);
  const [saved, setSaved] = useState(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    },
    []
  );
  const save = (_draft: HabitDraft) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        if (rejectSave) reject(new Error("fictional save unavailable"));
        else {
          setSaved((count) => count + 1);
          resolve();
        }
      }, 1500);
      timers.current.add(timer);
    });
  return (
    <main className="tp-page kb61-gallery">
      <h1 className="tp-pagehead__title">{copy.galleryTitle}</h1>
      <fieldset className="kb61-gallery__choices">
        <legend className="tp-label">{copy.galleryNext}</legend>
        <button
          className="tp-btn tp-btn--secondary"
          type="button"
          aria-pressed={!rejectSave}
          onClick={() => setRejectSave(false)}
        >
          {copy.gallerySuccess}
        </button>
        <button
          className="tp-btn tp-btn--secondary"
          type="button"
          aria-pressed={rejectSave}
          onClick={() => setRejectSave(true)}
        >
          {copy.galleryError}
        </button>
      </fieldset>
      <button
        className="tp-btn tp-btn--secondary"
        type="button"
        data-kb61-open
        onClick={() => setOpen(true)}
      >
        {copy.galleryOpen}
      </button>
      <output>
        {copy.gallerySaved}: <span className="tp-num">{saved}</span>
      </output>
      {open ? (
        <HabitSheet
          id="kb61-gallery-habit"
          title={t("hb.new")}
          initial={{ name: "", cadence: "daily" }}
          onSubmit={save}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </main>
  );
}
