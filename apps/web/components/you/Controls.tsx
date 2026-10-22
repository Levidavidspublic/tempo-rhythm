"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { kb78Copy } from "@/lib/i18n-groups/kb-78";
import "@/app/v3/kb-78.css";

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: TpIconName };

/**
 * Segmented (docs/design/v3/components.md): a radiogroup with one tab stop. Arrow keys move
 * and choose, wrapping, and swap direction in RTL.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  disabled,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() =>
      group?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
    );
  };

  return (
    <div
      className="tp-segmented"
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      data-component="Segmented"
    >
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button
          key={option.value}
          className="tp-seg__opt"
          type="button"
          role="radio"
          data-value={option.value}
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKey(event, index)}
        >
          {option.icon ? <TpIcon name={option.icon} size="sm" /> : null}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Switch: button role=switch with the visible On / Off word. */
export function Switch({
  on,
  onToggle,
  label,
  labelledBy,
  describedBy,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <button
      className="tp-switch"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onToggle}
      data-component="Switch"
    >
      <span className="tp-switch__track" aria-hidden="true">
        <span className="tp-switch__thumb" />
      </span>
      <span className="tp-switch__state" aria-hidden={label ? true : undefined}>
        {on ? t("you.on") : t("you.off")}
      </span>
    </button>
  );
}

/**
 * MobileSheet as a confirm (alert-dialog; sheet on phone, centred at 768 and up). Esc and the
 * Close button cancel, Tab stays inside, and focus returns to whatever opened it.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const confirmRef = useRef(onConfirm);
  const busyRef = useRef(busy);
  useLayoutEffect(() => {
    closeRef.current = onClose;
    confirmRef.current = onConfirm;
    busyRef.current = busy;
  }, [busy, onClose, onConfirm]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const sheet = sheetRef.current;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      // Native disabled controls, browser chrome or a caller can leave focus outside the sheet.
      if (!sheet.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <>
      <div className="tp-sheet-scrim" aria-hidden="true" />
      <section
        ref={sheetRef}
        className="tp-sheet tp-glass kb78-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-busy={busy ? true : undefined}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        data-component="MobileSheet"
      >
        <span className="tp-sheet__grabber" aria-hidden="true" />
        <div className="tp-sheet__head">
          <h2 className="tp-sheet__title" id={`${id}-title`}>
            {title}
          </h2>
          <button
            className="tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close"
            type="button"
            aria-label={t("you.close")}
            onClick={() => closeRef.current()}
          >
            <TpIcon name="x" />
          </button>
        </div>
        <div className="tp-sheet__body">
          <p id={`${id}-body`}>{body}</p>
        </div>
        <div className="tp-sheet__foot">
          <button
            ref={cancelRef}
            className="tp-btn tp-btn--secondary"
            type="button"
            onClick={() => closeRef.current()}
          >
            {cancelLabel}
          </button>
          <button
            className="tp-btn tp-btn--danger"
            type="button"
            aria-disabled={busy ? true : undefined}
            onClick={() => {
              if (!busyRef.current) confirmRef.current();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </>
  );
}

/** Fictional, interactive examples of the existing confirmation; not a primary app view. */
export function Kb78Gallery() {
  const { lang } = useLocale();
  const copy = kb78Copy[lang];
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"ready" | "pending" | "success" | "error">("ready");
  const launch = () => {
    setPhase("ready");
    setOpen(true);
  };
  return (
    <main className="kb78-gallery" data-testid="kb78-gallery">
      <h1>{copy.title}</h1>
      <p>{copy.fictional}</p>
      <button type="button" className="tp-btn tp-btn--secondary" onClick={launch}>
        {copy.open}
      </button>
      <output className="kb78-gallery-result">
        {phase === "success" ? copy.success : phase === "error" ? copy.error : copy.guidance}
      </output>
      {open ? (
        <ConfirmSheet
          title={copy.confirmTitle}
          body={
            <>
              {phase === "pending" ? copy.pending : copy.body}
              {phase === "pending" ? (
                <span className="kb78-gallery-settle">
                  <button
                    type="button"
                    className="tp-btn tp-btn--secondary"
                    onClick={() => {
                      setPhase("success");
                      setOpen(false);
                    }}
                  >
                    {copy.finish}
                  </button>
                  <button
                    type="button"
                    className="tp-btn tp-btn--secondary"
                    onClick={() => {
                      setPhase("error");
                      setOpen(false);
                    }}
                  >
                    {copy.reject}
                  </button>
                </span>
              ) : null}
            </>
          }
          confirmLabel={phase === "pending" ? copy.pending : copy.confirm}
          cancelLabel={copy.cancel}
          busy={phase === "pending"}
          onConfirm={() => setPhase("pending")}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </main>
  );
}
