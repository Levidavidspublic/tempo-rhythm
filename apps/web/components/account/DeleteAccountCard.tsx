"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Settings · Privacy → "Leave Tempo" (docs/design/v3/screens/web/settings-privacy.html): a danger
 * row that opens a confirmation (alert dialog, a sheet on phones). The delete button stays off
 * until the tick box is checked. Confirm calls users.deleteMyAccount, signs out and goes to
 * /sign-in. The backend has no "restore" call, so there is no pending-deletion notice; the copy
 * says plainly that signing in again does not bring the data back.
 */
export function DeleteAccountCard() {
  const { t } = useLocale();
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const tickRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(false);

  const close = useCallback(() => {
    if (pendingRef.current) return;
    setOpen(false);
    setUnderstood(false);
    setError(false);
    openerRef.current?.focus();
  }, []);

  // While open: focus the tick box, keep Tab inside, Escape closes, the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    tickRef.current?.focus();
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      const sheet = sheetRef.current;
      if (event.key !== "Tab" || !sheet) return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
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
    document.addEventListener("keydown", onKey, true);
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  const onConfirm = async () => {
    if (!understood) {
      tickRef.current?.focus();
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      await deleteMyAccount({});
      await signOut();
      router.push("/sign-in");
    } catch {
      pendingRef.current = false;
      setPending(false);
      setError(true);
    }
  };

  return (
    <>
      <section className="tp-settings-section" aria-labelledby="del-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="del-title">
            {t("set.privacy.leave")}
          </h2>
        </div>
        <div className="tp-setting-row tp-setting-row--stack od-row" data-tone="danger" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.privacy.delLabel")}</span>
            <span className="tp-help">{t("set.privacy.delHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <button
              ref={openerRef}
              id="del-open"
              className="tp-btn tp-btn--danger-ghost"
              type="button"
              aria-haspopup="dialog"
              aria-controls="del-sheet"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <TpIcon name="x" size="sm" />
              <span>{t("set.privacy.delBtn")}</span>
            </button>
          </div>
        </div>
      </section>

      {open ? (
        <>
          {/* Pointer path out of the dialog, like TempoShell's scrim; keyboard users have Escape and the buttons. */}
          <button type="button" className="tp-sheet-scrim" aria-label={t("set.close")} tabIndex={-1} onClick={close} />
          <section
            ref={sheetRef}
            className="tp-sheet tp-glass"
            id="del-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ds-title"
            aria-describedby="ds-body"
            data-component="MobileSheet"
          >
            <span className="tp-sheet__grabber" aria-hidden="true" />
            <div className="tp-sheet__head">
              <h2 className="tp-sheet__title" id="ds-title">
                {t("set.privacy.dsTitle")}
              </h2>
              <button
                className="tp-btn tp-btn--ghost tp-btn--icon tp-sheet__close"
                type="button"
                aria-label={t("set.close")}
                disabled={pending}
                onClick={close}
              >
                <TpIcon name="x" />
              </button>
            </div>
            <div className="tp-sheet__body pv-sheet-body">
              <p id="ds-body">{t("set.privacy.dsBody")}</p>
              <ul className="pv-list">
                <li>{t("set.privacy.dsL1")}</li>
                <li>{t("set.privacy.dsL2")}</li>
                <li>{t("set.privacy.dsL3")}</li>
              </ul>
              <p className="tp-help">{t("set.privacy.dsTip")}</p>
              <label className="tp-choice" data-component="Checkbox">
                <input
                  ref={tickRef}
                  className="tp-checkbox"
                  type="checkbox"
                  id="ds-ok"
                  aria-describedby="ds-need"
                  checked={understood}
                  disabled={pending}
                  onChange={(event) => setUnderstood(event.target.checked)}
                />
                <span className="tp-choice__text">
                  <span>{t("set.privacy.dsOk")}</span>
                  <span className="tp-choice__hint" id="ds-need">
                    {t("set.privacy.dsNeed")}
                  </span>
                </span>
              </label>
              {error ? (
                <p className="tp-error-text" role="alert">
                  <TpIcon name="alert" size="sm" />
                  <span>{t("set.privacy.delError")}</span>
                </p>
              ) : null}
            </div>
            <div className="tp-sheet__foot">
              <button className="tp-btn tp-btn--secondary" type="button" disabled={pending} onClick={close}>
                <span>{t("set.privacy.dsKeep")}</span>
              </button>
              <button
                className="tp-btn tp-btn--danger"
                type="button"
                aria-disabled={!understood || pending}
                aria-describedby="ds-need"
                aria-busy={pending || undefined}
                onClick={() => void onConfirm()}
              >
                <span>{pending ? t("set.privacy.deleting") : t("set.privacy.dsConfirm")}</span>
              </button>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
