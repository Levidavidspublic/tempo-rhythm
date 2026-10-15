"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { HABIT_NAME_MAX } from "@/components/habits-library/habitForm";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";

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
  const { t } = useLocale();
  const [name, setName] = useState(initial.name);
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);
  const [invalid, setInvalid] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheet = useRef<HTMLElement | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const formId = `${id}-form`;

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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setInvalid(true);
      nameInput.current?.focus();
      return;
    }
    setInvalid(false);
    setSaveError(false);
    setBusy(true);
    onSubmit({ name: trimmed, cadence })
      .then(onClose)
      .catch(() => {
        setSaveError(true);
        setBusy(false);
      });
  };

  return (
    <>
      <button
        type="button"
        className="tp-sheet-scrim"
        aria-label={t("hr.close")}
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
            onClick={onClose}
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
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-help ${id}-error` : `${id}-help`}
                onChange={(event) => setName(event.target.value)}
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
                  onChange={(event) =>
                    setCadence(event.target.value === "weekly" ? "weekly" : "daily")
                  }
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
              <p className="tp-error-text" role="alert">
                {t("hr.saveError")}
              </p>
            ) : null}
          </form>
        </div>
        <div className="tp-sheet__foot">
          <button
            className={`tp-btn tp-btn--${submitVariant}`}
            type="submit"
            form={formId}
            disabled={busy}
            data-component="Button"
          >
            <TpIcon name="check" size="sm" />
            <span>{t("hb.nh.save")}</span>
          </button>
          <button className="tp-btn tp-btn--ghost" type="button" onClick={onClose}>
            <span>{t("hb.nh.cancel")}</span>
          </button>
        </div>
      </section>
    </>
  );
}
