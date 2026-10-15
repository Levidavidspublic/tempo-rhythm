"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { formatCountdown } from "@/lib/you/screenState";

/**
 * UndoToast (docs/design/v3/tempo.js TP.toast): one glass toast with the 5:00 countdown,
 * Undo and Dismiss. It closes itself when the window ends. The countdown is hidden from
 * screen readers so the live region announces the title once, not every second.
 */
export function UndoToast({
  title,
  untilMs,
  onUndo,
  onClose,
}: {
  title: string;
  /** When the Undo window ends. */
  untilMs: number;
  /** Omit for a plain notice toast. Throwing keeps the toast open with an error. */
  onUndo?: () => Promise<unknown> | unknown;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= untilMs) closeRef.current();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [untilMs]);

  const undo = async () => {
    if (!onUndo || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onUndo();
      closeRef.current();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="tp-toast-region" aria-live="polite">
      <output className="tp-toast tp-glass" data-component="UndoToast">
        <span className="tp-toast__icon">
          <TpIcon name="check" />
        </span>
        <span className="tp-toast__text">
          <span className="tp-toast__title">{title}</span>
          {onUndo ? (
            <span className="tp-toast__sub">
              {t("you.toast.sub")}{" "}
              <span className="tp-num tp-mono" aria-hidden="true">
                {formatCountdown(untilMs - now)}
              </span>
              <span className="tp-sr-only">{t("you.toast.window")}</span>
            </span>
          ) : null}
          {failed ? (
            <span className="tp-error-text" role="alert">
              {t("you.toast.undoError")}
            </span>
          ) : null}
        </span>
        {onUndo ? (
          <button
            className="tp-btn tp-btn--secondary tp-btn--sm"
            type="button"
            disabled={busy}
            onClick={() => void undo()}
          >
            <TpIcon name="undo" size="sm" />
            <span>{t("you.toast.undo")}</span>
          </button>
        ) : null}
        <button
          className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
          type="button"
          aria-label={t("you.toast.dismiss")}
          onClick={() => closeRef.current()}
        >
          <TpIcon name="x" size="sm" />
        </button>
      </output>
    </div>
  );
}
